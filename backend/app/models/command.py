import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class ChatCommand(Base):
    __tablename__ = "chat_commands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    command_name: Mapped[str] = mapped_column(String(64), nullable=False)
    permission_level: Mapped[str] = mapped_column(String(32), nullable=False, default="everyone")
    global_cooldown_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    user_cooldown_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    action_type: Mapped[str] = mapped_column(String(32), nullable=False, default="response")
    response_template: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CommandCooldownTracking(Base):
    __tablename__ = "command_cooldown_tracking"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    command_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_commands.id", ondelete="CASCADE"), nullable=False)
    twitch_user_id: Mapped[str | None] = mapped_column(String(64))
    last_used: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
