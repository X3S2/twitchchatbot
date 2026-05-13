"""
Hintergrundaufgabe: Twitch-Moderatoren-Check.

Läuft alle MOD_CHECK_INTERVAL_SECONDS Sekunden.
Prüft für jeden aktiven Tenant, ob die gespeicherten Moderatoren
noch Twitch-Moderationsrechte auf dem Kanal besitzen.
Wenn nicht → revoked_at setzen und Notification für Streamer erstellen.

Hinweis: Benötigt einen User-Access-Token des Broadcasters mit
`moderation:read` Scope. Falls kein Token vorhanden, wird die
Prüfung für diesen Tenant übersprungen.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from ..core.database import AsyncSessionLocal
from ..core.security import decrypt_value
from ..core.twitch_client import get_channel_moderators
from ..models.tenant import Tenant, TenantModerator
from ..models.settings import AppSettings
from ..models.notification import Notification

logger = logging.getLogger(__name__)

MOD_CHECK_INTERVAL_SECONDS = 300  # 5 Minuten


async def mod_check_loop() -> None:
    """Endlosschleife — läuft als asyncio.Task."""
    logger.info("Mod-Check Background-Task gestartet (Intervall: %ds)", MOD_CHECK_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.sleep(MOD_CHECK_INTERVAL_SECONDS)
            await run_mod_check()
        except asyncio.CancelledError:
            logger.info("Mod-Check Background-Task beendet")
            raise
        except Exception as exc:
            logger.error("Mod-Check Fehler: %s", exc, exc_info=True)


async def run_mod_check() -> None:
    """Einmalige Prüfung aller Tenants."""
    async with AsyncSessionLocal() as db:
        # App-Einstellungen für Fallback-Client-ID
        cfg_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        app_cfg = cfg_result.scalar_one_or_none()

        if not app_cfg:
            return

        shared_client_id = decrypt_value(app_cfg.client_id_enc) if app_cfg.client_id_enc else None

        # Alle genehmigten Tenants laden
        tenants_result = await db.execute(
            select(Tenant).where(Tenant.approved.is_(True))
        )
        tenant_list = tenants_result.scalars().all()

        for tenant in tenant_list:
            try:
                await _check_tenant_mods(db, tenant, shared_client_id)
            except Exception as exc:
                logger.warning("Mod-Check für Tenant %s fehlgeschlagen: %s", tenant.id, exc)

        await db.commit()
    logger.debug("Mod-Check abgeschlossen: %d Tenants geprüft", len(tenant_list))


async def _check_tenant_mods(db, tenant: Tenant, shared_client_id: str | None) -> None:
    """Prüft Moderatoren für einen einzelnen Tenant."""
    # Client-ID bestimmen
    if tenant.bot_mode == "own_full" and tenant.own_client_id_enc:
        client_id = decrypt_value(tenant.own_client_id_enc)
    else:
        client_id = shared_client_id

    # Bot-Token des Kanals für den API-Aufruf
    # Benötigen broadcaster access token — falls own_bot_token gesetzt, nutzen wir den
    # Ansonsten skip — wir haben keinen broadcaster token für fremde Kanäle
    if tenant.own_bot_token_enc:
        access_token = decrypt_value(tenant.own_bot_token_enc)
    else:
        # Ohne broadcaster token kein moderation:read Aufruf möglich
        return

    if not client_id or not access_token:
        return

    # Aktuelle Mods in TCB
    tcb_mods_result = await db.execute(
        select(TenantModerator).where(
            TenantModerator.tenant_id == str(tenant.id),
            TenantModerator.revoked_at.is_(None),
        )
    )
    tcb_mods = tcb_mods_result.scalars().all()
    if not tcb_mods:
        return

    # Twitch-API Moderatoren-Liste abrufen (channel_id = broadcaster's twitch_user_id)
    # Wir nutzen den Kanal-Owner's Twitch-ID
    from ..models.user import User
    owner_result = await db.execute(select(User).where(User.id == tenant.user_id))
    owner = owner_result.scalar_one_or_none()
    if not owner or not owner.twitch_id:
        return

    twitch_mods = await get_channel_moderators(owner.twitch_id, client_id, access_token)
    if not twitch_mods:
        # Leere Liste könnte API-Fehler sein → nicht revoken um false positives zu vermeiden
        return

    twitch_mod_ids = {m["user_id"] for m in twitch_mods}
    now = datetime.now(timezone.utc)
    revoked_count = 0

    for mod in tcb_mods:
        if mod.twitch_user_id not in twitch_mod_ids:
            # Nicht mehr Mod auf Twitch → Zugriff entziehen
            mod.revoked_at = now
            revoked_count += 1
            logger.info(
                "Mod-Rechte entzogen: %s auf Kanal %s (kein Twitch-Mod mehr)",
                mod.twitch_username, tenant.channel_name,
            )
            # Benachrichtigung für den Streamer
            notif = Notification(
                user_id=tenant.user_id,
                type="mod_revoked",
                title=f"Moderator entfernt: {mod.twitch_username or mod.twitch_user_id}",
                body=f"Der Moderator {mod.twitch_username or mod.twitch_user_id} hat keine Twitch-Moderationsrechte mehr auf Kanal {tenant.channel_name} und wurde automatisch entfernt.",
            )
            db.add(notif)

    if revoked_count:
        logger.info("Mod-Check Kanal %s: %d Mod(s) revoziert", tenant.channel_name, revoked_count)
