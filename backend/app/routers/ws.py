"""
WebSocket-Router — Echtzeit-Kommunikation für Admin und Tenants.
Rooms: "admin" (globale Bot-Status-Events), "tenant:{uuid}" (Tenant-spezifische Events).
"""
import asyncio
import json
import uuid
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.database import get_db
from ..core.security import decode_token
from ..core.redis_client import get_redis
from ..models.tenant import Tenant

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


class WsManager:
    def __init__(self) -> None:
        self._conns: dict[str, dict] = {}

    async def connect(self, ws: WebSocket, cid: str, rooms: set[str]) -> None:
        await ws.accept()
        self._conns[cid] = {"ws": ws, "rooms": rooms}

    def disconnect(self, cid: str) -> None:
        self._conns.pop(cid, None)

    async def broadcast(self, room: str, payload: dict) -> None:
        dead: list[str] = []
        for cid, info in list(self._conns.items()):
            if room in info["rooms"]:
                try:
                    await info["ws"].send_json(payload)
                except Exception:
                    dead.append(cid)
        for cid in dead:
            self._conns.pop(cid, None)

    async def send_to(self, cid: str, payload: dict) -> None:
        info = self._conns.get(cid)
        if info:
            try:
                await info["ws"].send_json(payload)
            except Exception:
                self._conns.pop(cid, None)


manager = WsManager()


async def _auth_ws(websocket: WebSocket, required_role: str | None = None) -> dict | None:
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001)
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return None
    if required_role and payload.get("role") != required_role:
        await websocket.close(code=4003)
        return None
    return payload


@router.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket):
    payload = await _auth_ws(websocket, required_role="admin")
    if not payload:
        return
    cid = str(uuid.uuid4())
    await manager.connect(websocket, cid, {"admin"})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(cid)


@router.websocket("/ws/tenant/{tenant_id}")
async def ws_tenant(websocket: WebSocket, tenant_id: str, db: AsyncSession = Depends(get_db)):
    payload = await _auth_ws(websocket)
    if not payload:
        return

    user_id = payload.get("sub")
    role = payload.get("role")

    # Zugriffscheck: admin oder eigener Tenant / Moderator
    if role != "admin":
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.user_id == user_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            await websocket.close(code=4003)
            return

    cid = str(uuid.uuid4())
    room = f"tenant:{tenant_id}"
    await manager.connect(websocket, cid, {room, "tenant_all"})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(cid)


@router.websocket("/ws/tenant/{tenant_id}/chat")
async def ws_tenant_chat(websocket: WebSocket, tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Live-Chat-Stream für einen Tenant-Kanal (Redis pub/sub → WebSocket)."""
    payload = await _auth_ws(websocket)
    if not payload:
        return

    user_id = payload.get("sub")
    role = payload.get("role")

    if role != "admin":
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.user_id == user_id)
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=4003)
            return

    await websocket.accept()
    redis = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"tcb:chat:{tenant_id}")
    try:
        async for msg in pubsub.listen():
            if msg["type"] != "message":
                continue
            try:
                await websocket.send_text(msg["data"] if isinstance(msg["data"], str) else msg["data"].decode())
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"tcb:chat:{tenant_id}")
        await pubsub.aclose()


async def redis_subscriber():
    """Hintergrundtask: liest Redis Pub/Sub und broadcastet an WS-Clients."""
    redis = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe("tcb:admin", "tcb:tenants")
    async for msg in pubsub.listen():
        if msg["type"] != "message":
            continue
        try:
            data = json.loads(msg["data"])
            channel = msg["channel"]
            if isinstance(channel, bytes):
                channel = channel.decode()
            if channel == "tcb:admin":
                await manager.broadcast("admin", data)
            elif channel == "tcb:tenants":
                tenant_id = data.get("tenant_id")
                if tenant_id:
                    await manager.broadcast(f"tenant:{tenant_id}", data)
        except Exception as exc:
            logger.warning("redis_subscriber error: %s", exc)
