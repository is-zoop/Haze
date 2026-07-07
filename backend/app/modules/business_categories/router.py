from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.response import ApiResponse, success_response
from app.core.security import get_current_user, require_capabilities
from app.db.session import get_db
from app.modules.business_categories.models import BusinessCategory
from app.modules.business_categories.schemas import CategoryData, CategoryWrite
from app.modules.capabilities.models import Capability
from app.modules.users.models import User

router = APIRouter(prefix="/api/business-categories", tags=["business categories"])


def _data(row: BusinessCategory) -> CategoryData:
    return CategoryData(
        id=row.id, name=row.name, description=row.description,
        created_by=row.creator.name if row.creator else None, created_at=row.created_at,
        updated_by=row.updater.name if row.updater else None, updated_at=row.updated_at,
    )


def _clean(payload: CategoryWrite) -> tuple[str, str | None]:
    name = payload.name.strip()
    if not name:
        raise AppException(code=4221, message="\u4e1a\u52a1\u5206\u7c7b\u4e0d\u80fd\u4e3a\u7a7a", status_code=422)
    description = payload.description.strip() if payload.description else None
    return name, description or None


def _ensure_unique(db: Session, name: str, exclude_id: int | None = None) -> None:
    stmt = select(BusinessCategory.id).where(BusinessCategory.name_normalized == name.casefold())
    if exclude_id is not None:
        stmt = stmt.where(BusinessCategory.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise AppException(code=40920, message="\u4e1a\u52a1\u5206\u7c7b\u540d\u79f0\u5df2\u5b58\u5728", status_code=409)


@router.get("", response_model=ApiResponse[list[CategoryData]])
def list_categories(request: Request, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(get_current_user)]) -> ApiResponse[list[CategoryData]]:
    rows = db.scalars(select(BusinessCategory).order_by(BusinessCategory.id)).all()
    return success_response(request, [_data(row) for row in rows])


@router.post("", response_model=ApiResponse[CategoryData])
def create_category(payload: CategoryWrite, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("business_categories.manage"))]) -> ApiResponse[CategoryData]:
    name, description = _clean(payload)
    _ensure_unique(db, name)
    row = BusinessCategory(name=name, name_normalized=name.casefold(), description=description, created_by=actor.id, updated_by=actor.id)
    try:
        db.add(row); db.commit(); db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(code=40920, message="\u4e1a\u52a1\u5206\u7c7b\u540d\u79f0\u5df2\u5b58\u5728", status_code=409) from exc
    return success_response(request, _data(row))


@router.put("/{category_id}", response_model=ApiResponse[CategoryData])
def update_category(category_id: int, payload: CategoryWrite, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("business_categories.manage"))]) -> ApiResponse[CategoryData]:
    row = db.get(BusinessCategory, category_id)
    if row is None:
        raise AppException(code=40420, message="\u4e1a\u52a1\u5206\u7c7b\u4e0d\u5b58\u5728", status_code=404)
    name, description = _clean(payload)
    _ensure_unique(db, name, row.id)
    row.name, row.name_normalized, row.description, row.updated_by = name, name.casefold(), description, actor.id
    try:
        db.commit(); db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(code=40920, message="\u4e1a\u52a1\u5206\u7c7b\u540d\u79f0\u5df2\u5b58\u5728", status_code=409) from exc
    return success_response(request, _data(row))


@router.delete("/{category_id}", response_model=ApiResponse[dict[str, bool]])
def delete_category(category_id: int, request: Request, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_capabilities("business_categories.manage"))]) -> ApiResponse[dict[str, bool]]:
    row = db.get(BusinessCategory, category_id)
    if row is None:
        raise AppException(code=40420, message="\u4e1a\u52a1\u5206\u7c7b\u4e0d\u5b58\u5728", status_code=404)
    if db.scalar(select(Capability.id).where(Capability.category_id == category_id).limit(1)):
        raise AppException(code=40921, message="\u8be5\u4e1a\u52a1\u5206\u7c7b\u5df2\u88ab\u80fd\u529b\u4f7f\u7528\uff0c\u65e0\u6cd5\u5220\u9664", status_code=409)
    try:
        db.delete(row); db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppException(code=40921, message="\u8be5\u4e1a\u52a1\u5206\u7c7b\u5df2\u88ab\u80fd\u529b\u4f7f\u7528\uff0c\u65e0\u6cd5\u5220\u9664", status_code=409) from exc
    return success_response(request, {"deleted": True})