from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.chat_filter import (
    ChatFilter, ChatFilterTerm, ChatFilterTier, ChatFilterViolation, ChatFilterHit
)
from ..models.tenant import TenantModerator, Tenant

router = APIRouter(prefix="/tenants/{tenant_id}/filters/chat", tags=["chat-filters"])


async def _check_tenant_access(tenant_id: str, user: User, db: AsyncSession, require_editor: bool = True) -> None:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if user.role == "admin" or str(tenant.user_id) == str(user.id):
        return
    if require_editor:
        mod = await db.execute(
            select(TenantModerator).where(
                TenantModerator.tenant_id == tenant_id,
                TenantModerator.twitch_user_id == user.twitch_id,
                TenantModerator.role == "editor",
                TenantModerator.revoked_at.is_(None),
            )
        )
        if not mod.scalar_one_or_none():
            raise HTTPException(status_code=403)
    else:
        mod = await db.execute(
            select(TenantModerator).where(
                TenantModerator.tenant_id == tenant_id,
                TenantModerator.twitch_user_id == user.twitch_id,
                TenantModerator.revoked_at.is_(None),
            )
        )
        if not mod.scalar_one_or_none():
            raise HTTPException(status_code=403)


class TermIn(BaseModel):
    term: str
    is_regex: bool = False
    is_whitelist: bool = False
    similarity_threshold: float | None = None


class TierIn(BaseModel):
    tier_order: int
    threshold: int = 1
    window_minutes: int = 60
    action: str = "timeout"
    duration_seconds: int = 300
    message_template: str | None = None


class FilterCreate(BaseModel):
    name: str
    enabled: bool = True
    case_sensitive: bool = False
    test_mode: bool = False
    priority: int = 0
    terms: list[TermIn] = []
    tiers: list[TierIn] = []


class FilterUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    case_sensitive: bool | None = None
    test_mode: bool | None = None
    priority: int | None = None
    terms: list[TermIn] | None = None
    tiers: list[TierIn] | None = None


