"""
Name-Filter-Engine — prüft Twitch-Usernamen gegen Name-Filter.
"""
from __future__ import annotations

import fnmatch
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NameFilterAction:
    action: str          # "ban" | "timeout" | "flag"
    duration_seconds: int
    message_template: str | None
    filter_id: str
    filter_name: str
    matched_pattern: str


def check_username(
    username: str,
    user_id: str,
    name_filters_config: list[dict],
) -> NameFilterAction | None:
    """
    Prüft einen Username gegen alle aktiven Name-Filter.
    Gibt die erste zutreffende NameFilterAction zurück, oder None.
    """
    active = sorted(
        [f for f in name_filters_config if f.get("enabled", True)],
        key=lambda x: x.get("priority", 0),
        reverse=True,
    )

    lower_username = username.lower()

    for flt in active:
        patterns = flt.get("patterns", [])

        # Whitelist zuerst
        for p in patterns:
            if not p.get("is_whitelist"):
                continue
            if _matches(lower_username, p["pattern"].lower(), p.get("is_regex", False)):
                return None  # Whitelist-Treffer

        # Blacklist
        for p in patterns:
            if p.get("is_whitelist"):
                continue
            if _matches(lower_username, p["pattern"].lower(), p.get("is_regex", False)):
                tiers = flt.get("tiers", [])
                tier = tiers[0] if tiers else None
                return NameFilterAction(
                    action=tier["action"] if tier else "flag",
                    duration_seconds=tier.get("duration_seconds", 0) if tier else 0,
                    message_template=tier.get("message_template") if tier else None,
                    filter_id=flt["id"],
                    filter_name=flt.get("name", ""),
                    matched_pattern=p["pattern"],
                )

    return None


def _matches(username: str, pattern: str, is_regex: bool) -> bool:
    if is_regex:
        try:
            return bool(re.search(pattern, username))
        except re.error:
            return False
    if "*" in pattern or "?" in pattern:
        return fnmatch.fnmatch(username, pattern)
    return pattern in username
