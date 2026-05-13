from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user, require_admin
from ..core.security import decrypt_value, encrypt_value
from ..models.tenant import Tenant, TenantModerator, AuditLog, BotInstance
from ..models.user import User

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _can_access_tenant(user: User, tenant: Tenant) -> bool:
    return user.role == "admin" or str(tenant.user_id) == str(user.id)


async def _get_tenant_or_403(tenant_id: str, user: User, db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if not _can_access_tenant(user, tenant):
        # Moderator-Check
        mod_result = await db.execute(
            select(TenantModerator).where(
                TenantModerator.tenant_id == tenant_id,
                TenantModerator.twitch_user_id == user.twitch_id,
                TenantModerator.revoked_at.is_(None),
            )
        )
        if not mod_result.scalar_one_or_none():
            raise HTTPException(status_code=403)
    return tenant


# ── Tenant CRUD ──────────────────────────────────────────────

class TenantCreate(BaseModel):
    channel_name: str
    display_name: str | None = None


class TenantSettingsUpdate(BaseModel):
    display_name: str | None = None
    bot_mode: str | None = None
    own_bot_username: str | None = None
    own_bot_token: str | None = None
    own_client_id: str | None = None
    own_client_secret: str | None = None
    stream_awareness: bool | None = None
    bot_language: str | None = None
    reconnect_mode: str | None = None
    reconnect_max_attempts: int | None = None
    retention_days: int | None = None
    new_mod_default_role: str | None = None


@router.get("")
async def list_tenants(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "admin":
        result = await db.execute(select(Tenant).order_by(desc(Tenant.created_at)))
    else:
        # eigene Tenants + Moderator-Zugänge
        own = await db.execute(select(Tenant).where(Tenant.user_id == current_user.id))
        return [_tenant_dict(t) for t in own.scalars().all()]
    return [_tenant_dict(t) for t in result.scalars().all()]


@router.post("")
async def create_tenant(
    data: TenantCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    # Doppeltes Channel prüfen
    existing = await db.execute(
        select(Tenant).where(Tenant.channel_name == data.channel_name.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Channel bereits registriert")

    from datetime import datetime, timezone
    tenant = Tenant(
        user_id=current_user.id,
        channel_name=data.channel_name.lower().strip(),
        display_name=data.display_name or data.channel_name,
        approved=current_user.role == "admin",  # Admin braucht keine Genehmigung
        approval_requested_at=datetime.now(timezone.utc) if current_user.role != "admin" else None,
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    # Admin benachrichtigen wenn Genehmigung nötig
    if current_user.role != "admin":
        from ..models.notification import Notification
        from ..models.user import User as UserModel
        admin_result = await db.execute(
            select(UserModel).where(UserModel.role == "admin", UserModel.soft_delete_at.is_(None))
        )
        admin = admin_result.scalar_one_or_none()
        if admin:
            notif = Notification(
                user_id=admin.id,
                type="tenant_request",
                title=f"Neue Tenant-Anfrage: {tenant.channel_name}",
                body=f"{current_user.display_name or current_user.twitch_username} möchte '{tenant.channel_name}' registrieren.",
            )
            db.add(notif)
            await db.commit()

    return _tenant_dict(tenant)


@router.get("/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    return _tenant_dict(tenant)


@router.get("/{tenant_id}/settings")
async def get_tenant_settings(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    return {
        "display_name": tenant.display_name,
        "bot_mode": tenant.bot_mode,
        "own_bot_username": tenant.own_bot_username,
        "own_bot_token_set": bool(tenant.own_bot_token_enc),
        "own_client_id_set": bool(tenant.own_client_id_enc),
        "own_client_secret_set": bool(tenant.own_client_secret_enc),
        "stream_awareness": tenant.stream_awareness,
        "bot_language": tenant.bot_language,
        "reconnect_mode": tenant.reconnect_mode,
        "reconnect_max_attempts": tenant.reconnect_max_attempts,
        "retention_days": tenant.retention_days,
        "new_mod_default_role": tenant.new_mod_default_role,
    }


@router.patch("/{tenant_id}/settings")
async def update_tenant_settings(
    tenant_id: str,
    data: TenantSettingsUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if not _can_access_tenant(current_user, tenant):
        raise HTTPException(status_code=403)

    if data.display_name is not None:
        tenant.display_name = data.display_name
    if data.bot_mode is not None and data.bot_mode in ("shared", "own_bot", "own_full"):
        tenant.bot_mode = data.bot_mode
    if data.own_bot_username is not None:
        tenant.own_bot_username = data.own_bot_username
    if data.own_bot_token is not None:
        tenant.own_bot_token_enc = encrypt_value(data.own_bot_token)
    if data.own_client_id is not None:
        tenant.own_client_id_enc = encrypt_value(data.own_client_id)
    if data.own_client_secret is not None:
        tenant.own_client_secret_enc = encrypt_value(data.own_client_secret)
    if data.stream_awareness is not None:
        tenant.stream_awareness = data.stream_awareness
    if data.bot_language is not None and data.bot_language in ("de", "en"):
        tenant.bot_language = data.bot_language
    if data.reconnect_mode is not None:
        tenant.reconnect_mode = data.reconnect_mode
    if data.reconnect_max_attempts is not None:
        tenant.reconnect_max_attempts = max(1, min(100, data.reconnect_max_attempts))
    if data.retention_days is not None:
        tenant.retention_days = max(1, min(730, data.retention_days))
    if data.new_mod_default_role is not None and data.new_mod_default_role in ("editor", "viewer"):
        tenant.new_mod_default_role = data.new_mod_default_role

    await db.commit()
    return {"ok": True}


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if not _can_access_tenant(current_user, tenant):
        raise HTTPException(status_code=403)
    await db.delete(tenant)
    await db.commit()
    return {"ok": True}


# ── Admin: Tenant genehmigen ──────────────────────────────────

@router.post("/{tenant_id}/approve")
async def approve_tenant(
    tenant_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    tenant.approved = True
    await db.commit()

    # Owner benachrichtigen
    from ..models.notification import Notification
    notif = Notification(
        user_id=tenant.user_id,
        type="tenant_approved",
        title=f"Tenant genehmigt: {tenant.channel_name}",
        body="Deine Anfrage wurde genehmigt. Du kannst den Bot jetzt verbinden.",
    )
    db.add(notif)
    await db.commit()
    return {"ok": True}


@router.post("/{tenant_id}/reject")
async def reject_tenant(
    tenant_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    from ..models.notification import Notification
    notif = Notification(
        user_id=tenant.user_id,
        type="tenant_rejected",
        title=f"Tenant abgelehnt: {tenant.channel_name}",
        body="Deine Anfrage wurde abgelehnt. Bitte wende dich an den Administrator.",
    )
    db.add(notif)
    await db.delete(tenant)
    await db.commit()
    return {"ok": True}


@router.post("/{tenant_id}/revoke")
async def revoke_tenant(
    tenant_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    tenant.approved = False
    await db.commit()
    return {"ok": True}


# ── Bot-Instanz Steuerung ─────────────────────────────────────

@router.post("/{tenant_id}/bot/start")
async def start_bot(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    from ..core.config import get_settings
    from ..models.settings import AppSettings
    import httpx
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    if not tenant.approved:
        raise HTTPException(status_code=400, detail="Tenant noch nicht genehmigt")

    # Check that the required bot token is configured
    bot_mode = tenant.bot_mode or "shared"
    if bot_mode in ("own_bot", "own_full"):
        if not tenant.own_bot_token_enc:
            raise HTTPException(
                status_code=400,
                detail="Kein eigener Bot-Token konfiguriert. Bitte erst in Einstellungen → Eigener Bot den Token eintragen."
            )
    else:
        # shared mode — check global app settings
        cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        app_cfg = cfg_result.scalar_one_or_none()
        if not app_cfg or not app_cfg.bot_token_enc:
            raise HTTPException(
                status_code=400,
                detail="Kein Shared-Bot-Token konfiguriert. Bitte erst in Admin → Einstellungen den Bot OAuth-Token eintragen."
            )

    s = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{s.bot_manager_url}/instances/start",
            json={"tenant_id": str(tenant.id), "channel": tenant.channel_name, "bot_username": ""},
        )
    if resp.status_code not in (200, 409):
        raise HTTPException(status_code=500, detail="Bot-Manager Fehler")
    return {"ok": True}


@router.post("/{tenant_id}/bot/stop")
async def stop_bot(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    from ..core.config import get_settings
    import httpx
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    s = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{s.bot_manager_url}/instances/stop",
            json={"tenant_id": str(tenant.id), "channel": tenant.channel_name},
        )
    if resp.status_code not in (200, 404):
        raise HTTPException(status_code=500, detail="Bot-Manager Fehler")
    return {"ok": True}


@router.get("/{tenant_id}/bot/status")
async def get_bot_status(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _get_tenant_or_403(tenant_id, current_user, db)
    result = await db.execute(
        select(BotInstance).where(BotInstance.tenant_id == tenant_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        return {"status": "offline", "last_heartbeat": None}
    return {
        "status": instance.status,
        "last_heartbeat": instance.last_heartbeat,
        "error_message": instance.error_message,
        "connected_at": instance.connected_at,
        "stream_live": instance.stream_live,
        "reconnect_attempts": instance.reconnect_attempts,
    }


# ── Moderatoren ───────────────────────────────────────────────

class ModAdd(BaseModel):
    twitch_user_id: str
    twitch_username: str
    role: str = "viewer"


@router.get("/{tenant_id}/moderators")
async def list_moderators(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _get_tenant_or_403(tenant_id, current_user, db)
    result = await db.execute(
        select(TenantModerator).where(
            TenantModerator.tenant_id == tenant_id,
            TenantModerator.revoked_at.is_(None),
        )
    )
    mods = result.scalars().all()
    return [{"id": str(m.id), "twitch_user_id": m.twitch_user_id, "twitch_username": m.twitch_username, "role": m.role, "granted_at": m.granted_at} for m in mods]


@router.post("/{tenant_id}/moderators")
async def add_moderator(
    tenant_id: str,
    data: ModAdd,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    if not _can_access_tenant(current_user, tenant):
        raise HTTPException(status_code=403)
    mod = TenantModerator(
        tenant_id=tenant_id,
        twitch_user_id=data.twitch_user_id,
        twitch_username=data.twitch_username,
        role=data.role if data.role in ("editor", "viewer") else "viewer",
        granted_by=current_user.id,
    )
    db.add(mod)
    await db.commit()
    await db.refresh(mod)
    return {"id": str(mod.id), "ok": True}


@router.delete("/{tenant_id}/moderators/{mod_id}")
async def remove_moderator(
    tenant_id: str,
    mod_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    if not _can_access_tenant(current_user, tenant):
        raise HTTPException(status_code=403)
    result = await db.execute(
        select(TenantModerator).where(TenantModerator.id == mod_id, TenantModerator.tenant_id == tenant_id)
    )
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404)
    mod.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


# ── Audit-Log ─────────────────────────────────────────────────

@router.get("/{tenant_id}/audit")
async def get_audit_log(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
    action: str = "",
):
    await _get_tenant_or_403(tenant_id, current_user, db)
    query = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    result = await db.execute(
        query.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
    )
    logs = result.scalars().all()

    # Resolve actor usernames
    actor_ids = [l.actor_id for l in logs if l.actor_id]
    actor_map: dict = {}
    if actor_ids:
        user_result = await db.execute(
            select(User).where(User.id.in_(actor_ids))
        )
        for u in user_result.scalars().all():
            actor_map[str(u.id)] = u.twitch_username or u.display_name or str(u.id)

    items = [
        {
            "id": str(l.id),
            "actor_id": str(l.actor_id) if l.actor_id else None,
            "actor_username": actor_map.get(str(l.actor_id)) if l.actor_id else None,
            "action": l.action,
            "detail": l.detail_json,
            "created_at": l.created_at,
        }
        for l in logs
    ]
    return {"items": items, "total": total}


# ── Dashboard-Widgets ─────────────────────────────────────────

class WidgetUpdate(BaseModel):
    config_json: dict


@router.get("/{tenant_id}/widgets")
async def get_widgets(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    from ..models.tenant import BotInstance
    await _get_tenant_or_403(tenant_id, current_user, db)
    from sqlalchemy import text
    result = await db.execute(
        select(text("*")).select_from(
            text("dashboard_widget_configs")
        ).where(text(f"user_id = '{current_user.id}' AND tenant_id = '{tenant_id}'"))
    )
    # Fallback: leere Default-Konfiguration
    return {"config_json": None}


@router.put("/{tenant_id}/widgets")
async def save_widgets(
    tenant_id: str,
    data: WidgetUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _get_tenant_or_403(tenant_id, current_user, db)
    # Upsert via raw SQL für dashboard_widget_configs
    from sqlalchemy import text
    await db.execute(
        text("""
            INSERT INTO dashboard_widget_configs (user_id, tenant_id, config_json)
            VALUES (:user_id, :tenant_id, :config)
            ON CONFLICT (user_id, tenant_id) DO UPDATE SET config_json = EXCLUDED.config_json
        """),
        {"user_id": str(current_user.id), "tenant_id": tenant_id, "config": data.config_json},
    )
    await db.commit()
    return {"ok": True}


# ── Admin-Instanzübersicht ────────────────────────────────────

@router.get("/admin/instances")
async def admin_bot_instances(
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tenant, BotInstance)
        .outerjoin(BotInstance, Tenant.id == BotInstance.tenant_id)
    )
    rows = result.all()
    return [
        {
            "tenant_id": str(row.Tenant.id),
            "channel_name": row.Tenant.channel_name,
            "approved": row.Tenant.approved,
            "status": row.BotInstance.status if row.BotInstance else "offline",
            "last_heartbeat": row.BotInstance.last_heartbeat if row.BotInstance else None,
            "error_message": row.BotInstance.error_message if row.BotInstance else None,
            "stream_live": row.BotInstance.stream_live if row.BotInstance else False,
        }
        for row in rows
    ]


# ── Datenexport ───────────────────────────────────────────────

@router.get("/{tenant_id}/export")
async def export_tenant_data(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """JSON-Export aller Tenant-Daten."""
    tenant = await _get_tenant_or_403(tenant_id, current_user, db)
    from ..models.ban import Ban
    from ..models.chat_filter import ChatFilter
    from ..models.name_filter import NameFilter

    bans_result = await db.execute(select(Ban).where(Ban.tenant_id == tenant_id))
    cf_result = await db.execute(select(ChatFilter).where(ChatFilter.tenant_id == tenant_id))
    nf_result = await db.execute(select(NameFilter).where(NameFilter.tenant_id == tenant_id))

    return {
        "tenant": _tenant_dict(tenant),
        "bans": [{"twitch_user_id": b.twitch_user_id, "type": b.type, "reason": b.reason} for b in bans_result.scalars().all()],
        "chat_filters": [{"name": f.name, "enabled": f.enabled} for f in cf_result.scalars().all()],
        "name_filters": [{"name": f.name, "enabled": f.enabled} for f in nf_result.scalars().all()],
    }


def _tenant_dict(t: Tenant) -> dict:
    return {
        "id": str(t.id),
        "user_id": str(t.user_id),
        "channel_name": t.channel_name,
        "display_name": t.display_name,
        "bot_mode": t.bot_mode,
        "stream_awareness": t.stream_awareness,
        "bot_language": t.bot_language,
        "reconnect_mode": t.reconnect_mode,
        "retention_days": t.retention_days,
        "regex_enabled": t.regex_enabled,
        "new_mod_default_role": t.new_mod_default_role,
        "approved": t.approved,
        "stream_live": t.stream_live,
        "created_at": t.created_at,
    }
