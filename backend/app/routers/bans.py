import csv
import io
import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete, and_
from pydantic import BaseModel

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.ban import Ban, SharedBanConnection, BanInvitation, BatchJob
from ..models.tenant import Tenant, TenantModerator

router = APIRouter(prefix="/tenants/{tenant_id}/bans", tags=["bans"])


async def _check_access(tenant_id: str, user: User, db: AsyncSession, require_editor: bool = True) -> None:
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
            TenantModerator.revoked_at.is_(None),
        )
    )
    if not mod.scalar_one_or_none():
        raise HTTPException(status_code=403)
    if require_editor:
        mod2 = await db.execute(
            select(TenantModerator).where(
                TenantModerator.tenant_id == tenant_id,
                TenantModerator.twitch_user_id == user.twitch_id,
                TenantModerator.role == "editor",
                TenantModerator.revoked_at.is_(None),
            )
        )
        if not mod2.scalar_one_or_none():
            raise HTTPException(status_code=403)


class BanCreate(BaseModel):
    twitch_user_id: str
    twitch_username: str | None = None
    type: str = "permanent"
    duration_seconds: int | None = None
    reason: str | None = None
    note: str | None = None


class BanUpdate(BaseModel):
    note: str | None = None
    reason: str | None = None
    failover_protected: bool | None = None


class BulkBanRequest(BaseModel):
    entries: list[BanCreate]


class ImportRow(BaseModel):
    twitch_user_id: str
    twitch_username: str | None = None
    type: str = "permanent"
    reason: str | None = None


