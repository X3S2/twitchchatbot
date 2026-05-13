from contextlib import asynccontextmanager
import logging

import aiohttp
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import get_settings
from .instance_manager import get_manager
from .redis_bus import get_redis, close_redis

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Redis-Verbindung starten
    redis = await get_redis()
    await redis.ping()

    # Aktive Tenants beim Start laden
    await _load_active_tenants()

    yield

    # Shutdown
    manager = get_manager()
    await manager.shutdown_all()
    await close_redis()


async def _load_active_tenants() -> None:
    """Lädt alle genehmigten Tenants aus der API und startet Bot-Instanzen."""
    url = f"{settings.api_url}/api/tenants/admin/instances"
    headers = {"Authorization": f"Bearer {settings.internal_api_key}"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    logger.warning("Konnte Tenant-Liste nicht laden: HTTP %d", resp.status)
                    return
                tenants = await resp.json()
    except Exception as exc:
        logger.warning("Tenant-Liste Abruf fehlgeschlagen: %s", exc)
        return

    manager = get_manager()
    for t in tenants:
        if not t.get("approved"):
            continue
        try:
            await manager.start_instance(
                tenant_id=t["tenant_id"],
                channel=t["channel_name"],
                bot_username="",
            )
        except Exception as exc:
            logger.warning("Fehler beim Starten von %s: %s", t.get("channel_name"), exc)

    logger.info("Bot-Manager: %d Instanzen geladen", len(manager.list_instances()))


app = FastAPI(
    title="TCB Bot-Manager",
    version="0.2.0",
    docs_url="/docs",
    lifespan=lifespan,
)


class StartRequest(BaseModel):
    tenant_id: str
    channel: str
    bot_username: str


class StopRequest(BaseModel):
    tenant_id: str
    channel: str


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0", "service": "bot-manager"}


@app.get("/instances")
async def list_instances():
    manager = get_manager()
    return {"instances": manager.list_instances()}


@app.post("/instances/start")
async def start_instance(data: StartRequest):
    manager = get_manager()
    started = await manager.start_instance(
        tenant_id=data.tenant_id,
        channel=data.channel,
        bot_username=data.bot_username,
    )
    if not started:
        raise HTTPException(status_code=409, detail="Instanz läuft bereits")
    return {"ok": True, "channel": data.channel}


@app.post("/instances/stop")
async def stop_instance(data: StopRequest):
    manager = get_manager()
    stopped = await manager.stop_instance(tenant_id=data.tenant_id, channel=data.channel)
    if not stopped:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    return {"ok": True, "channel": data.channel}
