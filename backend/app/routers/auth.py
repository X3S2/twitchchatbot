import secrets
import time
from datetime import datetime, timezone
from typing import Annotated
from urllib.parse import quote
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.config import get_settings
from ..core.database import get_db
from ..core.security import create_access_token, create_refresh_token, decode_token
from ..core.deps import get_current_user, require_admin
from ..models.user import User
from ..models.settings import AppSettings
from ..models.tenant import Tenant

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_USERS_URL = "https://api.twitch.tv/helix/users"
TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"

SCOPES = "user:read:email"
BOT_SCOPES = "chat:read chat:edit channel:moderate moderator:manage:banned_users moderator:manage:warnings"

# Kurzlebiger State-Speicher für Bot-OAuth-Flow (max 5 Minuten)
_pending_bot_oauth: dict[str, float] = {}  # state -> unix-timestamp
# Tenant-Bot-OAuth-Flow: state -> (tenant_id, unix-timestamp)
_pending_tenant_bot_oauth: dict[str, tuple[str, float]] = {}


def _cleanup_bot_states() -> None:
    """Entfernt abgelaufene Bot-OAuth-States (> 5 Minuten)."""
    cutoff = time.time() - 300
    expired = [k for k, v in _pending_bot_oauth.items() if v < cutoff]
    for k in expired:
        del _pending_bot_oauth[k]
    expired_t = [k for k, (_, ts) in _pending_tenant_bot_oauth.items() if ts < cutoff]
    for k in expired_t:
        del _pending_tenant_bot_oauth[k]


def _redirect_uri() -> str:
    return f"{settings.app_public_url}/auth/callback"


