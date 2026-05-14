from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import require_admin, get_current_user
from ..core.security import encrypt_value, decrypt_value
from ..models.settings import AppSettings, LegalPage
from ..models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class SetupRequest(BaseModel):
    client_id: str
    client_secret: str
    bot_username: str | None = None
    bot_token: str | None = None


class AppSettingsUpdate(BaseModel):
    client_id: str | None = None
    client_secret: str | None = None
    bot_username: str | None = None
    bot_token: str | None = None
    bot_refresh_token: str | None = None
    global_retention_days: int | None = None
    maintenance_mode: bool | None = None
    maintenance_message: str | None = None
    global_timezone: str | None = None


class LegalPageUpdate(BaseModel):
    title_de: str | None = None
    title_en: str | None = None
    content_de: str | None = None
    content_en: str | None = None


# ── Setup-Wizard ─────────────────────────────────────────────

@router.get("/setup-status")
async def setup_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    cfg = result.scalar_one_or_none()
    return {"setup_completed": cfg.setup_completed if cfg else False}


@router.post("/setup")
async def complete_setup(
    data: SetupRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    cfg = result.scalar_one_or_none()

    if cfg and cfg.setup_completed:
        raise HTTPException(status_code=400, detail="Setup bereits abgeschlossen")

    if not cfg:
        cfg = AppSettings(id=1)
        db.add(cfg)

    cfg.client_id_enc = encrypt_value(data.client_id)
    cfg.client_secret_enc = encrypt_value(data.client_secret)
    if data.bot_username:
        cfg.bot_username = data.bot_username
    if data.bot_token:
        cfg.bot_token_enc = encrypt_value(data.bot_token)
    cfg.setup_completed = True
    await db.commit()
    return {"ok": True}


# ── App-Einstellungen ─────────────────────────────────────────

@router.get("/settings")
async def get_app_settings(
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404)

    return {
        "client_id_set": bool(cfg.client_id_enc),
        "client_secret_set": bool(cfg.client_secret_enc),
        "bot_username": cfg.bot_username,
        "bot_token_set": bool(cfg.bot_token_enc),
        "bot_refresh_token_set": bool(cfg.bot_refresh_token_enc),
        "bot_user_id": cfg.bot_user_id,
        "global_retention_days": cfg.global_retention_days,
        "maintenance_mode": cfg.maintenance_mode,
        "maintenance_message": cfg.maintenance_message,
        "global_timezone": cfg.global_timezone,
        "setup_completed": cfg.setup_completed,
    }


@router.patch("/settings")
async def update_app_settings(
    data: AppSettingsUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404)

    if data.client_id is not None:
        cfg.client_id_enc = encrypt_value(data.client_id)
    if data.client_secret is not None:
        cfg.client_secret_enc = encrypt_value(data.client_secret)
    if data.bot_username is not None:
        cfg.bot_username = data.bot_username
    if data.bot_token is not None:
        cfg.bot_token_enc = encrypt_value(data.bot_token)
    if data.bot_refresh_token is not None:
        cfg.bot_refresh_token_enc = encrypt_value(data.bot_refresh_token)
    if data.global_retention_days is not None:
        cfg.global_retention_days = max(1, min(730, data.global_retention_days))
    if data.maintenance_mode is not None:
        cfg.maintenance_mode = data.maintenance_mode
    if data.maintenance_message is not None:
        cfg.maintenance_message = data.maintenance_message
    if data.global_timezone is not None:
        cfg.global_timezone = data.global_timezone

    await db.commit()
    return {"ok": True}


# ── Legal Pages ───────────────────────────────────────────────

@router.get("/legal/{slug}")
async def get_legal_page(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LegalPage).where(LegalPage.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Seite nicht gefunden")
    return {
        "slug": page.slug,
        "title_de": page.title_de,
        "title_en": page.title_en,
        "content_de": page.content_de,
        "content_en": page.content_en,
        "updated_at": page.updated_at,
    }


@router.put("/legal/{slug}")
async def update_legal_page(
    slug: str,
    data: LegalPageUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LegalPage).where(LegalPage.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404)

    if data.title_de is not None:
        page.title_de = data.title_de
    if data.title_en is not None:
        page.title_en = data.title_en
    if data.content_de is not None:
        page.content_de = data.content_de
    if data.content_en is not None:
        page.content_en = data.content_en
    page.updated_by = admin.id

    await db.commit()
    return {"ok": True}


# ── User-Management ───────────────────────────────────────────

@router.get("/users")
async def list_users(
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.soft_delete_at.is_(None)))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "twitch_username": u.twitch_username,
            "display_name": u.display_name,
            "role": u.role,
            "is_banned": u.is_banned,
            "ban_reason": u.ban_reason,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    reason: str = "",
    admin: Annotated[User, Depends(require_admin)] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin kann nicht gesperrt werden")
    user.is_banned = True
    user.ban_reason = reason
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)
    user.is_banned = False
    user.ban_reason = None
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/kick")
async def kick_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Session des Users invalidieren (Kick = erzwungenes Relogin)."""
    from ..models.session import Session as DBSession
    result = await db.execute(select(DBSession).where(DBSession.user_id == user_id))
    sessions = result.scalars().all()
    for s in sessions:
        await db.delete(s)
    await db.commit()
    return {"ok": True, "sessions_invalidated": len(sessions)}


# ── Profil-Einstellungen (eigener User) ──────────────────────

@router.patch("/profile")
async def update_profile(
    dark_mode: bool | None = None,
    language: str | None = None,
    timezone: str | None = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)

    if dark_mode is not None:
        user.dark_mode = dark_mode
    if language is not None and language in ("de", "en"):
        user.language = language
    if timezone is not None:
        user.timezone = timezone

    await db.commit()
    return {"ok": True}


# ── Moderator-Check ───────────────────────────────────────────

@router.post("/mod-check", dependencies=[Depends(require_admin)])
async def trigger_mod_check():
    """Löst manuell einen vollständigen Moderator-Check für alle Tenants aus."""
    from ..tasks.mod_check import run_mod_check
    import asyncio
    asyncio.create_task(run_mod_check())
    return {"ok": True, "message": "Mod-Check wird im Hintergrund ausgeführt"}


@router.post("/test-credentials", dependencies=[Depends(require_admin)])
async def test_credentials(db: AsyncSession = Depends(get_db)):
    """Prüft ob die gespeicherten Twitch-Credentials (App-Access-Token) funktionieren."""
    from ..core.twitch_client import get_app_access_token, validate_token
    from ..core.security import decrypt_value

    cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = cfg_result.scalar_one_or_none()
    if not app_cfg or not app_cfg.client_id_enc or not app_cfg.client_secret_enc:
        return {"ok": False, "error": "Keine Credentials gespeichert"}

    client_id = decrypt_value(app_cfg.client_id_enc)
    client_secret = decrypt_value(app_cfg.client_secret_enc)

    token = await get_app_access_token(client_id, client_secret)
    if not token:
        return {"ok": False, "error": "App-Access-Token konnte nicht abgerufen werden"}

    validated = await validate_token(token)
    if not validated:
        return {"ok": False, "error": "Token-Validierung fehlgeschlagen"}

    return {
        "ok": True,
        "client_id": client_id[:6] + "…",
        "expires_in": validated.get("expires_in"),
        "scopes": validated.get("scopes", []),
    }


@router.post("/test-bot-token", dependencies=[Depends(require_admin)])
async def test_bot_token(db: AsyncSession = Depends(get_db)):
    """Prüft ob der gespeicherte Bot-OAuth-Token gültig ist und erneuert ihn ggf. automatisch."""
    from ..core.twitch_client import validate_token, refresh_user_token
    from ..core.security import decrypt_value, encrypt_value

    cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = cfg_result.scalar_one_or_none()
    if not app_cfg or not app_cfg.bot_token_enc:
        return {"ok": False, "error": "Kein Bot-Token gespeichert"}

    bot_token = decrypt_value(app_cfg.bot_token_enc)
    validated = await validate_token(bot_token)

    token_refreshed = False
    # Token abgelaufen oder ungültig → Refresh versuchen
    if not validated or validated.get("expires_in", 1) == 0:
        if not app_cfg.bot_refresh_token_enc:
            return {"ok": False, "error": "Token abgelaufen – kein Refresh-Token gespeichert. Bitte neuen Token generieren."}
        if not app_cfg.client_id_enc or not app_cfg.client_secret_enc:
            return {"ok": False, "error": "Token abgelaufen – keine App-Credentials (Client ID/Secret) gespeichert. Bitte zuerst die Twitch-App-Daten eintragen."}
        client_id = decrypt_value(app_cfg.client_id_enc)
        client_secret = decrypt_value(app_cfg.client_secret_enc)
        refresh_tok = decrypt_value(app_cfg.bot_refresh_token_enc)
        refreshed = await refresh_user_token(client_id, client_secret, refresh_tok)
        if refreshed and refreshed.get("access_token"):
            app_cfg.bot_token_enc = encrypt_value(refreshed["access_token"])
            if refreshed.get("refresh_token"):
                app_cfg.bot_refresh_token_enc = encrypt_value(refreshed["refresh_token"])
            await db.commit()
            validated = await validate_token(refreshed["access_token"])
            token_refreshed = True
        else:
            return {"ok": False, "error": "Token abgelaufen – automatischer Refresh fehlgeschlagen. Bitte neuen Token generieren."}

    if not validated:
        return {"ok": False, "error": "Token ungültig – bitte neuen Token generieren"}
    if validated.get("expires_in", 1) == 0:
        return {"ok": False, "error": "Token abgelaufen – bitte neuen Token generieren"}

    return {
        "ok": True,
        "login": validated.get("login"),
        "expires_in": validated.get("expires_in"),
        "scopes": validated.get("scopes", []),
        "refreshed": token_refreshed,
    }
