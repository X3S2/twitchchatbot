from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ..core.database import get_db
from ..core.deps import get_current_user, require_admin
from ..models.user import User
from ..models.twitch_user import TwitchUser
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
