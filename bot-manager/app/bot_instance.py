"""
Bot Instance — einzelne TwitchIO-Verbindung für einen Channel.
Stub für Phase 1: Grundgerüst ohne aktive IRC-Verbindung.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class BotInstance:
    tenant_id: str
    channel: str
    bot_username: str
    _running: bool = field(default=False, init=False, repr=False)
    _task: asyncio.Task[None] | None = field(default=None, init=False, repr=False)

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name=f"bot-{self.channel}")
        logger.info("BotInstance started for channel=%s tenant=%s", self.channel, self.tenant_id)

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("BotInstance stopped for channel=%s", self.channel)

    async def _run(self) -> None:
        """Hauptschleife — in Phase 2 durch TwitchIO-Bot ersetzt."""
        while self._running:
            await asyncio.sleep(60)

    def status(self) -> dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "channel": self.channel,
            "bot_username": self.bot_username,
            "running": self._running,
        }
