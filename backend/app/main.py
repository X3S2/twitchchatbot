from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .core.config import get_settings
from .core.database import engine
from .core.redis_client import get_redis, close_redis
from .routers import auth, admin, legal
from .routers import (
    ws, internal, notifications, tenants,
    chat_filters, name_filters, bans, jobs,
    commands, stats, name_scan, twitch_users,
    multi_ban,
)
from .tasks.mod_check import mod_check_loop

logger = logging.getLogger(__name__)
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

_redis_task: asyncio.Task | None = None
_mod_check_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _redis_task, _mod_check_task
    redis = await get_redis()
    await redis.ping()
    # Redis-Subscriber als Background-Task starten
    _redis_task = asyncio.create_task(ws.redis_subscriber())
    # Mod-Check Background-Task (alle 5 Minuten)
    _mod_check_task = asyncio.create_task(mod_check_loop())
    yield
    # Shutdown
    for task in (_redis_task, _mod_check_task):
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    await close_redis()


app = FastAPI(
    title="TwitchChatBot API",
    version="0.2.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Maintenance-Mode Middleware ───────────────────────────────
@app.middleware("http")
async def maintenance_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/admin") or request.url.path == "/health":
        return await call_next(request)
    from sqlalchemy import select
    from .core.database import AsyncSessionLocal
    from .models.settings import AppSettings
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        cfg = result.scalar_one_or_none()
        if cfg and cfg.maintenance_mode:
            return JSONResponse(
                status_code=503,
                content={"detail": cfg.maintenance_message, "maintenance": True},
            )
    return await call_next(request)


# ── Router einbinden ──────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(legal.router, prefix="/api")
app.include_router(ws.router, prefix="/api")
app.include_router(internal.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(chat_filters.router, prefix="/api")
app.include_router(name_filters.router, prefix="/api")
app.include_router(bans.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(commands.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(name_scan.router, prefix="/api")
app.include_router(twitch_users.router, prefix="/api")
app.include_router(multi_ban.router, prefix="/api")


# ── Health-Check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0"}
