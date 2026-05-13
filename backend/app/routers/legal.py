from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from ..core.database import get_db
from ..core.deps import require_admin
from ..models.settings import LegalPage

router = APIRouter(prefix="/legal", tags=["legal"])


class LegalPageUpdate(BaseModel):
    title_de: Optional[str] = None
    title_en: Optional[str] = None
    content_de: Optional[str] = None
    content_en: Optional[str] = None


@router.get("/{slug}")
async def get_legal_page(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LegalPage).where(LegalPage.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Seite nicht gefunden")
    return {
        "slug": page.slug,
        "title_de": page.title_de,
        "title_en": page.title_en,
        "content_de": page.content_de,
        "content_en": page.content_en,
    }


@router.patch("/{slug}", dependencies=[Depends(require_admin)])
async def update_legal_page(slug: str, data: LegalPageUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LegalPage).where(LegalPage.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Seite nicht gefunden")
    if data.title_de is not None:
        page.title_de = data.title_de
    if data.title_en is not None:
        page.title_en = data.title_en
    if data.content_de is not None:
        page.content_de = data.content_de
    if data.content_en is not None:
        page.content_en = data.content_en
    await db.commit()
    return {"ok": True}
