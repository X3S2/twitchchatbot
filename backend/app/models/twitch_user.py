import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class TwitchUser(Base):
    __tablename__ = "twitch_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    twitch_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    current_username: Mapped[str] = mapped_column(String(128), nullable=False)
    username_history_json: Mapped[list | None] = mapped_column(JSON)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    first_seen: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TenantUserExclusion(Base):
    __tablename__ = "tenant_user_exclusions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    twitch_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    exclude_chat_filter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    exclude_name_filter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    exclude_scan: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GlobalUserExclusion(Base):
    __tablename__ = "global_user_exclusions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    twitch_user_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    exclude_chat_filter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    exclude_name_filter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    exclude_scan: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    set_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
