"""
Instance Manager — verwaltet alle laufenden Bot-Instanzen.
"""
from __future__ import annotations

import logging
from typing import Any

from .bot_instance import BotInstance

logger = logging.getLogger(__name__)


class InstanceManager:
    def __init__(self) -> None:
        self._instances: dict[str, BotInstance] = {}

    async def start_instance(self, tenant_id: str, channel: str, bot_username: str) -> bool:
        key = f"{tenant_id}:{channel}"
        if key in self._instances:
            return False
        instance = BotInstance(tenant_id=tenant_id, channel=channel, bot_username=bot_username)
        await instance.start()
        self._instances[key] = instance
        return True

    async def stop_instance(self, tenant_id: str, channel: str) -> bool:
        key = f"{tenant_id}:{channel}"
        instance = self._instances.pop(key, None)
        if not instance:
            return False
        await instance.stop()
        return True

    def list_instances(self) -> list[dict[str, Any]]:
        return [inst.status() for inst in self._instances.values()]

    async def shutdown_all(self) -> None:
        keys = list(self._instances.keys())
        for key in keys:
            instance = self._instances.pop(key)
            await instance.stop()
        logger.info("All bot instances stopped")


_manager: InstanceManager | None = None


def get_manager() -> InstanceManager:
    global _manager
    if _manager is None:
        _manager = InstanceManager()
    return _manager
