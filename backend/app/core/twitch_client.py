"""
Twitch Helix API Hilfsfunktionen für den Backend-Service.
Verwendet App-Access-Token (Client-Credentials) für Server-zu-Server-Calls.
"""
import logging
from typing import Any
import httpx

logger = logging.getLogger(__name__)

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"
HELIX_BASE = "https://api.twitch.tv/helix"

# Einzel-App-Token Cache (pro Process)
_app_token_cache: dict[str, str] = {}


async def get_app_access_token(client_id: str, client_secret: str) -> str | None:
    """Holt einen App-Access-Token (Client-Credentials Flow)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                TWITCH_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials",
                },
            )
            if resp.status_code != 200:
                logger.warning("App-Access-Token Fehler: %d %s", resp.status_code, resp.text)
                return None
            return resp.json().get("access_token")
    except Exception as exc:
        logger.warning("App-Access-Token Abruf fehlgeschlagen: %s", exc)
        return None


async def get_channel_moderators(
    channel_id: str,
    client_id: str,
    access_token: str,
) -> list[dict[str, Any]]:
    """
    Ruft die Moderatoren-Liste eines Kanals von der Twitch API ab.
    Gibt eine Liste von {user_id, user_login, user_name} zurück.
    Benötigt einen User-Access-Token des Broadcasters mit `moderation:read` Scope.
    Gibt leere Liste zurück wenn Token oder Rechte fehlen.
    """
    try:
        url = f"{HELIX_BASE}/moderation/moderators"
        headers = {
            "Client-Id": client_id,
            "Authorization": f"Bearer {access_token}",
        }
        params = {"broadcaster_id": channel_id, "first": "100"}
        all_mods: list[dict] = []

        async with httpx.AsyncClient(timeout=10) as client:
            while True:
                resp = await client.get(url, headers=headers, params=params)
                if resp.status_code == 401:
                    logger.debug("Moderator-Check: Token abgelaufen für Broadcaster %s", channel_id)
                    return []
                if resp.status_code != 200:
                    logger.warning("Moderator-Check Fehler: %d", resp.status_code)
                    return []
                body = resp.json()
                all_mods.extend(body.get("data", []))
                cursor = body.get("pagination", {}).get("cursor")
                if not cursor:
                    break
                params = {**params, "after": cursor}

        return all_mods
    except Exception as exc:
        logger.warning("Moderator-Abruf fehlgeschlagen: %s", exc)
        return []


async def lookup_twitch_user(
    login: str,
    client_id: str,
    access_token: str,
) -> dict[str, Any] | None:
    """Sucht einen Twitch-User nach Login-Name. Gibt None zurück wenn nicht gefunden."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{HELIX_BASE}/users",
                headers={"Client-Id": client_id, "Authorization": f"Bearer {access_token}"},
                params={"login": login.lower()},
            )
            if resp.status_code != 200:
                return None
            data = resp.json().get("data", [])
            return data[0] if data else None
    except Exception as exc:
        logger.warning("User-Lookup fehlgeschlagen für %s: %s", login, exc)
        return None


async def validate_token(access_token: str) -> dict[str, Any] | None:
    """
    Validiert einen Twitch-Access-Token via /oauth2/validate.
    Gibt Token-Infos zurück (login, user_id, scopes, expires_in) oder None wenn ungültig.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                TWITCH_VALIDATE_URL,
                headers={"Authorization": f"OAuth {access_token}"},
            )
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception as exc:
        logger.warning("Token-Validierung fehlgeschlagen: %s", exc)
        return None


async def refresh_user_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> dict[str, Any]:
    """
    Erneuert einen User-Access-Token via Refresh-Token.
    Gibt immer ein Dict zurück:
    - Erfolg: {access_token, refresh_token, expires_in, ...}
    - Fehler:  {error: "Twitch-Fehlermeldung"}
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                TWITCH_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            data = resp.json()
            if resp.status_code != 200:
                msg = data.get("message") or data.get("error_description") or resp.text
                logger.warning("Token-Refresh fehlgeschlagen: %d %s", resp.status_code, msg)
                return {"error": msg}
            return data
    except Exception as exc:
        logger.warning("Token-Refresh fehlgeschlagen: %s", exc)
        return {"error": str(exc)}
