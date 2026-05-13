from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .instance_manager import get_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Shutdown: alle Instanzen stoppen
    manager = get_manager()
    await manager.shutdown_all()


app = FastAPI(
    title="TCB Bot-Manager",
    version="0.1.0",
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
    return {"status": "ok", "version": "0.1.0", "service": "bot-manager"}


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
