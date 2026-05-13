"""
Redis-Bus — Pub/Sub-Publisher für Bot-Events.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from .config import get_settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


async def publish(channel: str, data: dict[str, Any]) -> None:
    """Veröffentlicht eine Nachricht auf einem Redis-Kanal."""
    try:
        r = await get_redis()
        await r.publish(channel, json.dumps(data, default=str))
    except Exception as exc:
        logger.warning("Redis publish fehlgeschlagen: %s", exc)
