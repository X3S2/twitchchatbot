from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.database import get_db
from ..models.settings import LegalPage

router = APIRouter(prefix="/legal", tags=["legal"])


@router.get("/{slug}")
async def get_legal_page(slug: str, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
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
