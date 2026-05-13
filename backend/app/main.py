from contextlib import asynccontextmanager
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

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Redis-Verbindung testen
    redis = await get_redis()
    await redis.ping()
    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title="TwitchChatBot API",
    version="0.1.0",
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


# ── Health-Check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
