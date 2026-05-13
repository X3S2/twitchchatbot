"""
Filter-Engine — prüft Chat-Nachrichten gegen Chat-Filter.
"""
from __future__ import annotations

import difflib
import fnmatch
import logging
import re
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class FilterAction:
    action: str          # "timeout" | "ban" | "delete" | "warn"
    duration_seconds: int
    message_template: str | None
    filter_id: str
    filter_name: str
    matched_term: str
    tier_order: int


def check_message(
    message_text: str,
    user_id: str,
    username: str,
    filters_config: list[dict],
    violation_counts: dict[str, int],  # {filter_id: count_in_window}
) -> FilterAction | None:
    """
    Prüft eine Nachricht gegen alle aktiven Filter.
    Gibt die erste zutreffende FilterAction zurück, oder None.
    """
    # Priorität absteigend sortieren
    active = sorted(
        [f for f in filters_config if f.get("enabled", True)],
        key=lambda x: x.get("priority", 0),
        reverse=True,
    )

    for flt in active:
        matched_term = _check_filter(message_text, flt)
        if matched_term is None:
            continue

        # Tiers evaluieren
        filter_id = flt["id"]
        current_count = violation_counts.get(filter_id, 0)
        action = _select_tier(flt.get("tiers", []), current_count + 1)
        if action is None:
            continue

        return FilterAction(
            action=action["action"],
            duration_seconds=action.get("duration_seconds", 300),
            message_template=action.get("message_template"),
            filter_id=filter_id,
            filter_name=flt.get("name", ""),
            matched_term=matched_term,
            tier_order=action.get("tier_order", 1),
        )

    return None


def _check_filter(text: str, flt: dict) -> str | None:
    """Gibt den gematchten Term zurück, oder None wenn kein Treffer."""
    terms = flt.get("terms", [])
    case_sensitive = flt.get("case_sensitive", False)

    check_text = text if case_sensitive else text.lower()

    # Whitelist zuerst prüfen
    for t in terms:
        if not t.get("is_whitelist"):
            continue
        pattern = t["term"] if case_sensitive else t["term"].lower()
        if _matches_term(check_text, pattern, t.get("is_regex", False), None):
            return None  # Whitelist-Treffer → überspringen

    # Blacklist prüfen
    for t in terms:
        if t.get("is_whitelist"):
            continue
        pattern = t["term"] if case_sensitive else t["term"].lower()
        threshold = t.get("similarity_threshold")
        if _matches_term(check_text, pattern, t.get("is_regex", False), threshold):
            return t["term"]

    return None


def _matches_term(text: str, pattern: str, is_regex: bool, similarity_threshold: float | None) -> bool:
    if similarity_threshold is not None and 0 < similarity_threshold < 1:
        # Ähnlichkeitsprüfung mit difflib
        words = text.split()
        for word in words:
            ratio = difflib.SequenceMatcher(None, word, pattern).ratio()
            if ratio >= similarity_threshold:
                return True
        return False

    if is_regex:
        try:
            return bool(re.search(pattern, text))
        except re.error:
            return False

    # Wildcard (fnmatch) wenn * oder ? enthalten
    if "*" in pattern or "?" in pattern:
        return fnmatch.fnmatch(text, f"*{pattern}*") or fnmatch.fnmatch(text, pattern)

    # Einfache Substring-Suche
    return pattern in text


def _select_tier(tiers: list[dict], violation_count: int) -> dict | None:
    """Wählt das passende Tier basierend auf der Anzahl der Verstöße."""
    if not tiers:
        return None

    sorted_tiers = sorted(tiers, key=lambda t: t.get("tier_order", 1))
    selected = None
    for tier in sorted_tiers:
        if violation_count >= tier.get("threshold", 1):
            selected = tier
    return selected
