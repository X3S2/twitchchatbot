from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user, require_admin
from ..models.user import User
from ..models.name_scan import NameScanFilter, NameScanResult, NameScanTenantOptin

router = APIRouter(prefix="/name-scan", tags=["name-scan"])


class ScanFilterCreate(BaseModel):
    name: str
    description: str | None = None
    pattern_rules_json: dict = {}
    whitelist_json: list = []
    blacklist_json: list = []
    trigger_action: str = "flag"
    trigger_message: str | None = None
    enabled: bool = True


class ScanFilterUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    pattern_rules_json: dict | None = None
    whitelist_json: list | None = None
    blacklist_json: list | None = None
    trigger_action: str | None = None
    trigger_message: str | None = None
    enabled: bool | None = None


class OptinCreate(BaseModel):
    scan_filter_id: str
    auto_ban: bool = False


@router.get("/filters")
async def list_scan_filters(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NameScanFilter).order_by(NameScanFilter.name))
    return [_sf_dict(f) for f in result.scalars().all()]


@router.post("/filters")
async def create_scan_filter(
    data: ScanFilterCreate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    f = NameScanFilter(
        name=data.name,
        description=data.description,
        pattern_rules_json=data.pattern_rules_json,
        whitelist_json=data.whitelist_json,
        blacklist_json=data.blacklist_json,
        trigger_action=data.trigger_action,
        trigger_message=data.trigger_message,
        enabled=data.enabled,
        created_by=admin.id,
    )
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return {"id": str(f.id), "ok": True}


@router.put("/filters/{filter_id}")
async def update_scan_filter(
    filter_id: str,
    data: ScanFilterUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NameScanFilter).where(NameScanFilter.id == filter_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404)
    if data.name is not None: f.name = data.name
    if data.description is not None: f.description = data.description
    if data.pattern_rules_json is not None: f.pattern_rules_json = data.pattern_rules_json
    if data.whitelist_json is not None: f.whitelist_json = data.whitelist_json
    if data.blacklist_json is not None: f.blacklist_json = data.blacklist_json
    if data.trigger_action is not None: f.trigger_action = data.trigger_action
    if data.trigger_message is not None: f.trigger_message = data.trigger_message
    if data.enabled is not None: f.enabled = data.enabled
    await db.commit()
    return {"ok": True}


@router.delete("/filters/{filter_id}")
async def delete_scan_filter(
    filter_id: str,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NameScanFilter).where(NameScanFilter.id == filter_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404)
    await db.delete(f)
    await db.commit()
    return {"ok": True}


@router.get("/filters/{filter_id}/results")
async def get_scan_results(
    filter_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    result = await db.execute(
        select(NameScanResult)
        .where(NameScanResult.scan_filter_id == filter_id)
        .order_by(desc(NameScanResult.found_at))
        .limit(limit)
        .offset(offset)
    )
    return [{"id": str(r.id), "twitch_user_id": r.twitch_user_id, "twitch_username": r.twitch_username, "found_at": r.found_at, "banned_globally": r.banned_globally} for r in result.scalars().all()]


# ── Tenant-Opt-In ─────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/optins")
async def get_optins(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NameScanTenantOptin, NameScanFilter)
        .join(NameScanFilter, NameScanTenantOptin.scan_filter_id == NameScanFilter.id)
        .where(NameScanTenantOptin.tenant_id == tenant_id)
    )
    return [{"scan_filter_id": str(row.NameScanTenantOptin.scan_filter_id), "filter_name": row.NameScanFilter.name, "auto_ban": row.NameScanTenantOptin.auto_ban} for row in result.all()]


@router.post("/tenants/{tenant_id}/optins")
async def add_optin(
    tenant_id: str,
    data: OptinCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(NameScanTenantOptin).where(
            NameScanTenantOptin.tenant_id == tenant_id,
            NameScanTenantOptin.scan_filter_id == data.scan_filter_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409)
    optin = NameScanTenantOptin(tenant_id=tenant_id, scan_filter_id=data.scan_filter_id, auto_ban=data.auto_ban)
    db.add(optin)
    await db.commit()
    return {"ok": True}


@router.delete("/tenants/{tenant_id}/optins/{scan_filter_id}")
async def remove_optin(
    tenant_id: str,
    scan_filter_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NameScanTenantOptin).where(
            NameScanTenantOptin.tenant_id == tenant_id,
            NameScanTenantOptin.scan_filter_id == scan_filter_id,
        )
    )
    optin = result.scalar_one_or_none()
    if not optin:
        raise HTTPException(status_code=404)
    await db.delete(optin)
    await db.commit()
    return {"ok": True}


def _sf_dict(f: NameScanFilter) -> dict:
    return {
        "id": str(f.id),
        "name": f.name,
        "description": f.description,
        "trigger_action": f.trigger_action,
        "enabled": f.enabled,
        "created_at": f.created_at,
    }
