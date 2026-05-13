import uuid
from sqlalchemy import String, Boolean, DateTime, func, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class NameScanFilter(Base):
    __tablename__ = "name_scan_filters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    pattern_rules_json: Mapped[list | None] = mapped_column(JSON)
    whitelist_json: Mapped[list | None] = mapped_column(JSON)
    blacklist_json: Mapped[list | None] = mapped_column(JSON)
    trigger_action: Mapped[str] = mapped_column(String(32), nullable=False, default="ban")
    trigger_message: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NameScanResult(Base):
    __tablename__ = "name_scan_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("name_scan_filters.id", ondelete="CASCADE"), nullable=False)
    twitch_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    twitch_username: Mapped[str | None] = mapped_column(String(128))
    found_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    banned_globally: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class NameScanTenantOptin(Base):
    __tablename__ = "name_scan_tenant_optins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_filter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("name_scan_filters.id", ondelete="CASCADE"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    auto_ban: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    opted_in_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FilterTemplate(Base):
    __tablename__ = "filter_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="chat")
    config_json: Mapped[dict | None] = mapped_column(JSON)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
