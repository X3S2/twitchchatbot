import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class NameFilter(Base):
    __tablename__ = "name_filters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    test_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NameFilterPattern(Base):
    __tablename__ = "name_filter_patterns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("name_filters.id", ondelete="CASCADE"), nullable=False)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    is_regex: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_whitelist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class NameFilterTier(Base):
    __tablename__ = "name_filter_tiers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("name_filters.id", ondelete="CASCADE"), nullable=False)
    tier_order: Mapped[int] = mapped_column(Integer, nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=1440)
    action: Mapped[str] = mapped_column(String(32), nullable=False, default="ban")
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message_template: Mapped[str | None] = mapped_column(Text)
