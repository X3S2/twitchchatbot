from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.command import ChatCommand
from ..models.tenant import Tenant, TenantModerator

router = APIRouter(prefix="/tenants/{tenant_id}/commands", tags=["commands"])


async def _check_access(tenant_id: str, user: User, db: AsyncSession) -> None:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404)
    if user.role == "admin" or str(tenant.user_id) == str(user.id):
        return
    mod = await db.execute(
        select(TenantModerator).where(
            TenantModerator.tenant_id == tenant_id,
            TenantModerator.twitch_user_id == user.twitch_id,
            TenantModerator.role == "editor",
            TenantModerator.revoked_at.is_(None),
        )
    )
    if not mod.scalar_one_or_none():
        raise HTTPException(status_code=403)


PERMISSION_LEVELS = ["everyone", "subscriber", "vip", "moderator", "broadcaster", "editor", "owner", "admin"]
ACTION_TYPES = [
    "respond", "ban", "timeout", "delete", "bot_stop", "bot_restart", "bot_start", "unban_user", "test_mode_toggle",
    # Legacy aliases
    "response", "tcbstop", "tcbstart", "tcbrejoin", "tcbstatus", "tcbfilter", "tcbwl", "tcbbl", "tcbinfo", "tcbstats",
]


class CommandCreate(BaseModel):
    command_name: str
    permission_level: str = "everyone"
    global_cooldown_sec: int = 5
    user_cooldown_sec: int = 30
    action_type: str = "response"
    response_template: str | None = None
    enabled: bool = True


class CommandUpdate(BaseModel):
    command_name: str | None = None
    permission_level: str | None = None
    global_cooldown_sec: int | None = None
    user_cooldown_sec: int | None = None
    action_type: str | None = None
    response_template: str | None = None
    enabled: bool | None = None


@router.get("")
async def list_commands(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(
        select(ChatCommand).where(ChatCommand.tenant_id == tenant_id).order_by(ChatCommand.command_name)
    )
    return [_cmd_dict(c) for c in result.scalars().all()]


@router.post("")
async def create_command(
    tenant_id: str,
    data: CommandCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    normalized_name = data.command_name.strip().lower()
    if not normalized_name.startswith("!"):
        normalized_name = "!" + normalized_name
    existing = await db.execute(
        select(ChatCommand).where(ChatCommand.tenant_id == tenant_id, ChatCommand.command_name == normalized_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Befehl existiert bereits")
    action_type = _normalize_action_type(data.action_type)
    if action_type not in ACTION_TYPES:
        action_type = "respond"
    cmd = ChatCommand(
        tenant_id=tenant_id,
        command_name=normalized_name,
        permission_level=data.permission_level if data.permission_level in PERMISSION_LEVELS else "everyone",
        global_cooldown_sec=max(0, data.global_cooldown_sec),
        user_cooldown_sec=max(0, data.user_cooldown_sec),
        action_type=action_type,
        response_template=data.response_template,
        enabled=data.enabled,
    )
    db.add(cmd)
    await db.commit()
    await db.refresh(cmd)
    return {"id": str(cmd.id), "ok": True}


@router.put("/{command_id}")
async def update_command(
    tenant_id: str,
    command_id: str,
    data: CommandUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(
        select(ChatCommand).where(ChatCommand.id == command_id, ChatCommand.tenant_id == tenant_id)
    )
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404)
    if data.command_name is not None:
        normalized_name = data.command_name.strip().lower()
        if not normalized_name.startswith("!"):
            normalized_name = "!" + normalized_name
        cmd.command_name = normalized_name
    if data.permission_level is not None:
        cmd.permission_level = data.permission_level
    if data.global_cooldown_sec is not None:
        cmd.global_cooldown_sec = max(0, data.global_cooldown_sec)
    if data.user_cooldown_sec is not None:
        cmd.user_cooldown_sec = max(0, data.user_cooldown_sec)
    if data.action_type is not None:
        normalized_action = _normalize_action_type(data.action_type)
        if normalized_action in ACTION_TYPES:
            cmd.action_type = normalized_action
    if data.response_template is not None:
        cmd.response_template = data.response_template
    if data.enabled is not None:
        cmd.enabled = data.enabled
    await db.commit()
    return {"ok": True}


@router.delete("/{command_id}")
async def delete_command(
    tenant_id: str,
    command_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(
        select(ChatCommand).where(ChatCommand.id == command_id, ChatCommand.tenant_id == tenant_id)
    )
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404)
    await db.delete(cmd)
    await db.commit()
    return {"ok": True}


def _cmd_dict(c: ChatCommand) -> dict:
    return {
        "id": str(c.id),
        "command_name": c.command_name,
        "permission_level": c.permission_level,
        "global_cooldown_sec": c.global_cooldown_sec,
        "user_cooldown_sec": c.user_cooldown_sec,
        "action_type": c.action_type,
        "response_template": c.response_template,
        "enabled": c.enabled,
        "created_at": c.created_at,
    }


def _normalize_action_type(action_type: str | None) -> str:
    if not action_type:
        return "respond"
    action = action_type.lower()
    mapping = {
        "response": "respond",
        "tcbstop": "bot_stop",
        "tcbstart": "bot_start",
        "tcbrejoin": "bot_restart",
    }
    return mapping.get(action, action)
