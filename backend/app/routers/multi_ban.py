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
    token: str | None = None   # Reserviert für zukünftige direkte Twitch-API-Nutzung


class MultiBanResult(BaseModel):
    channel: str
    success: bool
    detail: str | None = None


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

    # Ban anlegen (source = multi_banner)
    ban = Ban(
        tenant_id=tenant_id,
        twitch_user_id="multi_banner",  # Kein Lookup gegen Twitch-API — username wird als primärer Schlüssel genutzt
        twitch_username=data.target_username.lower().strip(),
        type="permanent",
        reason=data.reason,
        source="multi_banner",
        created_by=current_user.id,
    )
    db.add(ban)
    await db.commit()

    return MultiBanResult(channel=data.channel, success=True)