@router.get("")
async def list_bans(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    search: str | None = None,
    type: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    await _check_access(tenant_id, current_user, db, require_editor=False)
    q = select(Ban).where(Ban.tenant_id == tenant_id)
    if search:
        q = q.where(Ban.twitch_username.ilike(f"%{search}%"))
    if type:
        q = q.where(Ban.type == type)
    q = q.order_by(desc(Ban.created_at)).limit(limit).offset(offset)
    result = await db.execute(q)
    bans = result.scalars().all()
    return [_ban_dict(b) for b in bans]


@router.post("")
async def create_ban(
    tenant_id: str,
    data: BanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    ban = Ban(
        tenant_id=tenant_id,
        twitch_user_id=data.twitch_user_id,
        twitch_username=data.twitch_username,
        type=data.type,
        duration_seconds=data.duration_seconds,
        reason=data.reason,
        note=data.note,
        created_by=current_user.id,
    )
    db.add(ban)
    await db.commit()
    await db.refresh(ban)
    return {"id": str(ban.id), "ok": True}


@router.patch("/{ban_id}")
async def update_ban(
    tenant_id: str,
    ban_id: str,
    data: BanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(select(Ban).where(Ban.id == ban_id, Ban.tenant_id == tenant_id))
    ban = result.scalar_one_or_none()
    if not ban:
        raise HTTPException(status_code=404)
    if data.note is not None:
        ban.note = data.note
    if data.reason is not None:
        ban.reason = data.reason
    if data.failover_protected is not None:
        ban.failover_protected = data.failover_protected
    await db.commit()
    return {"ok": True}


@router.delete("/{ban_id}")
async def delete_ban(
    tenant_id: str,
    ban_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    add_to_whitelist: bool = False,
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(select(Ban).where(Ban.id == ban_id, Ban.tenant_id == tenant_id))
    ban = result.scalar_one_or_none()
    if not ban:
        raise HTTPException(status_code=404)
    if add_to_whitelist:
        # Failover-Schutz: Neuen Eintrag mit failover_protected=True anlegen statt löschen
        ban.failover_protected = True
        ban.note = (ban.note or "") + " [manuell entsperrt]"
        await db.commit()
    else:
        await db.delete(ban)
        await db.commit()
    return {"ok": True}


@router.post("/bulk-unban")
async def bulk_unban(
    tenant_id: str,
    ban_ids: list[str],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    add_to_whitelist: bool = False,
):
    await _check_access(tenant_id, current_user, db)
    await db.execute(
        delete(Ban).where(Ban.id.in_(ban_ids), Ban.tenant_id == tenant_id)
    )
    await db.commit()
    return {"ok": True, "deleted": len(ban_ids)}


@router.get("/export")
async def export_bans(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    format: str = "json",
):
    await _check_access(tenant_id, current_user, db, require_editor=False)
    result = await db.execute(select(Ban).where(Ban.tenant_id == tenant_id).order_by(desc(Ban.created_at)))
    bans = result.scalars().all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["twitch_user_id", "twitch_username", "type", "reason", "duration_seconds", "note", "created_at"])
        for b in bans:
            writer.writerow([b.twitch_user_id, b.twitch_username or "", b.type, b.reason or "", b.duration_seconds or "", b.note or "", b.created_at])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=bans_{tenant_id}.csv"},
        )

    data = [{"twitch_user_id": b.twitch_user_id, "twitch_username": b.twitch_username, "type": b.type, "reason": b.reason, "duration_seconds": b.duration_seconds, "note": b.note, "created_at": str(b.created_at)} for b in bans]
    content = json.dumps(data, indent=2, ensure_ascii=False)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=bans_{tenant_id}.json"},
    )


@router.post("/import")
async def import_bans(
    tenant_id: str,
    entries: list[ImportRow],
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Import-Vorschau (Dry-Run) — gibt Liste zurück, ohne zu schreiben."""
    await _check_access(tenant_id, current_user, db)
    # Echtes Importieren erfolgt über /import/confirm
    existing_ids = set()
    result = await db.execute(select(Ban.twitch_user_id).where(Ban.tenant_id == tenant_id))
    for row in result.all():
        existing_ids.add(row[0])
    preview = [{"twitch_user_id": e.twitch_user_id, "twitch_username": e.twitch_username, "type": e.type, "reason": e.reason, "already_exists": e.twitch_user_id in existing_ids} for e in entries]
    return {"preview": preview, "total": len(entries), "new": sum(1 for p in preview if not p["already_exists"])}


@router.post("/import/confirm")
async def confirm_import(
    tenant_id: str,
    entries: list[ImportRow],
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    job = BatchJob(tenant_id=tenant_id, user_id=current_user.id, type="ban_import", status="pending", total=len(entries))
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(_run_import_job, str(job.id), tenant_id, entries)
    return {"job_id": str(job.id), "ok": True}


async def _run_import_job(job_id: str, tenant_id: str, entries: list[ImportRow]):
    from ..core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(BatchJob).where(BatchJob.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return
        job.status = "running"
        await db.commit()
        processed = 0
        failed = 0
        for entry in entries:
            try:
                ban = Ban(tenant_id=tenant_id, twitch_user_id=entry.twitch_user_id, twitch_username=entry.twitch_username, type=entry.type, reason=entry.reason)
                db.add(ban)
                await db.flush()
                processed += 1
            except Exception:
                failed += 1
        job.processed = processed
        job.failed = failed
        job.status = "done"
        from datetime import datetime, timezone
        job.finished_at = datetime.now(timezone.utc)
        await db.commit()


# ── Shared Bans ───────────────────────────────────────────────

@router.get("/shared")
async def list_shared_connections(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Gibt alle geteilten Banlisten-Verbindungen für diesen Tenant zurück."""
    await _check_access(tenant_id, current_user, db, require_editor=False)
    result = await db.execute(
        select(SharedBanConnection).where(
            (SharedBanConnection.tenant_a_id == tenant_id) | (SharedBanConnection.tenant_b_id == tenant_id)
        )
    )
    connections = result.scalars().all()
    out = []
    for c in connections:
        partner_id = str(c.tenant_b_id) if str(c.tenant_a_id) == tenant_id else str(c.tenant_a_id)
        role = "source" if str(c.tenant_a_id) == tenant_id else "target"
        # Partner Kanal-Name laden
        partner = await db.execute(select(Tenant).where(Tenant.id == partner_id))
        partner_tenant = partner.scalar_one_or_none()
        out.append({
            "id": str(c.id),
            "partner_channel_name": partner_tenant.channel_name if partner_tenant else partner_id,
            "role": role,
            "status": c.status,
            "created_at": str(c.created_at),
        })
    return out


@router.delete("/shared/{connection_id}")
async def remove_shared_connection(
    tenant_id: str,
    connection_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Entfernt eine Banlisten-Sharing-Verbindung (beidseitig)."""
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(
        select(SharedBanConnection).where(
            SharedBanConnection.id == connection_id,
            (SharedBanConnection.tenant_a_id == tenant_id) | (SharedBanConnection.tenant_b_id == tenant_id)
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404)
    await db.delete(conn)
    await db.commit()
    return {"ok": True}


@router.get("/invitations")
async def list_invitations(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Listet eingehende Einladungen (pending) für diesen Tenant."""
    await _check_access(tenant_id, current_user, db, require_editor=False)
    result = await db.execute(
        select(BanInvitation).where(
            BanInvitation.to_tenant_id == tenant_id,
            BanInvitation.status == "pending",
        )
    )
    invs = result.scalars().all()
    out = []
    for inv in invs:
        sender = await db.execute(select(Tenant).where(Tenant.id == inv.from_tenant_id))
        sender_tenant = sender.scalar_one_or_none()
        out.append({
            "id": str(inv.id),
            "sender_channel": sender_tenant.channel_name if sender_tenant else str(inv.from_tenant_id),
            "created_at": str(inv.created_at),
        })
    return out


class InvitationRequest(BaseModel):
    target_channel_name: str


@router.post("/invitations")
async def send_invitation(
    tenant_id: str,
    data: InvitationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Sendet eine Einladung zur geteilten Banliste an einen anderen Kanal."""
    await _check_access(tenant_id, current_user, db)
    # Ziel-Tenant suchen
    target = await db.execute(select(Tenant).where(Tenant.channel_name == data.target_channel_name.lower().strip()))
    target_tenant = target.scalar_one_or_none()
    if not target_tenant:
        raise HTTPException(status_code=404, detail="Kanal nicht gefunden")
    if str(target_tenant.id) == tenant_id:
        raise HTTPException(status_code=400, detail="Einladung an sich selbst nicht möglich")
    inv = BanInvitation(from_tenant_id=tenant_id, to_tenant_id=str(target_tenant.id))
    db.add(inv)
    await db.commit()
    return {"ok": True}


@router.post("/invitations/{invitation_id}/accept")
async def accept_invitation(
    tenant_id: str,
    invitation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(select(BanInvitation).where(BanInvitation.id == invitation_id, BanInvitation.to_tenant_id == tenant_id, BanInvitation.status == "pending"))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404)
    inv.status = "accepted"
    inv.resolved_at = datetime.now(timezone.utc)
    conn = SharedBanConnection(tenant_a_id=inv.from_tenant_id, tenant_b_id=tenant_id)
    db.add(conn)
    await db.commit()
    return {"ok": True}


@router.post("/invitations/{invitation_id}/reject")
async def reject_invitation(
    tenant_id: str,
    invitation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(select(BanInvitation).where(BanInvitation.id == invitation_id, BanInvitation.to_tenant_id == tenant_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404)
    inv.status = "rejected"
    inv.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


# Legacy-Alias
@router.get("/shared/connections")
async def list_shared_connections_legacy(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    return await list_shared_connections(tenant_id, current_user, db)



def _ban_dict(b: Ban) -> dict:
    return {
        "id": str(b.id),
        "twitch_user_id": b.twitch_user_id,
        "twitch_username": b.twitch_username,
        "type": b.type,
        "duration_seconds": b.duration_seconds,
        "reason": b.reason,
        "source": b.source,
        "failover_protected": b.failover_protected,
        "note": b.note,
        "created_at": b.created_at,
    }
