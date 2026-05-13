"""
Interner API-Endpunkt — nur vom Bot-Manager aus dem Docker-Netz erreichbar.
Kein JWT; gesichert durch INTERNAL_API_KEY im Authorization-Header.
"""
from fastapi import APIRouter, Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone
import json

from ..core.config import get_settings
from ..core.database import get_db
from ..core.redis_client import get_redis
from ..models.tenant import BotInstance, Tenant
from ..models.notification import Notification
from ..models.user import User

router = APIRouter(prefix="/internal", tags=["internal"])
settings = get_settings()


def _check_key(authorization: str = Header(...)) -> None:
    if authorization != f"Bearer {settings.internal_api_key}":
        raise HTTPException(status_code=401, detail="Ungültiger interner API-Key")


class HeartbeatRequest(BaseModel):
    tenant_id: str
    status: str  # online | offline | connecting | error
    error_message: str | None = None
    stream_live: bool = False
    reconnect_attempts: int = 0


class FilterHitRequest(BaseModel):
    tenant_id: str
    filter_type: str  # chat | name
    filter_id: str
    twitch_user_id: str
    twitch_username: str
    message_text: str | None = None
    matched_term: str | None = None
    action_taken: str | None = None
    test_mode: bool = False


@router.post("/heartbeat")
async def heartbeat(
    data: HeartbeatRequest,
    _: None = Depends(_check_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotInstance).where(BotInstance.tenant_id == data.tenant_id)
    )
    instance = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if instance is None:
        instance = BotInstance(
            tenant_id=data.tenant_id,
            status=data.status,
            last_heartbeat=now,
            stream_live=data.stream_live,
            reconnect_attempts=data.reconnect_attempts,
        )
        db.add(instance)
    else:
        instance.status = data.status
        instance.last_heartbeat = now
        instance.stream_live = data.stream_live
        instance.reconnect_attempts = data.reconnect_attempts
        if data.error_message:
            instance.error_message = data.error_message
        if data.status == "online" and instance.connected_at is None:
            instance.connected_at = now

    await db.commit()

    # Redis Pub/Sub: Admin informieren
    redis = await get_redis()
    await redis.publish(
        "tcb:admin",
        json.dumps({
            "type": "bot_status",
            "tenant_id": data.tenant_id,
            "status": data.status,
            "stream_live": data.stream_live,
            "reconnect_attempts": data.reconnect_attempts,
        }),
    )
    return {"ok": True}


@router.post("/filter-hit")
async def filter_hit(
    data: FilterHitRequest,
    _: None = Depends(_check_key),
    db: AsyncSession = Depends(get_db),
):
    """Bot meldet einen Filter-Treffer — Logging in DB + WS-Event."""
    from ..models.chat_filter import ChatFilterHit
    from ..models.name_filter import NameFilter

    if data.filter_type == "chat":
        hit = ChatFilterHit(
            filter_id=data.filter_id,
            twitch_user_id=data.twitch_user_id,
            twitch_username=data.twitch_username,
            message_text=data.message_text,
            matched_term=data.matched_term,
            action_taken=data.action_taken,
            test_mode=data.test_mode,
        )
        db.add(hit)
        await db.commit()

    redis = await get_redis()
    await redis.publish(
        "tcb:tenants",
        json.dumps({
            "type": "filter_hit",
            "tenant_id": data.tenant_id,
            "filter_type": data.filter_type,
            "twitch_username": data.twitch_username,
            "action_taken": data.action_taken,
            "test_mode": data.test_mode,
        }),
    )
    return {"ok": True}


