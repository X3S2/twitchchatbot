from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.ban import BatchJob
from ..models.tenant import Tenant, TenantModerator

router = APIRouter(prefix="/jobs", tags=["jobs"])


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
            TenantModerator.revoked_at.is_(None),
        )
    )
    if not mod.scalar_one_or_none():
        raise HTTPException(status_code=403)


@router.get("/tenants/{tenant_id}/jobs")
async def list_jobs(
    tenant_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(
        select(BatchJob).where(BatchJob.tenant_id == tenant_id).order_by(desc(BatchJob.created_at)).limit(50)
    )
    jobs = result.scalars().all()
    return [_job_dict(j) for j in jobs]


@router.get("/tenants/{tenant_id}/jobs/{job_id}")
async def get_job(
    tenant_id: str,
    job_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await _check_access(tenant_id, current_user, db)
    result = await db.execute(
        select(BatchJob).where(BatchJob.id == job_id, BatchJob.tenant_id == tenant_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404)
    return _job_dict(job)


def _job_dict(j: BatchJob) -> dict:
    return {
        "id": str(j.id),
        "type": j.type,
        "status": j.status,
        "total": j.total,
        "processed": j.processed,
        "failed": j.failed,
        "error_json": j.error_json,
        "created_at": j.created_at,
        "finished_at": j.finished_at,
    }