@router.get("/bot-oauth/start")
async def bot_oauth_start(
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Startet den OAuth-Flow zur Generierung eines Bot-Tokens mit eigenen App-Credentials."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = result.scalar_one_or_none()
    if not app_cfg or not app_cfg.client_id_enc:
        raise HTTPException(
            status_code=400,
            detail="Keine Client-ID konfiguriert. Bitte zuerst die Twitch-App-Daten eintragen.",
        )
    from ..core.security import decrypt_value
    client_id = decrypt_value(app_cfg.client_id_enc)
    if not client_id:
        raise HTTPException(status_code=400, detail="Client-ID konnte nicht entschlüsselt werden.")

    state = "bot_" + secrets.token_urlsafe(24)
    _pending_bot_oauth[state] = time.time()
    _cleanup_bot_states()

    auth_url = (
        f"{TWITCH_AUTH_URL}"
        f"?client_id={client_id}"
        f"&redirect_uri={_redirect_uri()}"
        f"&response_type=code"
        f"&scope={quote(BOT_SCOPES)}"
        f"&state={state}"
        f"&force_verify=true"
    )
    return {"auth_url": auth_url}


async def _handle_bot_token_callback(code: str, db: AsyncSession) -> RedirectResponse:
    """Tauscht den OAuth-Code gegen Bot-Tokens und speichert sie in AppSettings."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = result.scalar_one_or_none()
    if not app_cfg:
        return RedirectResponse(url="/admin/settings?bot_oauth_error=config_missing")

    from ..core.security import decrypt_value, encrypt_value
    client_id = decrypt_value(app_cfg.client_id_enc)
    client_secret = decrypt_value(app_cfg.client_secret_enc)
    if not client_id or not client_secret:
        return RedirectResponse(url="/admin/settings?bot_oauth_error=credentials_missing")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            TWITCH_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri(),
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(url="/admin/settings?bot_oauth_error=token_exchange")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not access_token:
            return RedirectResponse(url="/admin/settings?bot_oauth_error=no_token")

        # Bot-Account-Name ermitteln
        bot_login = None
        validate_resp = await client.get(
            TWITCH_VALIDATE_URL,
            headers={"Authorization": f"OAuth {access_token}"},
        )
        if validate_resp.status_code == 200:
            bot_login = validate_resp.json().get("login")

    app_cfg.bot_token_enc = encrypt_value(access_token)
    if refresh_token:
        app_cfg.bot_refresh_token_enc = encrypt_value(refresh_token)
    if bot_login:
        app_cfg.bot_username = bot_login
    await db.commit()

    return RedirectResponse(url="/admin/settings?bot_oauth_success=1")


@router.get("/tenant-bot-oauth/start")
async def tenant_bot_oauth_start(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Startet den OAuth-Flow für einen Tenant-eigenen Bot-Token."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant nicht gefunden")
    if current_user.role != "admin" and str(tenant.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    if tenant.bot_mode == "shared":
        raise HTTPException(status_code=400, detail="Im Shared-Bot-Modus wird kein eigener Token benötigt.")

    from ..core.security import decrypt_value
    if tenant.bot_mode == "own_full":
        if not tenant.own_client_id_enc:
            raise HTTPException(status_code=400, detail="Zuerst eigene Client-ID eintragen und speichern.")
        client_id = decrypt_value(tenant.own_client_id_enc)
        if not client_id:
            raise HTTPException(status_code=400, detail="Client-ID konnte nicht entschlüsselt werden.")
    else:
        # own_bot: globale App-Credentials verwenden
        cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        app_cfg = cfg_result.scalar_one_or_none()
        if not app_cfg or not app_cfg.client_id_enc:
            raise HTTPException(status_code=400, detail="Globale Client-ID fehlt. Admin muss zuerst die Twitch-App konfigurieren.")
        client_id = decrypt_value(app_cfg.client_id_enc)
        if not client_id:
            raise HTTPException(status_code=400, detail="Globale Client-ID konnte nicht entschlüsselt werden.")

    state = "tbot_" + secrets.token_urlsafe(24)
    _pending_tenant_bot_oauth[state] = (str(tenant_id), time.time())
    _cleanup_bot_states()

    auth_url = (
        f"{TWITCH_AUTH_URL}"
        f"?client_id={client_id}"
        f"&redirect_uri={_redirect_uri()}"
        f"&response_type=code"
        f"&scope={quote(BOT_SCOPES)}"
        f"&state={state}"
        f"&force_verify=true"
    )
    return {"auth_url": auth_url}


async def _handle_tenant_bot_token_callback(code: str, tenant_id: str, db: AsyncSession) -> RedirectResponse:
    """Tauscht den OAuth-Code gegen Bot-Tokens und speichert sie im Tenant."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return RedirectResponse(url=f"/login?error=config_missing")

    from ..core.security import decrypt_value, encrypt_value
    redirect_base = f"/tenants/{tenant_id}/settings"

    if tenant.bot_mode == "own_full":
        client_id = decrypt_value(tenant.own_client_id_enc) if tenant.own_client_id_enc else None
        client_secret = decrypt_value(tenant.own_client_secret_enc) if tenant.own_client_secret_enc else None
    else:
        cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        app_cfg = cfg_result.scalar_one_or_none()
        client_id = decrypt_value(app_cfg.client_id_enc) if app_cfg and app_cfg.client_id_enc else None
        client_secret = decrypt_value(app_cfg.client_secret_enc) if app_cfg and app_cfg.client_secret_enc else None

    if not client_id or not client_secret:
        return RedirectResponse(url=f"{redirect_base}?bot_oauth_error=credentials_missing")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            TWITCH_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri(),
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(url=f"{redirect_base}?bot_oauth_error=token_exchange")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not access_token:
            return RedirectResponse(url=f"{redirect_base}?bot_oauth_error=no_token")

        bot_login = None
        validate_resp = await client.get(
            TWITCH_VALIDATE_URL,
            headers={"Authorization": f"OAuth {access_token}"},
        )
        if validate_resp.status_code == 200:
            bot_login = validate_resp.json().get("login")

    tenant.own_bot_token_enc = encrypt_value(access_token)
    if refresh_token:
        tenant.own_bot_refresh_token_enc = encrypt_value(refresh_token)
    if bot_login:
        tenant.own_bot_username = bot_login
    await db.commit()

    return RedirectResponse(url=f"{redirect_base}?bot_oauth_success=1")


@router.get("/login")
async def login(db: AsyncSession = Depends(get_db)):
    """Weiterleitung zur Twitch-OAuth-Seite."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = result.scalar_one_or_none()

    if not app_cfg or not app_cfg.setup_completed:
        raise HTTPException(status_code=400, detail="Setup nicht abgeschlossen")

    from ..core.security import decrypt_value
    client_id = decrypt_value(app_cfg.client_id_enc)
    if not client_id:
        raise HTTPException(status_code=400, detail="Client-ID nicht konfiguriert")

    state = secrets.token_urlsafe(32)
    auth_url = (
        f"{TWITCH_AUTH_URL}"
        f"?client_id={client_id}"
        f"&redirect_uri={_redirect_uri()}"
        f"&response_type=code"
        f"&scope={SCOPES}"
        f"&state={state}"
    )
    return {"auth_url": auth_url, "state": state}


@router.get("/callback")
async def callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """Verarbeitet den Twitch-OAuth-Callback und leitet zum Frontend weiter."""
    # Bot-OAuth-Flow: State in pending-Dict vorhanden → Bot-Token-Generierung
    if state in _pending_bot_oauth:
        if time.time() - _pending_bot_oauth[state] > 300:
            del _pending_bot_oauth[state]
            return RedirectResponse(url="/admin/settings?bot_oauth_error=state_expired")
        del _pending_bot_oauth[state]
        return await _handle_bot_token_callback(code, db)

    # Tenant-Bot-OAuth-Flow
    if state in _pending_tenant_bot_oauth:
        tenant_id, ts = _pending_tenant_bot_oauth[state]
        if time.time() - ts > 300:
            del _pending_tenant_bot_oauth[state]
            return RedirectResponse(url=f"/tenants/{tenant_id}/settings?bot_oauth_error=state_expired")
        del _pending_tenant_bot_oauth[state]
        return await _handle_tenant_bot_token_callback(code, tenant_id, db)

    # Normaler User-Login-Flow
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = result.scalar_one_or_none()
    if not app_cfg:
        return RedirectResponse(url="/login?error=config_missing")

    from ..core.security import decrypt_value
    client_id = decrypt_value(app_cfg.client_id_enc)
    client_secret = decrypt_value(app_cfg.client_secret_enc)

    if not client_id or not client_secret:
        return RedirectResponse(url="/login?error=not_configured")

    async with httpx.AsyncClient() as client:
        # Code gegen Token tauschen
        token_resp = await client.post(
            TWITCH_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri(),
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(url="/login?error=token_exchange_failed")

        token_data = token_resp.json()
        access_token = token_data["access_token"]

        # Twitch-Nutzerprofil abrufen
        user_resp = await client.get(
            TWITCH_USERS_URL,
            headers={"Authorization": f"Bearer {access_token}", "Client-Id": client_id},
        )
        if user_resp.status_code != 200:
            return RedirectResponse(url="/login?error=profile_fetch_failed")

        twitch_user = user_resp.json()["data"][0]

    twitch_id = twitch_user["id"]
    twitch_username = twitch_user["login"]
    display_name = twitch_user.get("display_name", twitch_username)
    avatar_url = twitch_user.get("profile_image_url")

    # User in DB suchen oder anlegen
    result = await db.execute(select(User).where(User.twitch_id == twitch_id))
    user = result.scalar_one_or_none()

    # Erster Login → Admin
    user_count_result = await db.execute(select(User))
    is_first_user = len(user_count_result.scalars().all()) == 0

    if user is None:
        user = User(
            twitch_id=twitch_id,
            twitch_username=twitch_username,
            display_name=display_name,
            avatar_url=avatar_url,
            role="admin" if is_first_user else "streamer",
        )
        db.add(user)
        await db.flush()
    else:
        if user.is_banned:
            return RedirectResponse(url="/login?error=banned")
        if user.soft_delete_at is not None:
            return RedirectResponse(url="/login?error=deleted")
        user.twitch_username = twitch_username
        user.display_name = display_name
        user.avatar_url = avatar_url

    await db.commit()
    await db.refresh(user)

    # JWT erstellen
    jwt_data = {"sub": str(user.id), "role": user.role}
    access_jwt = create_access_token(jwt_data)
    refresh_jwt, refresh_expires = create_refresh_token(jwt_data)

    # Session speichern
    from ..models.session import Session as DBSession
    db_session = DBSession(
        user_id=user.id,
        refresh_token=refresh_jwt,
        expires_at=refresh_expires,
    )
    db.add(db_session)
    await db.commit()

    # Cookies setzen + zum Dashboard weiterleiten
    is_prod = not settings.app_public_url.startswith("http://localhost")
    redirect = RedirectResponse(url="/", status_code=302)
    redirect.set_cookie("access_token", access_jwt, httponly=True, samesite="lax", secure=is_prod, max_age=60 * 15)
    redirect.set_cookie("refresh_token", refresh_jwt, httponly=True, samesite="lax", secure=is_prod, max_age=60 * 60 * 24 * 30)
    return redirect


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Access-Token via Refresh-Token erneuern."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Kein Refresh-Token")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Ungültiger Refresh-Token")

    from ..models.session import Session as DBSession
    result = await db.execute(
        select(DBSession).where(
            DBSession.refresh_token == refresh_token,
            DBSession.expires_at > datetime.now(timezone.utc),
        )
    )
    db_session = result.scalar_one_or_none()
    if not db_session:
        raise HTTPException(status_code=401, detail="Session abgelaufen")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.is_banned:
        raise HTTPException(status_code=401, detail="Ungültiger Nutzer")

    # Token rotieren
    jwt_data = {"sub": str(user.id), "role": user.role}
    new_access = create_access_token(jwt_data)
    new_refresh, new_expires = create_refresh_token(jwt_data)

    db_session.refresh_token = new_refresh
    db_session.expires_at = new_expires
    await db.commit()

    is_prod = not settings.app_public_url.startswith("http://localhost")
    response.set_cookie("access_token", new_access, httponly=True, samesite="strict", secure=is_prod, max_age=60 * 15)
    response.set_cookie("refresh_token", new_refresh, httponly=True, samesite="strict", secure=is_prod, max_age=60 * 60 * 24 * 30)

    return {"ok": True}


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    db: AsyncSession = Depends(get_db),
):
    if refresh_token:
        from ..models.session import Session as DBSession
        result = await db.execute(select(DBSession).where(DBSession.refresh_token == refresh_token))
        db_session = result.scalar_one_or_none()
        if db_session:
            await db.delete(db_session)
            await db.commit()

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"ok": True}


@router.get("/me")
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return {
        "id": str(current_user.id),
        "twitch_id": current_user.twitch_id,
        "twitch_username": current_user.twitch_username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "role": current_user.role,
        "dark_mode": current_user.dark_mode,
        "language": current_user.language,
        "timezone": current_user.timezone,
    }
