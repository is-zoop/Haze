from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.response import ApiResponse, success_response
from app.core.security import require_capabilities
from app.db.session import get_db
from app.modules.audit.models import CapabilityAuditRecord
from app.modules.audit.schemas import (
    AuditCapabilityItem,
    AuditDetailCapability,
    AuditDetailData,
    AuditDetailDeveloper,
    AuditDetailReview,
    AuditDetailVersion,
    AuditListData,
    AuditResultData,
    AuditReviewPayload,
    AuditStatsData,
)
from app.modules.capabilities.models import Capability, CapabilityVersion
from app.modules.users.models import Department, User

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _fmt_dt(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/stats", response_model=ApiResponse[AuditStatsData])
def get_audit_stats(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.audit"))],
) -> ApiResponse[AuditStatsData]:
    now = _utc_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    pending = db.scalar(
        select(func.count()).select_from(Capability).where(
            Capability.status == "reviewing",
            Capability.deleted_at.is_(None),
        )
    ) or 0

    today_reviewed = db.scalar(
        select(func.count()).select_from(CapabilityAuditRecord).where(
            CapabilityAuditRecord.reviewed_at >= today_start,
        )
    ) or 0

    week_records = db.execute(
        select(CapabilityAuditRecord.status).where(
            CapabilityAuditRecord.reviewed_at >= week_start,
        )
    ).scalars().all()

    week_pass_rate: float | None = None
    if week_records:
        approved_count = sum(1 for s in week_records if s == "approved")
        week_pass_rate = round(approved_count / len(week_records) * 100, 1)

    avg_review_hours: float | None = None
    durations = db.execute(
        select(CapabilityAuditRecord.submitted_at, CapabilityAuditRecord.reviewed_at).where(
            CapabilityAuditRecord.reviewed_at >= week_start,
            CapabilityAuditRecord.submitted_at.is_not(None),
        )
    ).all()
    if durations:
        total_secs = sum((r.reviewed_at - r.submitted_at).total_seconds() for r in durations if r.reviewed_at and r.submitted_at)
        avg_review_hours = round(total_secs / len(durations) / 3600, 1)

    return success_response(request, AuditStatsData(
        pending=pending,
        today_reviewed=today_reviewed,
        week_pass_rate=week_pass_rate,
        avg_review_hours=avg_review_hours,
    ))


@router.get("/capabilities", response_model=ApiResponse[AuditListData])
def list_audit_capabilities(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.audit"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: Literal["reviewing", "approved", "rejected", "all"] | None = Query(default=None),
    search: str = "",
    capability_type: Literal["skill", "mcp"] | None = Query(default=None, alias="type"),
    dept_id: int | None = Query(default=None),
) -> ApiResponse[AuditListData]:
    filters = [Capability.deleted_at.is_(None)]

    # 审核通过后能力会继续走 部署 → 调试 → 发布，这些都属于"已过审"状态
    approved_states = ["approved", "deployed", "deploy_failed", "debug_passed", "debug_failed", "published"]
    if status and status != "all":
        if status == "approved":
            filters.append(Capability.status.in_(approved_states))
        else:
            filters.append(Capability.status == status)
    else:
        filters.append(Capability.status.in_(["reviewing", "rejected", *approved_states]))

    if capability_type:
        filters.append(Capability.type == capability_type)
    if dept_id:
        filters.append(Capability.department_id == dept_id)
    if search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Capability.name.like(term), Capability.code.like(term)))

    total = db.scalar(select(func.count()).select_from(Capability).where(*filters)) or 0
    rows = db.execute(
        select(Capability).where(*filters).order_by(Capability.updated_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    if not rows:
        return success_response(request, AuditListData(items=[], page=page, page_size=page_size, total=total))

    cap_ids = [c.id for c in rows]
    owner_ids = list({c.owner_id for c in rows if c.owner_id})
    dept_ids = list({c.department_id for c in rows if c.department_id})

    owners: dict[int, str] = {}
    if owner_ids:
        for u in db.scalars(select(User).where(User.id.in_(owner_ids))).all():
            owners[u.id] = u.name

    depts: dict[int, str] = {}
    if dept_ids:
        for d in db.scalars(select(Department).where(Department.id.in_(dept_ids))).all():
            depts[d.id] = d.name

    audit_map: dict[int, CapabilityAuditRecord] = {}
    for rec in db.scalars(select(CapabilityAuditRecord).where(CapabilityAuditRecord.capability_id.in_(cap_ids))).all():
        audit_map[rec.capability_id] = rec

    reviewer_ids = list({r.reviewer_id for r in audit_map.values() if r.reviewer_id})
    reviewers: dict[int, str] = {}
    if reviewer_ids:
        for u in db.scalars(select(User).where(User.id.in_(reviewer_ids))).all():
            reviewers[u.id] = u.name

    items = []
    for c in rows:
        rec = audit_map.get(c.id)
        ext = c.extension_json or {}
        items.append(AuditCapabilityItem(
            id=str(c.id),
            name=c.name,
            code=c.code,
            type="Skill" if c.type == "skill" else "MCP",
            status=c.status,
            version=c.version,
            category_id=c.category_id,
            category=c.category,
            tags=ext.get("tags", []),
            author=owners.get(c.owner_id, "") if c.owner_id else "",
            department=depts.get(c.department_id) if c.department_id else None,
            submitted_at=_fmt_dt(rec.submitted_at) if rec and rec.submitted_at else (
                ext.get("submitted_at", "")[:19].replace("T", " ") if ext.get("submitted_at") else None
            ),
            reviewed_at=_fmt_dt(rec.reviewed_at) if rec else None,
            reviewer_name=reviewers.get(rec.reviewer_id) if rec and rec.reviewer_id else None,
            comment=rec.comment if rec else None,
            icon=f"/api/developer/capabilities/{c.id}/icon" if c.icon else None,
        ))

    return success_response(request, AuditListData(items=items, page=page, page_size=page_size, total=total))


@router.get("/capabilities/{capability_id}/detail", response_model=ApiResponse[AuditDetailData])
def get_audit_detail(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.audit"))],
) -> ApiResponse[AuditDetailData]:
    capability = db.scalar(
        select(Capability).where(Capability.id == capability_id, Capability.deleted_at.is_(None))
    )
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)

    ext = capability.extension_json or {}
    config = ext.get("config", {})

    owner: User | None = None
    dept_name: str | None = None
    if capability.owner_id:
        owner = db.scalar(select(User).where(User.id == capability.owner_id))
    if capability.department_id:
        dept = db.scalar(select(Department).where(Department.id == capability.department_id))
        dept_name = dept.name if dept else None

    rec = db.scalar(select(CapabilityAuditRecord).where(CapabilityAuditRecord.capability_id == capability_id))

    submitted_at_str: str | None = None
    if rec and rec.submitted_at:
        submitted_at_str = _fmt_dt(rec.submitted_at)
    elif "submitted_at" in ext:
        try:
            submitted_at_str = ext["submitted_at"][:19].replace("T", " ")
        except Exception:
            pass

    version_row = db.scalar(
        select(CapabilityVersion).where(
            CapabilityVersion.capability_id == capability_id,
            CapabilityVersion.version == capability.version,
        )
    )
    all_versions_count = db.scalar(
        select(func.count()).select_from(CapabilityVersion).where(CapabilityVersion.capability_id == capability_id)
    ) or 0

    reviewer_name: str | None = None
    if rec and rec.reviewer_id:
        rev_user = db.scalar(select(User).where(User.id == rec.reviewer_id))
        reviewer_name = rev_user.name if rev_user else None

    review_info: AuditDetailReview | None = None
    if rec and rec.status:
        review_info = AuditDetailReview(
            status=rec.status,
            comment=rec.comment,
            reviewer_name=reviewer_name,
            reviewed_at=_fmt_dt(rec.reviewed_at),
        )

    recent_test_status = ext.get("recent_test_status", "none")

    return success_response(request, AuditDetailData(
        capability=AuditDetailCapability(
            id=str(capability.id),
            name=capability.name,
            code=capability.code,
            type="Skill" if capability.type == "skill" else "MCP",
            version=capability.version,
            category_id=capability.category_id,
            category=capability.category,
            tags=ext.get("tags", []),
            description=capability.description,
            recent_test_status=recent_test_status,
            connect_type=config.get("transport") if capability.type == "mcp" else None,
            icon=f"/api/developer/capabilities/{capability.id}/icon" if capability.icon else None,
        ),
        developer=AuditDetailDeveloper(
            name=owner.name if owner else None,
            department=dept_name,
            submitted_at=submitted_at_str,
        ),
        version_info=AuditDetailVersion(
            changelog=version_row.changelog if version_row else None,
            is_first_publish=all_versions_count <= 1,
        ),
        review=review_info,
    ))


@router.post("/capabilities/{capability_id}/review", response_model=ApiResponse[AuditResultData])
def review_capability(
    capability_id: int,
    payload: AuditReviewPayload,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.audit"))],
) -> ApiResponse[AuditResultData]:
    capability = db.scalar(
        select(Capability).where(Capability.id == capability_id, Capability.deleted_at.is_(None))
    )
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)
    if capability.status != "reviewing":
        raise AppException(code=4095, message="Only reviewing capabilities can be audited", status_code=409)

    ext = capability.extension_json or {}
    now = _utc_now()

    submitted_at: datetime | None = None
    try:
        sa_str = ext.get("submitted_at")
        if sa_str:
            submitted_at = datetime.fromisoformat(sa_str)
    except Exception:
        pass

    submitted_by: int | None = ext.get("submitted_by")

    new_status = "approved" if payload.action == "approved" else "rejected"
    capability.status = new_status
    capability.updated_by = actor.id

    existing = db.scalar(select(CapabilityAuditRecord).where(CapabilityAuditRecord.capability_id == capability_id))
    if existing:
        existing.reviewer_id = actor.id
        existing.reviewed_at = now
        existing.status = payload.action
        existing.comment = payload.comment
        if submitted_at:
            existing.submitted_at = submitted_at
        if submitted_by:
            existing.submitted_by = submitted_by
    else:
        db.add(CapabilityAuditRecord(
            capability_id=capability_id,
            submitted_by=submitted_by,
            submitted_at=submitted_at,
            reviewer_id=actor.id,
            reviewed_at=now,
            status=payload.action,
            comment=payload.comment,
        ))

    db.commit()

    return success_response(request, AuditResultData(
        success=True,
        capability_id=str(capability_id),
        new_status=new_status,
    ))
