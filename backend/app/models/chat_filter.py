import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, Integer, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class ChatFilter(Base):
    __tablename__ = "chat_filters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    case_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    test_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ChatFilterTerm(Base):
    __tablename__ = "chat_filter_terms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_filters.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(Text, nullable=False)
    is_regex: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_whitelist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    similarity_threshold: Mapped[float | None] = mapped_column(Float)


class ChatFilterTier(Base):
    __tablename__ = "chat_filter_tiers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_filters.id", ondelete="CASCADE"), nullable=False)
    tier_order: Mapped[int] = mapped_column(Integer, nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    action: Mapped[str] = mapped_column(String(32), nullable=False, default="timeout")
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    message_template: Mapped[str | None] = mapped_column(Text)


class ChatFilterViolation(Base):
    __tablename__ = "chat_filter_violations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_filters.id", ondelete="CASCADE"), nullable=False)
    twitch_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    tier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_filter_tiers.id", ondelete="SET NULL"))
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    window_start: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatFilterHit(Base):
    __tablename__ = "chat_filter_hits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_filters.id", ondelete="CASCADE"), nullable=False)
    twitch_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    twitch_username: Mapped[str | None] = mapped_column(String(128))
    message_text: Mapped[str | None] = mapped_column(Text)
    matched_term: Mapped[str | None] = mapped_column(Text)
    context_before_json: Mapped[list | None] = mapped_column(JSON)
    context_after_json: Mapped[list | None] = mapped_column(JSON)
    test_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    action_taken: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