@router.get("/tenant/{tenant_id}/config")
async def get_tenant_config(
    tenant_id: str,
    _: None = Depends(_check_key),
    db: AsyncSession = Depends(get_db),
):
    """Bot-Manager holt Konfiguration für eine Tenant-Instanz."""
    from ..models.chat_filter import ChatFilter, ChatFilterTerm, ChatFilterTier
    from ..models.name_filter import NameFilter, NameFilterPattern, NameFilterTier
    from ..models.ban import Ban
    from ..models.twitch_user import TenantUserExclusion, GlobalUserExclusion
    from ..models.settings import AppSettings
    from ..core.security import decrypt_value

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)

    # App-Einstellungen für Bot-Credentials
    cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = cfg_result.scalar_one_or_none()

    # Bot-Credentials bestimmen (own > shared)
    if tenant.bot_mode == "own_full" and tenant.own_bot_token_enc:
        bot_token = decrypt_value(tenant.own_bot_token_enc)
        client_id = decrypt_value(tenant.own_client_id_enc) if tenant.own_client_id_enc else None
        bot_username = tenant.own_bot_username
    elif tenant.bot_mode in ("own_bot", "own_full") and tenant.own_bot_token_enc:
        bot_token = decrypt_value(tenant.own_bot_token_enc)
        client_id = decrypt_value(app_cfg.client_id_enc) if app_cfg and app_cfg.client_id_enc else None
        bot_username = tenant.own_bot_username
    else:
        bot_token = decrypt_value(app_cfg.bot_token_enc) if app_cfg and app_cfg.bot_token_enc else None
        client_id = decrypt_value(app_cfg.client_id_enc) if app_cfg and app_cfg.client_id_enc else None
        bot_username = app_cfg.bot_username if app_cfg else None

    # Chat-Filter laden
    cf_result = await db.execute(
        select(ChatFilter).where(ChatFilter.tenant_id == tenant_id, ChatFilter.enabled.is_(True))
    )
    chat_filters = cf_result.scalars().all()
    chat_filter_data = []
    for cf in chat_filters:
        terms_result = await db.execute(select(ChatFilterTerm).where(ChatFilterTerm.filter_id == cf.id))
        tiers_result = await db.execute(select(ChatFilterTier).where(ChatFilterTier.filter_id == cf.id))
        chat_filter_data.append({
            "id": str(cf.id),
            "name": cf.name,
            "case_sensitive": cf.case_sensitive,
            "test_mode": cf.test_mode,
            "priority": cf.priority,
            "terms": [{"term": t.term, "is_regex": t.is_regex, "is_whitelist": t.is_whitelist} for t in terms_result.scalars().all()],
            "tiers": [{"tier_order": t.tier_order, "threshold": t.threshold, "window_minutes": t.window_minutes, "action": t.action, "duration_seconds": t.duration_seconds, "message_template": t.message_template} for t in sorted(tiers_result.scalars().all(), key=lambda x: x.tier_order)],
        })

    # Name-Filter laden
    nf_result = await db.execute(
        select(NameFilter).where(NameFilter.tenant_id == tenant_id, NameFilter.enabled.is_(True))
    )
    name_filters = nf_result.scalars().all()
    name_filter_data = []
    for nf in name_filters:
        patterns_result = await db.execute(select(NameFilterPattern).where(NameFilterPattern.filter_id == nf.id))
        name_filter_data.append({
            "id": str(nf.id),
            "name": nf.name,
            "test_mode": nf.test_mode,
            "priority": nf.priority,
            "patterns": [{"pattern": p.pattern, "is_regex": p.is_regex, "is_whitelist": p.is_whitelist} for p in patterns_result.scalars().all()],
        })

    return {
        "tenant_id": str(tenant.id),
        "channel_name": tenant.channel_name,
        "bot_token": bot_token,
        "client_id": client_id,
        "bot_username": bot_username,
        "reconnect_mode": tenant.reconnect_mode,
        "reconnect_max_attempts": tenant.reconnect_max_attempts,
        "bot_language": tenant.bot_language,
        "chat_filters": chat_filter_data,
        "name_filters": name_filter_data,
    }


class UnbanNotificationRequest(BaseModel):
    tenant_id: str
    twitch_user_id: str
    twitch_username: str | None = None
    reason: str | None = None  # Optional: "!unban command" | "twitch_unban"


@router.post("/unban-notification")
async def unban_notification(
    data: UnbanNotificationRequest,
    _: None = Depends(_check_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Bot meldet, dass ein User manuell entbannt wurde.
    Setzt failover_protected=True für alle aktiven Bans dieses Users im Tenant,
    damit er nicht erneut automatisch gebannt wird.
    """
    from ..models.ban import Ban

    result = await db.execute(
        select(Ban).where(
            Ban.tenant_id == data.tenant_id,
            Ban.twitch_user_id == data.twitch_user_id,
            Ban.failover_protected.is_(False),
        )
    )
    bans = result.scalars().all()
    for ban in bans:
        ban.failover_protected = True

    await db.commit()

    return {"ok": True, "protected": len(bans)}
