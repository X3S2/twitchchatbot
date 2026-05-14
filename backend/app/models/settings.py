import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    client_id_enc: Mapped[str | None] = mapped_column(Text)
    client_secret_enc: Mapped[str | None] = mapped_column(Text)
    bot_username: Mapped[str | None] = mapped_column(String(128))
    bot_token_enc: Mapped[str | None] = mapped_column(Text)
    bot_refresh_token_enc: Mapped[str | None] = mapped_column(Text)
    bot_user_id: Mapped[str | None] = mapped_column(String(64))
    global_retention_days: Mapped[int] = mapped_column(default=180)
    reconnect_mode_default: Mapped[str] = mapped_column(String(32), default="unlimited")
    reconnect_max_attempts: Mapped[int] = mapped_column(default=10)
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    maintenance_message: Mapped[str] = mapped_column(Text, default="Das System wird gerade gewartet. Bitte versuche es später erneut.")
    global_timezone: Mapped[str] = mapped_column(String(64), default="Europe/Berlin")
    setup_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LegalPage(Base):
    __tablename__ = "legal_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    title_de: Mapped[str] = mapped_column(String(256), default="")
    title_en: Mapped[str] = mapped_column(String(256), default="")
    content_de: Mapped[str] = mapped_column(Text, default="")
    content_en: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
