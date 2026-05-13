from typing import Annotated
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, cast, Date

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.ban import Ban
from ..models.chat_filter import ChatFilterHit, ChatFilter
from ..models.tenant import Tenant, TenantModerator

router = APIRouter(prefix="/tenants/{tenant_id}/stats", tags=["stats"])


async def _check_access(tenant_id: str, user: User, db: AsyncSession) -> None:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if user.role == "admin" or str(tenant.user_id) == str(user.id):
        return
    mod = await db.execute(
        select(TenantModerator).where(
            TenantModerator.tenant_id == tenant_id,
            TenantModerator.twitch_user_id == user.twitch_id,
            TenantModerator.revoked_at.is_(None),
        )
    )
    if not mod.scalar_one_or_none():
        raise HTTPException(status_code=403)


@router.get("")
async def get_stats(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    period: str = Query(default="week", pattern="^(day|week|month)$"),
):
    await _check_access(tenant_id, current_user, db)

    now = datetime.now(timezone.utc)
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(days=7)
    else:
        since = now - timedelta(days=30)

    # Bans by day
    bans_by_day_result = await db.execute(
        select(
            cast(Ban.created_at, Date).label("day"),
            func.count(Ban.id).label("count"),
        )
        .where(Ban.tenant_id == tenant_id, Ban.created_at >= since, Ban.type == "permanent")
        .group_by(cast(Ban.created_at, Date))
        .order_by(cast(Ban.created_at, Date))
    )
    bans_by_day = [{"day": str(row.day), "count": row.count} for row in bans_by_day_result.all()]

    # Timeouts by day
    timeouts_by_day_result = await db.execute(
        select(
            cast(Ban.created_at, Date).label("day"),
            func.count(Ban.id).label("count"),
        )
        .where(Ban.tenant_id == tenant_id, Ban.created_at >= since, Ban.type == "timeout")
        .group_by(cast(Ban.created_at, Date))
        .order_by(cast(Ban.created_at, Date))
    )
    timeouts_by_day = [{"day": str(row.day), "count": row.count} for row in timeouts_by_day_result.all()]

    # Filter-Hits by Filter
    top_filters_result = await db.execute(
        select(
            ChatFilterHit.filter_id,
            ChatFilter.name.label("filter_name"),
            func.count(ChatFilterHit.id).label("hits"),
        )
        .join(ChatFilter, ChatFilterHit.filter_id == ChatFilter.id)
        .where(ChatFilter.tenant_id == tenant_id, ChatFilterHit.created_at >= since)
        .group_by(ChatFilterHit.filter_id, ChatFilter.name)
        .order_by(desc(func.count(ChatFilterHit.id)))
        .limit(10)
    )
    top_filters = [{"filter_id": str(row.filter_id), "filter_name": row.filter_name, "hits": row.hits} for row in top_filters_result.all()]

    # Top matched terms
    top_terms_result = await db.execute(
        select(
            ChatFilterHit.matched_term,
            func.count(ChatFilterHit.id).label("hits"),
        )
        .join(ChatFilter, ChatFilterHit.filter_id == ChatFilter.id)
        .where(ChatFilter.tenant_id == tenant_id, ChatFilterHit.created_at >= since, ChatFilterHit.matched_term.isnot(None))
        .group_by(ChatFilterHit.matched_term)
        .order_by(desc(func.count(ChatFilterHit.id)))
        .limit(10)
    )
    top_terms = [{"term": row.matched_term, "hits": row.hits} for row in top_terms_result.all()]

    # Totals
    total_bans = await db.scalar(select(func.count(Ban.id)).where(Ban.tenant_id == tenant_id))
    total_timeouts = await db.scalar(select(func.count(Ban.id)).where(Ban.tenant_id == tenant_id, Ban.type == "timeout"))
    total_filter_hits = await db.scalar(
        select(func.count(ChatFilterHit.id))
        .join(ChatFilter, ChatFilterHit.filter_id == ChatFilter.id)
        .where(ChatFilter.tenant_id == tenant_id)
    )

    return {
        "period": period,
        "since": since.isoformat(),
        "bans_by_day": bans_by_day,
        "timeouts_by_day": timeouts_by_day,
        "top_filters": top_filters,
        "top_terms": top_terms,
        "totals": {
            "bans": total_bans or 0,
            "timeouts": total_timeouts or 0,
            "filter_hits": total_filter_hits or 0,
        },
    }
