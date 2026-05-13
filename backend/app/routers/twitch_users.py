from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user, require_admin
from ..models.user import User
from ..models.twitch_user import TwitchUser, TenantUserExclusion, GlobalUserExclusion
from ..models.ban import Ban

router = APIRouter(prefix="/twitch-users", tags=["twitch-users"])


@router.get("")
async def search_twitch_users(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    q: str = Query(min_length=2, max_length=50),
    limit: int = 20,
):
    result = await db.execute(
        select(TwitchUser)
        .where(TwitchUser.current_username.ilike(f"%{q}%"))
        .order_by(TwitchUser.current_username)
        .limit(limit)
    )
    users = result.scalars().all()
    return [{"twitch_id": u.twitch_id, "current_username": u.current_username, "avatar_url": u.avatar_url, "first_seen": u.first_seen, "last_seen": u.last_seen} for u in users]


@router.get("/{twitch_id}")
async def get_twitch_user(
    twitch_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TwitchUser).where(TwitchUser.twitch_id == twitch_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)
    return {
        "twitch_id": user.twitch_id,
        "current_username": user.current_username,
        "username_history": user.username_history_json,
        "avatar_url": user.avatar_url,
        "first_seen": user.first_seen,
        "last_seen": user.last_seen,
    }


@router.get("/{twitch_id}/bans")
async def get_user_bans(
    twitch_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Alle Bans dieses Nutzers über alle Tenants (nur für Admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    result = await db.execute(
        select(Ban).where(Ban.twitch_user_id == twitch_id).order_by(desc(Ban.created_at))
    )
    return [{"tenant_id": str(b.tenant_id), "type": b.type, "reason": b.reason, "created_at": b.created_at} for b in result.scalars().all()]


# ── Ausschlüsse (Whitelist) ────────────────────────────────────

class ExclusionRequest(BaseModel):
    tenant_id: str | None = None   # None = global (admin only)
    exclude_chat_filter: bool = True
    exclude_name_filter: bool = True
    exclude_scan: bool = True


@router.post("/{twitch_id}/exclude")
async def add_exclusion(
    twitch_id: str,
    data: ExclusionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Schließt einen Twitch-User aus einem oder mehreren Filtern aus.
    - tenant_id=None + admin → globaler Ausschluss
    - tenant_id gesetzt → Ausschluss nur für diesen Tenant
    """
    if data.tenant_id is None:
        # Globaler Ausschluss — nur Admin
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Nur Admins können globale Ausschlüsse setzen")
        result = await db.execute(
            select(GlobalUserExclusion).where(GlobalUserExclusion.twitch_user_id == twitch_id)
        )
        excl = result.scalar_one_or_none()
        if excl:
            excl.exclude_chat_filter = data.exclude_chat_filter
            excl.exclude_name_filter = data.exclude_name_filter
            excl.exclude_scan = data.exclude_scan
        else:
            excl = GlobalUserExclusion(
                twitch_user_id=twitch_id,
                exclude_chat_filter=data.exclude_chat_filter,
                exclude_name_filter=data.exclude_name_filter,
                exclude_scan=data.exclude_scan,
                set_by=current_user.id,
            )
            db.add(excl)
    else:
        # Tenant-spezifischer Ausschluss
        result = await db.execute(
            select(TenantUserExclusion).where(
                TenantUserExclusion.tenant_id == data.tenant_id,
                TenantUserExclusion.twitch_user_id == twitch_id,
            )
        )
        excl = result.scalar_one_or_none()
        if excl:
            excl.exclude_chat_filter = data.exclude_chat_filter
            excl.exclude_name_filter = data.exclude_name_filter
            excl.exclude_scan = data.exclude_scan
        else:
            excl = TenantUserExclusion(
                tenant_id=data.tenant_id,
                twitch_user_id=twitch_id,
                exclude_chat_filter=data.exclude_chat_filter,
                exclude_name_filter=data.exclude_name_filter,
                exclude_scan=data.exclude_scan,
            )
            db.add(excl)
    await db.commit()
    return {"ok": True}


@router.get("/{twitch_id}/exclusions")
async def get_exclusions(
    twitch_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Gibt Ausschlüsse für diesen User zurück (global + tenant-spezifisch für eigene Tenants)."""
    # Globaler Ausschluss
    global_result = await db.execute(
        select(GlobalUserExclusion).where(GlobalUserExclusion.twitch_user_id == twitch_id)
    )
    global_excl = global_result.scalar_one_or_none()

    # Tenant-Ausschlüsse
    tenant_result = await db.execute(
        select(TenantUserExclusion).where(TenantUserExclusion.twitch_user_id == twitch_id)
    )
    tenant_excls = tenant_result.scalars().all()

    return {
        "global": {
            "active": global_excl is not None,
            "exclude_chat_filter": global_excl.exclude_chat_filter if global_excl else False,
            "exclude_name_filter": global_excl.exclude_name_filter if global_excl else False,
            "exclude_scan": global_excl.exclude_scan if global_excl else False,
        } if current_user.role == "admin" else None,
        "tenant_exclusions": [
            {
                "tenant_id": str(e.tenant_id),
                "exclude_chat_filter": e.exclude_chat_filter,
                "exclude_name_filter": e.exclude_name_filter,
                "exclude_scan": e.exclude_scan,
            }
            for e in tenant_excls
        ],
    }
