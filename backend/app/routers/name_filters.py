from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.name_filter import NameFilter, NameFilterPattern, NameFilterTier
from ..models.tenant import TenantModerator, Tenant

router = APIRouter(prefix="/tenants/{tenant_id}/filters/name", tags=["name-filters"])


async def _check_access(tenant_id: str, user: User, db: AsyncSession, require_editor: bool = True) -> None:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if user.role == "admin" or str(tenant.user_id) == str(user.id):
        return
    role_filter = TenantModerator.role == "editor" if require_editor else True
    mod = await db.execute(
        select(TenantModerator).where(
            TenantModerator.tenant_id == tenant_id,
            TenantModerator.twitch_user_id == user.twitch_id,
            TenantModerator.revoked_at.is_(None),
        )
    )
    if not mod.scalar_one_or_none():
        raise HTTPException(status_code=403)


class PatternIn(BaseModel):
    pattern: str
    is_regex: bool = False
    is_whitelist: bool = False


class TierIn(BaseModel):
    tier_order: int
    threshold: int = 1
    window_minutes: int = 1440
    action: str = "ban"
    duration_seconds: int = 0
    message_template: str | None = None


class FilterCreate(BaseModel):
    name: str
    enabled: bool = True
    test_mode: bool = False
    priority: int = 0
    patterns: list[PatternIn] = []
    tiers: list[TierIn] = []


class FilterUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    test_mode: bool | None = None
    priority: int | None = None
    patterns: list[PatternIn] | None = None
    tiers: list[TierIn] | None = None


@router.get("")
async def list_name_filters(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db, require_editor=False)
    result = await db.execute(
        select(NameFilter).where(NameFilter.tenant_id == tenant_id).order_by(desc(NameFilter.priority))
    )
    out = []
    for f in result.scalars().all():
        patterns = await db.execute(select(NameFilterPattern).where(NameFilterPattern.filter_id == f.id))
        tiers = await db.execute(select(NameFilterTier).where(NameFilterTier.filter_id == f.id).order_by(NameFilterTier.tier_order))
        out.append({
            "id": str(f.id), "name": f.name, "enabled": f.enabled,
            "test_mode": f.test_mode, "priority": f.priority,
            "patterns": [{"id": str(p.id), "pattern": p.pattern, "is_regex": p.is_regex, "is_whitelist": p.is_whitelist} for p in patterns.scalars().all()],
            "tiers": [{"id": str(t.id), "tier_order": t.tier_order, "threshold": t.threshold, "action": t.action, "duration_seconds": t.duration_seconds} for t in tiers.scalars().all()],
        })
    return out


@router.post("")
async def create_name_filter(
    tenant_id: str,
    data: FilterCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    f = NameFilter(tenant_id=tenant_id, name=data.name, enabled=data.enabled, test_mode=data.test_mode, priority=data.priority, created_by=current_user.id)
    db.add(f)
    await db.flush()
    for p in data.patterns:
        db.add(NameFilterPattern(filter_id=f.id, **p.model_dump()))
    for t in data.tiers:
        db.add(NameFilterTier(filter_id=f.id, **t.model_dump()))
    await db.commit()
    return {"id": str(f.id), "ok": True}


@router.put("/{filter_id}")
async def update_name_filter(
    tenant_id: str,
    filter_id: str,
    data: FilterUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(select(NameFilter).where(NameFilter.id == filter_id, NameFilter.tenant_id == tenant_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404)
    if data.name is not None: f.name = data.name
    if data.enabled is not None: f.enabled = data.enabled
    if data.test_mode is not None: f.test_mode = data.test_mode
    if data.priority is not None: f.priority = data.priority
    if data.patterns is not None:
        await db.execute(delete(NameFilterPattern).where(NameFilterPattern.filter_id == filter_id))
        for p in data.patterns:
            db.add(NameFilterPattern(filter_id=f.id, **p.model_dump()))
    if data.tiers is not None:
        await db.execute(delete(NameFilterTier).where(NameFilterTier.filter_id == filter_id))
        for t in data.tiers:
            db.add(NameFilterTier(filter_id=f.id, **t.model_dump()))
    await db.commit()
    return {"ok": True}


@router.delete("/{filter_id}")
async def delete_name_filter(
    tenant_id: str,
    filter_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(select(NameFilter).where(NameFilter.id == filter_id, NameFilter.tenant_id == tenant_id))
    f = result.scalar_one_or_none()
    if not f: raise HTTPException(status_code=404)
    await db.delete(f)
    await db.commit()
    return {"ok": True}
