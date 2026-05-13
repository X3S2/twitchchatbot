"""
Command-Handler — verarbeitet Bot-Befehle im Chat.
"""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

PERMISSION_ORDER = ["everyone", "subscriber", "vip", "moderator", "editor", "owner", "admin"]

BUILTIN_COMMANDS = {
    "!tcbstatus": "tcbstatus",
    "!tcbstop": "tcbstop",
    "!tcbstart": "tcbstart",
    "!tcbrejoin": "tcbrejoin",
    "!tcbinfo": "tcbinfo",
    "!tcbstats": "tcbstats",
}


async def handle_command(
    message_text: str,
    user_id: str,
    username: str,
    user_roles: list[str],    # ["everyone", "subscriber", ...] — niedrigstes zuerst
    commands_config: list[dict],
    cooldown_store: dict[str, float],  # Redis-Keys: "{cmd}:global" und "{cmd}:{user_id}"
    is_editor: bool = False,
    is_owner: bool = False,
    is_admin: bool = False,
) -> str | None:
    """
    Verarbeitet eine Chat-Nachricht als Befehl.
    Gibt den Antworttext zurück oder None wenn kein Befehl.
    """
    text = message_text.strip()
    if not text.startswith("!"):
        return None

    cmd_name = text.split()[0].lower()
    args = text.split()[1:]

    # Eingebaute Befehle (höchste Priorität, immer Editor/Owner/Admin)
    if cmd_name in BUILTIN_COMMANDS:
        effective_role = "owner" if is_owner else ("editor" if is_editor else "admin" if is_admin else "moderator")
        action = BUILTIN_COMMANDS[cmd_name]
        return f"[TCB] {action.upper()} für {username}"

    # Benutzerdefinierte Befehle
    cmd = next((c for c in commands_config if c["command_name"] == cmd_name and c.get("enabled", True)), None)
    if not cmd:
        return None

    # Berechtigung prüfen
    required = cmd.get("permission_level", "everyone")
    if not _has_permission(user_roles, required, is_editor, is_owner, is_admin):
        return None

    # Cooldown prüfen
    now = time.time()
    global_key = f"{cmd_name}:global"
    user_key = f"{cmd_name}:{user_id}"

    global_cd = cmd.get("global_cooldown_sec", 5)
    user_cd = cmd.get("user_cooldown_sec", 30)

    if global_cd > 0 and cooldown_store.get(global_key, 0) + global_cd > now:
        return None  # Globaler Cooldown aktiv
    if user_cd > 0 and cooldown_store.get(user_key, 0) + user_cd > now:
        return None  # User-Cooldown aktiv

    # Cooldowns setzen
    cooldown_store[global_key] = now
    cooldown_store[user_key] = now

    # Antwort bauen
    template = cmd.get("response_template", "")
    if template:
        response = template.replace("{user}", username).replace("{args}", " ".join(args))
        return response

    return None


def _has_permission(
    user_roles: list[str],
    required: str,
    is_editor: bool,
    is_owner: bool,
    is_admin: bool,
) -> bool:
    if is_admin or is_owner:
        return True
    if required == "admin":
        return is_admin
    if required == "owner":
        return is_owner
    if required == "editor":
        return is_editor
    if required in PERMISSION_ORDER:
        req_idx = PERMISSION_ORDER.index(required)
        for role in user_roles:
            if role in PERMISSION_ORDER and PERMISSION_ORDER.index(role) >= req_idx:
                return True
    return False
