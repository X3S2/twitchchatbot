import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, Integer, ForeignKey, JSON, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel_name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(128))
    bot_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="shared")
    own_client_id_enc: Mapped[str | None] = mapped_column(Text)
    own_client_secret_enc: Mapped[str | None] = mapped_column(Text)
    own_bot_token_enc: Mapped[str | None] = mapped_column(Text)
    own_bot_refresh_token_enc: Mapped[str | None] = mapped_column(Text)
    own_bot_username: Mapped[str | None] = mapped_column(String(128))
    own_bot_user_id: Mapped[str | None] = mapped_column(String(64))
    stream_awareness: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bot_language: Mapped[str] = mapped_column(String(8), nullable=False, default="de")
    reconnect_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="unlimited")
    reconnect_max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    regex_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    new_mod_default_role: Mapped[str] = mapped_column(String(32), nullable=False, default="viewer")
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approval_requested_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    stream_live: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BotInstance(Base):
    __tablename__ = "bot_instances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="offline")
    last_heartbeat: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    connected_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    stream_live: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reconnect_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TenantModerator(Base):
    __tablename__ = "tenant_moderators"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    twitch_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    twitch_username: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="viewer")
    granted_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    granted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    revoked_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="SET NULL"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    detail_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
