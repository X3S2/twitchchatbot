"""
Multi-ban endpoint — Bannt einen Twitch-User über mehrere Tenants gleichzeitig.
Jeder Aufruf prüft, ob der aufrufende User auf dem angegebenen Kanal (Tenant)
Editor-Rechte besitzt, bevor ein Ban-Eintrag angelegt wird.
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.ban import Ban
from ..models.tenant import Tenant, TenantModerator

router = APIRouter(prefix="/multi-ban", tags=["multi-ban"])


class MultiBanEntry(BaseModel):
    target_username: str
    channel: str          # Twitch-Kanalname (= tenant.channel_name)
    reason: str | None = None
    token: str | None = None   # Reserviert für direkte Twitch-API-Nutzung


class MultiBanResult(BaseModel):
    channel: str
    success: bool
    detail: str | None = None
    twitch_user_id: str | None = None


async def _lookup_user_id(target_username: str, db: AsyncSession) -> str | None:
    """Versucht die Twitch-User-ID via API nachzuschlagen. Fallback: None."""
    from ..models.settings import AppSettings
    from ..core.security import decrypt_value
    from ..core.twitch_client import get_app_access_token, lookup_twitch_user

    try:
        cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        app_cfg = cfg_result.scalar_one_or_none()
        if not app_cfg or not app_cfg.client_id_enc or not app_cfg.client_secret_enc:
            return None

        client_id = decrypt_value(app_cfg.client_id_enc)
        client_secret = decrypt_value(app_cfg.client_secret_enc)
        token = await get_app_access_token(client_id, client_secret)
        if not token:
            return None

        user_data = await lookup_twitch_user(target_username, client_id, token)
        return user_data.get("id") if user_data else None
    except Exception:
        return None


@router.post("", response_model=MultiBanResult)
async def multi_ban_single(
    data: MultiBanEntry,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Bannt einen User in einem einzelnen Kanal.
    Das Frontend ruft diesen Endpoint sequenziell für jeden Kanal auf.
    """
    # Tenant anhand des Kanalnamens finden
    result = await db.execute(
        select(Tenant).where(Tenant.channel_name == data.channel.lower().strip())
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Kanal '{data.channel}' nicht gefunden")

    tenant_id = str(tenant.id)

    # Zugriffsprüfung: Admin, Kanalinhaber oder Editor-Mod
    if current_user.role != "admin" and str(tenant.user_id) != str(current_user.id):
        mod_result = await db.execute(
            select(TenantModerator).where(
                TenantModerator.tenant_id == tenant_id,
                TenantModerator.twitch_user_id == current_user.twitch_id,
                TenantModerator.role == "editor",
                TenantModerator.revoked_at.is_(None),
            )
        )
        if not mod_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Keine Editor-Rechte auf diesem Kanal")

    # Verhindere Selbst-Ban
    if current_user.twitch_username and current_user.twitch_username.lower() == data.target_username.lower():
        raise HTTPException(status_code=400, detail="Selbst-Ban nicht erlaubt")

    # Twitch-User-ID nachschlagen (Best-Effort)
    twitch_user_id = await _lookup_user_id(data.target_username, db) or "unknown"

    # Ban anlegen (source = multi_banner)
    ban = Ban(
        tenant_id=tenant_id,
        twitch_user_id=twitch_user_id,
        twitch_username=data.target_username.lower().strip(),
        type="permanent",
        reason=data.reason,
        source="multi_banner",
        created_by=current_user.id,
    )
    db.add(ban)
    await db.commit()

    return MultiBanResult(channel=data.channel, success=True, twitch_user_id=twitch_user_id)