@router.get("")
async def list_chat_filters(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_tenant_access(tenant_id, current_user, db, require_editor=False)
    result = await db.execute(
        select(ChatFilter).where(ChatFilter.tenant_id == tenant_id).order_by(desc(ChatFilter.priority))
    )
    filters = result.scalars().all()
    out = []
    for f in filters:
        terms = await db.execute(select(ChatFilterTerm).where(ChatFilterTerm.filter_id == f.id))
        tiers = await db.execute(select(ChatFilterTier).where(ChatFilterTier.filter_id == f.id).order_by(ChatFilterTier.tier_order))
        out.append(_filter_dict(f, list(terms.scalars().all()), list(tiers.scalars().all())))
    return out


@router.post("")
async def create_chat_filter(
    tenant_id: str,
    data: FilterCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_tenant_access(tenant_id, current_user, db)
    f = ChatFilter(
        tenant_id=tenant_id,
        name=data.name,
        enabled=data.enabled,
        case_sensitive=data.case_sensitive,
        test_mode=data.test_mode,
        priority=data.priority,
        created_by=current_user.id,
    )
    db.add(f)
    await db.flush()
    for t in data.terms:
        db.add(ChatFilterTerm(filter_id=f.id, **t.model_dump()))
    for t in data.tiers:
        db.add(ChatFilterTier(filter_id=f.id, **t.model_dump()))
    await db.commit()
    await db.refresh(f)
    return {"id": str(f.id), "ok": True}


@router.put("/{filter_id}")
async def update_chat_filter(
    tenant_id: str,
    filter_id: str,
    data: FilterUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_tenant_access(tenant_id, current_user, db)
    result = await db.execute(
        select(ChatFilter).where(ChatFilter.id == filter_id, ChatFilter.tenant_id == tenant_id)
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404)

    if data.name is not None: f.name = data.name
    if data.enabled is not None: f.enabled = data.enabled
    if data.case_sensitive is not None: f.case_sensitive = data.case_sensitive
    if data.test_mode is not None: f.test_mode = data.test_mode
    if data.priority is not None: f.priority = data.priority

    if data.terms is not None:
        await db.execute(
            select(ChatFilterTerm).where(ChatFilterTerm.filter_id == filter_id)
        )
        # Delete + re-insert terms
        from sqlalchemy import delete
        await db.execute(delete(ChatFilterTerm).where(ChatFilterTerm.filter_id == filter_id))
        for t in data.terms:
            db.add(ChatFilterTerm(filter_id=f.id, **t.model_dump()))

    if data.tiers is not None:
        from sqlalchemy import delete
        await db.execute(delete(ChatFilterTier).where(ChatFilterTier.filter_id == filter_id))
        for t in data.tiers:
            db.add(ChatFilterTier(filter_id=f.id, **t.model_dump()))

    await db.commit()
    return {"ok": True}


@router.delete("/{filter_id}")
async def delete_chat_filter(
    tenant_id: str,
    filter_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_tenant_access(tenant_id, current_user, db)
    result = await db.execute(
        select(ChatFilter).where(ChatFilter.id == filter_id, ChatFilter.tenant_id == tenant_id)
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404)
    await db.delete(f)
    await db.commit()
    return {"ok": True}


@router.post("/{filter_id}/duplicate")
async def duplicate_chat_filter(
    tenant_id: str,
    filter_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_tenant_access(tenant_id, current_user, db)
    result = await db.execute(
        select(ChatFilter).where(ChatFilter.id == filter_id, ChatFilter.tenant_id == tenant_id)
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404)

    terms = await db.execute(select(ChatFilterTerm).where(ChatFilterTerm.filter_id == filter_id))
    tiers = await db.execute(select(ChatFilterTier).where(ChatFilterTier.filter_id == filter_id))

    new_f = ChatFilter(
        tenant_id=tenant_id, name=f.name + " (Kopie)", enabled=False,
        case_sensitive=f.case_sensitive, test_mode=f.test_mode,
        priority=f.priority, created_by=current_user.id,
    )
    db.add(new_f)
    await db.flush()
    for t in terms.scalars().all():
        db.add(ChatFilterTerm(filter_id=new_f.id, term=t.term, is_regex=t.is_regex, is_whitelist=t.is_whitelist))
    for t in tiers.scalars().all():
        db.add(ChatFilterTier(filter_id=new_f.id, tier_order=t.tier_order, threshold=t.threshold, window_minutes=t.window_minutes, action=t.action, duration_seconds=t.duration_seconds, message_template=t.message_template))
    await db.commit()
    return {"id": str(new_f.id), "ok": True}


@router.get("/{filter_id}/hits")
async def get_filter_hits(
    tenant_id: str,
    filter_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
):
    await _check_tenant_access(tenant_id, current_user, db, require_editor=False)
    result = await db.execute(
        select(ChatFilterHit)
        .where(ChatFilterHit.filter_id == filter_id)
        .order_by(desc(ChatFilterHit.created_at))
        .limit(limit)
    )
    return [{"id": str(h.id), "twitch_username": h.twitch_username, "message_text": h.message_text, "matched_term": h.matched_term, "action_taken": h.action_taken, "test_mode": h.test_mode, "created_at": h.created_at} for h in result.scalars().all()]


def _filter_dict(f: ChatFilter, terms: list, tiers: list) -> dict:
    return {
        "id": str(f.id),
        "name": f.name,
        "enabled": f.enabled,
        "case_sensitive": f.case_sensitive,
        "test_mode": f.test_mode,
        "priority": f.priority,
        "created_at": f.created_at,
        "terms": [{"id": str(t.id), "term": t.term, "is_regex": t.is_regex, "is_whitelist": t.is_whitelist} for t in terms],
        "tiers": [{"id": str(t.id), "tier_order": t.tier_order, "threshold": t.threshold, "window_minutes": t.window_minutes, "action": t.action, "duration_seconds": t.duration_seconds, "message_template": t.message_template} for t in tiers],
    }
