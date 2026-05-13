import secrets
from datetime import datetime, timezone
from typing import Annotated
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.config import get_settings
from ..core.database import get_db
from ..core.security import create_access_token, create_refresh_token, decode_token
from ..core.deps import get_current_user
from ..models.user import User
from ..models.settings import AppSettings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_USERS_URL = "https://api.twitch.tv/helix/users"
TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"

SCOPES = "user:read:email"


def _redirect_uri() -> str:
    return f"{settings.app_public_url}/auth/callback"


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
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Verarbeitet den Twitch-OAuth-Callback."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_cfg = result.scalar_one_or_none()
    if not app_cfg:
        raise HTTPException(status_code=500, detail="Konfiguration fehlt")

    from ..core.security import decrypt_value
    client_id = decrypt_value(app_cfg.client_id_enc)
    client_secret = decrypt_value(app_cfg.client_secret_enc)

    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Twitch-App nicht konfiguriert")

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
            raise HTTPException(status_code=400, detail="Token-Exchange fehlgeschlagen")

        token_data = token_resp.json()
        access_token = token_data["access_token"]

        # Twitch-Nutzerprofil abrufen
        user_resp = await client.get(
            TWITCH_USERS_URL,
            headers={"Authorization": f"Bearer {access_token}", "Client-Id": client_id},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Nutzerprofil nicht abrufbar")

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
            raise HTTPException(status_code=403, detail="Account gesperrt")
        if user.soft_delete_at is not None:
            raise HTTPException(status_code=403, detail="Account gelöscht")
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

    # Cookies setzen (HttpOnly, SameSite=Strict)
    is_prod = not settings.app_public_url.startswith("http://localhost")
    response.set_cookie("access_token", access_jwt, httponly=True, samesite="strict", secure=is_prod, max_age=60 * 15)
    response.set_cookie("refresh_token", refresh_jwt, httponly=True, samesite="strict", secure=is_prod, max_age=60 * 60 * 24 * 30)

    return {"ok": True, "user_id": str(user.id), "role": user.role}


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
