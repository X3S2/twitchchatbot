"""
TwitchIO Bot-Instanz — eine vollständige Bot-Verbindung pro Tenant.
Phase 2: TwitchIO-Integration mit Chat-Filter, Name-Filter und Commands.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import aiohttp
import twitchio
from twitchio.ext import commands as twitch_commands

from .config import get_settings
from .filter_engine import check_message, FilterAction
from .name_filter_engine import check_username
from .command_handler import handle_command
from .redis_bus import publish

logger = logging.getLogger(__name__)
settings = get_settings()

# In-Memory-Violation-Timestamps: {tenant_id: {filter_id: {user_id: [datetime, ...]}}}
_violation_timestamps: dict[str, dict[str, dict[str, list[datetime]]]] = {}
# Bereits gesehene Chatter: {tenant_id: set(user_ids)}
_seen_chatters: dict[str, set[str]] = {}
# Command-Cooldowns: {tenant_id: {key: timestamp}}
_cooldown_stores: dict[str, dict[str, float]] = {}


class TwitchBotInstance(twitch_commands.Bot):
    def __init__(self, tenant_id: str, channel: str, config: dict) -> None:
        self.tenant_id = tenant_id
        self.channel_name = channel
        self.config = config
        self._running = False
        self._heartbeat_task: asyncio.Task | None = None
        self._config_refresh_task: asyncio.Task | None = None
        self._reconnect_attempts = 0

        token = self._resolve_token()
        super().__init__(token=token, prefix="!", initial_channels=[channel])

    def _resolve_token(self) -> str:
        mode = self.config.get("bot_mode", "shared")
        if mode in ("own_bot", "own_full"):
            return self.config.get("own_bot_token", "")
        return self.config.get("bot_token", "")

    # ── TwitchIO-Events ───────────────────────────────────────

    async def event_ready(self) -> None:
        logger.info("[%s] Bot verbunden", self.channel_name)
        self._running = True
        self._reconnect_attempts = 0
        await self._report_status("online")
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._config_refresh_task = asyncio.create_task(self._config_refresh_loop())

    async def event_message(self, message: twitchio.Message) -> None:
        if message.echo:
            return

        author = message.author
        user_id = str(author.id) if author else ""
        username = author.name if author else "unknown"
        text = message.content or ""

        # 1. Name-Filter (einmalig pro Chatter)
        if user_id and user_id not in _seen_chatters.get(self.tenant_id, set()):
            _seen_chatters.setdefault(self.tenant_id, set()).add(user_id)
            nf_action = check_username(username, user_id, self.config.get("name_filters", []))
            if nf_action and not self.config.get("test_mode_global"):
                await self._apply_action(message.channel, username, user_id, nf_action.action, nf_action.duration_seconds, nf_action.message_template)

        # 2. Chat-Filter
        tmap = _violation_timestamps.setdefault(self.tenant_id, {})
        violation_data = {fid: user_ts.get(user_id, []) for fid, user_ts in tmap.items()}
        cf_action = check_message(text, user_id, username, self.config.get("chat_filters", []), violation_data)
        if cf_action:
            tmap.setdefault(cf_action.filter_id, {}).setdefault(user_id, []).append(datetime.now(timezone.utc))
            await self._report_filter_hit(cf_action, username, user_id, text)
            filter_cfg = next((f for f in self.config.get("chat_filters", []) if f["id"] == cf_action.filter_id), {})
            if not filter_cfg.get("test_mode", False):
                await self._apply_action(message.channel, username, user_id, cf_action.action, cf_action.duration_seconds, cf_action.message_template)

        # 3. Befehle
        if text.startswith("!"):
            user_roles = _extract_roles(author)
            is_mod = "moderator" in user_roles or is_broadcaster(author, self.channel_name)
            is_owner = is_broadcaster(author, self.channel_name)
            cooldowns = _cooldown_stores.setdefault(self.tenant_id, {})

            # Eingebauter !unban-Befehl — nur für Mods/Streamer
            if text.lower().startswith("!unban ") and is_mod:
                parts = text.split()
                if len(parts) >= 2:
                    target_username = parts[1].lstrip("@")
                    await self._report_unban(target_username)

            # !tcbinfo <term> — Infos über einen Chat-Filter-Begriff
            if text.lower().startswith("!tcbinfo") and is_mod:
                parts = text.split(maxsplit=1)
                term = parts[1].strip() if len(parts) > 1 else ""
                reply = await self._cmd_tcbinfo(term)
                await message.channel.send(reply)

            # !tcbstats — Filter-Trefferstatistik für diesen Kanal
            elif text.lower() == "!tcbstats" and is_mod:
                reply = await self._cmd_tcbstats()
                await message.channel.send(reply)

            # !tcbstop / !tcbstart — Bot für diesen Kanal pausieren/fortsetzen (nur Broadcaster)
            elif text.lower() == "!tcbstop" and is_owner:
                await self._cmd_bot_pause(True)
                await message.channel.send("TCB-Bot pausiert. Tippe !tcbstart zum Fortsetzen.")

            elif text.lower() == "!tcbstart" and is_owner:
                await self._cmd_bot_pause(False)
                await message.channel.send("TCB-Bot läuft wieder.")

            # !tcbrejoin — Bot verlässt und betritt den Kanal neu (Mods/Broadcaster)
            elif text.lower() == "!tcbrejoin" and is_mod:
                await message.channel.send("TCB-Bot verlässt den Chat und tritt gleich wieder bei...")
                await self._cmd_rejoin()

            response = await handle_command(
                message_text=text, user_id=user_id, username=username,
                user_roles=user_roles, commands_config=self.config.get("commands", []),
                cooldown_store=cooldowns,
            )
            if response:
                await message.channel.send(response)

            # Spezielle Aktionstypen aus benutzerdefinierten Befehlen ausführen
            cmd_name = text.split()[0].lower()
            args = text.split()[1:]
            matched_cmd = next(
                (c for c in self.config.get("commands", []) if c.get("command_name") == cmd_name and c.get("enabled", True)),
                None,
            )
            if matched_cmd:
                action_type = matched_cmd.get("action_type", "respond")
                await self._execute_command_action(message.channel, action_type, username, user_id, args)

        await self.handle_commands(message)

    # ── Aktionen ──────────────────────────────────────────────

    async def _apply_action(self, channel, username: str, user_id: str, action: str, duration: int, template: str | None) -> None:
        try:
            if action == "ban" and user_id:
                await channel.ban(user_id, reason="TCB Auto-Ban")
            elif action == "timeout" and user_id:
                await channel.timeout(user_id, max(1, duration), reason="TCB Timeout")
            if template:
                await channel.send(template.replace("{user}", username))
        except Exception as exc:
            logger.warning("[%s] Aktion fehlgeschlagen: %s", self.channel_name, exc)

    async def _execute_command_action(self, channel, action_type: str, username: str, user_id: str, args: list[str]) -> None:
        """Führt spezielle Befehlsaktionen aus (nicht respond)."""
        try:
            if action_type == "ban" and user_id:
                await channel.ban(user_id, reason=f"TCB Befehl von {username}")
            elif action_type == "timeout" and user_id:
                await channel.timeout(user_id, 600, reason=f"TCB Befehl von {username}")
            elif action_type == "delete":
                pass  # Wird durch handle_command / TwitchIO-Decorator erledigt
            elif action_type == "bot_stop":
                await channel.send("TCB-Bot wird gestoppt...")
                await self._cmd_bot_pause(True)
            elif action_type == "bot_restart":
                await channel.send("TCB-Bot startet neu...")
                await self._cmd_rejoin()
            elif action_type == "unban_user":
                if args:
                    target = args[0].lstrip("@")
                    await self._report_unban(target)
                    await channel.send(f"@{username} Unban-Anfrage für {target} wurde gesendet.")
            elif action_type == "test_mode_toggle":
                await channel.send("[TCB] Test-Modus Umschaltung ist noch in Entwicklung.")
            # "respond" wird bereits durch handle_command / response_template behandelt
        except Exception as exc:
            logger.warning("[%s] Befehlsaktion '%s' fehlgeschlagen: %s", self.channel_name, action_type, exc)

    # ── Background-Tasks ──────────────────────────────────────

    async def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                await asyncio.sleep(30)
                await self._report_status("online")
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("[%s] Heartbeat-Fehler: %s", self.channel_name, exc)

    async def _config_refresh_loop(self) -> None:
        while self._running:
            try:
                await asyncio.sleep(300)
                await self._fetch_config()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("[%s] Config-Refresh-Fehler: %s", self.channel_name, exc)

    async def _fetch_config(self) -> None:
        url = f"{settings.api_url}/api/internal/tenant/{self.tenant_id}/config"
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        self.config = await resp.json()
        except Exception as exc:
            logger.warning("[%s] Config-Fetch fehlgeschlagen: %s", self.channel_name, exc)

    async def _report_status(self, status: str, error: str | None = None) -> None:
        url = f"{settings.api_url}/api/internal/heartbeat"
        payload = {"tenant_id": self.tenant_id, "status": status, "reconnect_attempts": self._reconnect_attempts, "error_message": error}
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as exc:
            logger.warning("[%s] Heartbeat fehlgeschlagen: %s", self.channel_name, exc)

    async def _report_filter_hit(self, action: FilterAction, username: str, user_id: str, text: str) -> None:
        url = f"{settings.api_url}/api/internal/filter-hit"
        payload = {"tenant_id": self.tenant_id, "filter_id": action.filter_id, "twitch_user_id": user_id, "twitch_username": username, "message_text": text, "matched_term": action.matched_term, "action_taken": action.action, "test_mode": False}
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as exc:
            logger.warning("[%s] Filter-Hit fehlgeschlagen: %s", self.channel_name, exc)

    async def _report_unban(self, twitch_username: str) -> None:
        """Meldet eine manuelle Entbannung — setzt failover_protected."""
        url = f"{settings.api_url}/api/internal/unban-notification"
        payload = {
            "tenant_id": self.tenant_id,
            "twitch_user_id": twitch_username,  # Username als ID-Fallback
            "twitch_username": twitch_username,
            "reason": "!unban command",
        }
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as exc:
            logger.warning("[%s] Unban-Meldung fehlgeschlagen: %s", self.channel_name, exc)

    async def _cmd_tcbinfo(self, term: str) -> str:
        """Gibt Infos über einen Filterbegriff oder allgemeine Bot-Infos aus."""
        if not term:
            filters = self.config.get("chat_filters", [])
            name_filters = self.config.get("name_filters", [])
            return f"TCB aktiv | Chat-Filter: {len(filters)} | Name-Filter: {len(name_filters)} | Modus: {self.config.get('bot_mode', 'shared')}"
        # Suche den Begriff in allen Chat-Filtern
        for f in self.config.get("chat_filters", []):
            terms = [t.lower() if isinstance(t, str) else t.get("term", "").lower() for t in f.get("terms", [])]
            if term.lower() in terms:
                return f"'{term}' gefunden in Filter '{f.get('name', f['id'])}' | Aktion: {f.get('action', '?')} | Test-Modus: {'ja' if f.get('test_mode') else 'nein'}"
        return f"'{term}' in keinem aktiven Filter gefunden."

    async def _cmd_tcbstats(self) -> str:
        """Gibt Filter-Trefferstatistik für diesen Tenant zurück."""
        tmap = _violation_timestamps.get(self.tenant_id, {})
        if not tmap:
            return "Keine Filter-Treffer in dieser Session."
        parts = []
        for fid, users in tmap.items():
            total = sum(len(ts) for ts in users.values())
            fname = next((f.get("name", fid) for f in self.config.get("chat_filters", []) if f["id"] == fid), fid)
            parts.append(f"{fname}: {total}x")
        return "TCB-Stats: " + " | ".join(parts[:5])  # max 5 filter

    async def _cmd_bot_pause(self, pause: bool) -> None:
        """Informiert das Backend über Pause/Fortsetzen."""
        url = f"{settings.api_url}/api/internal/bot-pause"
        payload = {"tenant_id": self.tenant_id, "paused": pause}
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as exc:
            logger.warning("[%s] Bot-Pause-Meldung fehlgeschlagen: %s", self.channel_name, exc)

    async def _cmd_rejoin(self) -> None:
        """Verlässt den Kanal und tritt sofort wieder bei (Reconnect)."""
        try:
            await self.part_channels([self.channel_name])
        except Exception:
            pass
        await asyncio.sleep(2)
        try:
            await self.join_channels([self.channel_name])
            self._reconnect_attempts = 0
            await self._report_status("online")
        except Exception as exc:
            logger.warning("[%s] Rejoin fehlgeschlagen: %s", self.channel_name, exc)
            await self._report_status("error", str(exc))

    def get_status(self) -> dict[str, Any]:
        return {"tenant_id": self.tenant_id, "channel": self.channel_name, "running": self._running, "reconnect_attempts": self._reconnect_attempts}

    async def shutdown(self) -> None:
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._config_refresh_task:
            self._config_refresh_task.cancel()
        await self._report_status("offline")
        try:
            await self.close()
        except Exception:
            pass


# ── Legacy-Wrapper für InstanceManager-Kompatibilität ────────

class BotInstance:
    """Thin wrapper so InstanceManager kann TwitchBotInstance nutzen."""

    def __init__(self, tenant_id: str, channel: str, bot_username: str, config: dict | None = None) -> None:
        self.tenant_id = tenant_id
        self.channel = channel
        self.bot_username = bot_username
        self._config = config or {}
        self._bot: TwitchBotInstance | None = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if not self._config:
            await self._load_config()

        # Validate that a token is available before trying to connect
        mode = self._config.get("bot_mode", "shared")
        if mode in ("own_bot", "own_full"):
            token = self._config.get("own_bot_token", "")
        else:
            token = self._config.get("bot_token", "")

        if not token:
            logger.error(
                "Kein Bot-Token für channel=%s mode=%s — Bot kann nicht starten. "
                "Bitte OAuth-Token in den Admin-Einstellungen eintragen.",
                self.channel, mode,
            )
            # Report error status to the API so the dashboard shows a clear error
            await self._report_start_error("Kein Bot-Token konfiguriert")
            return

        self._bot = TwitchBotInstance(self.tenant_id, self.channel, self._config)
        self._task = asyncio.create_task(self._bot.start(), name=f"bot-{self.channel}")
        logger.info("BotInstance gestartet: channel=%s", self.channel)

    async def stop(self) -> None:
        if self._bot:
            await self._bot.shutdown()
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        logger.info("BotInstance gestoppt: channel=%s", self.channel)

    async def _load_config(self) -> None:
        url = f"{settings.api_url}/api/internal/tenant/{self.tenant_id}/config"
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        self._config = await resp.json()
        except Exception as exc:
            logger.warning("Config-Load fehlgeschlagen: %s", exc)
            self._config = {}

    async def _report_start_error(self, message: str) -> None:
        """Report an error status to the API when the bot cannot start."""
        url = f"{settings.api_url}/api/internal/heartbeat"
        headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
        payload = {
            "tenant_id": self.tenant_id,
            "status": "error",
            "reconnect_attempts": 0,
            "error_message": message,
        }
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5))
        except Exception as exc:
            logger.warning("Fehler-Status konnte nicht gemeldet werden: %s", exc)

    def status(self) -> dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "channel": self.channel,
            "bot_username": self.bot_username,
            "running": self._bot._running if self._bot else False,
        }


def _extract_roles(author) -> list[str]:
    roles = ["everyone"]
    if not author:
        return roles
    if getattr(author, "is_subscriber", False):
        roles.append("subscriber")
    if getattr(author, "is_vip", False):
        roles.append("vip")
    if getattr(author, "is_mod", False):
        roles.append("moderator")
    return roles


def is_broadcaster(author, channel_name: str) -> bool:
    """Prüft ob der Nachrichtenautor der Kanal-Owner (Broadcaster) ist."""
    if not author:
        return False
    return author.name.lower() == channel_name.lower()
