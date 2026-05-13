import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Alembic Config-Objekt
config = context.config

# Logging-Konfiguration aus alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# SQLAlchemy-Modelle importieren (für autogenerate)
from app.core.database import Base
from app.models import (
    User, AppSettings, LegalPage, Notification,
    Tenant, BotInstance, TenantModerator, AuditLog,
    ChatFilter, ChatFilterTerm, ChatFilterTier, ChatFilterViolation, ChatFilterHit,
    NameFilter, NameFilterPattern, NameFilterTier,
    Ban, SharedBanConnection, BanInvitation, BatchJob,
    TwitchUser, TenantUserExclusion, GlobalUserExclusion,
    ChatCommand, CommandCooldownTracking,
    NameScanFilter, NameScanResult, NameScanTenantOptin, FilterTemplate,
)
from app.models.session import Session

target_metadata = Base.metadata

# DATABASE_URL aus Umgebungsvariablen überschreiben
import os
from app.core.config import get_settings

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
