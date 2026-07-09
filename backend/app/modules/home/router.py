from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.response import ApiResponse, success_response
from app.core.security import get_user_permission_codes, require_capabilities
from app.db.session import get_db
from app.modules.audit.models import CapabilityAuditRecord
from app.modules.capabilities.metrics import capability_call_counts
from app.modules.capabilities.models import Capability
from app.modules.home.models import CapabilityUserUsage
from app.modules.home.schemas import AuditMetric, HomeCapabilityItem, HomeOverviewData, MyCapabilitiesMetric, PublishedMetric, UsageResult, WeeklyAddedMetric
from app.modules.marketplace.models import CapabilityFavorite
from app.modules.users.models import Department, User

router = APIRouter(prefix="/api/home", tags=["home"])

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def _serialize(
    db: Session,
    user_id: int,
    capabilities: list[Capability],
    usage_map: dict[int, CapabilityUserUsage] | None = None,
    call_counts: dict[int, int] | None = None,
) -> list[HomeCapabilityItem]:
    if not capabilities:
        return []
    ids = [c.id for c in capabilities]
    owner_ids = {c.owner_id for c in capabilities if c.owner_id}
    department_ids = {c.department_id for c in capabilities if c.department_id}
    owners = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(owner_ids))).all()} if owner_ids else {}
    departments = {d.id: d.name for d in db.scalars(select(Department).where(Department.id.in_(department_ids))).all()} if department_ids else {}
    favorites = set(db.scalars(select(CapabilityFavorite.capability_id).where(CapabilityFavorite.user_id == user_id, CapabilityFavorite.capability_id.in_(ids))).all())
    usage_map = usage_map or {}
    call_counts = call_counts or capability_call_counts(db, capabilities)
    return [HomeCapabilityItem(
        id=str(c.id), name=c.name, type="Skill" if c.type == "skill" else "MCP",
        description=c.description, author=owners.get(c.owner_id, ""), department=departments.get(c.department_id),
        category_id=c.category_id, category=c.category, calls=call_counts.get(c.id, 0), is_favorite=c.id in favorites,
        icon=f"/api/marketplace/capabilities/{c.id}/icon" if c.icon else None,
        updated_at=c.updated_at.strftime("%Y-%m-%d"),
        use_count=usage_map[c.id].use_count if c.id in usage_map else None,
        last_used_at=usage_map[c.id].last_used_at.isoformat() if c.id in usage_map else None,
    ) for c in capabilities]

@router.get("/overview", response_model=ApiResponse[HomeOverviewData])
def get_overview(request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("page.home"))]) -> ApiResponse[HomeOverviewData]:
    permissions = get_user_permission_codes(actor)
    base = (Capability.status == "published", Capability.deleted_at.is_(None))
    published = list(db.scalars(select(Capability).where(*base)).all())
    now = _now()
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
    previous_start = week_start - timedelta(days=7)
    previous_end = previous_start + (now - week_start)
    current_added = sum(week_start <= c.created_at <= now for c in published)
    previous_added = sum(previous_start <= c.created_at <= previous_end for c in published)
    call_counts = capability_call_counts(db, published)

    can_develop = "page.developer" in permissions
    my_total = my_published = None
    if can_develop:
        mine = (Capability.owner_id == actor.id, Capability.deleted_at.is_(None))
        my_total = db.scalar(select(func.count()).select_from(Capability).where(*mine)) or 0
        my_published = db.scalar(select(func.count()).select_from(Capability).where(*mine, Capability.status == "published")) or 0

    can_audit = "page.audit" in permissions
    pending = None
    avg_hours = None
    if can_audit:
        pending = db.scalar(select(func.count()).select_from(Capability).where(Capability.status == "reviewing", Capability.deleted_at.is_(None))) or 0
        durations = db.execute(select(CapabilityAuditRecord.submitted_at, CapabilityAuditRecord.reviewed_at).where(CapabilityAuditRecord.reviewed_at >= week_start, CapabilityAuditRecord.submitted_at.is_not(None))).all()
        valid = [r.reviewed_at - r.submitted_at for r in durations if r.reviewed_at and r.submitted_at]
        if valid:
            avg_hours = round(sum(d.total_seconds() for d in valid) / len(valid) / 3600, 1)

    max_calls = max(call_counts.values(), default=0)
    max_log = math.log1p(max_calls) if max_calls else 1.0
    def score(c: Capability) -> float:
        call_score = math.log1p(call_counts.get(c.id, 0)) / max_log if max_calls else 0.0
        age = max(0.0, (now - c.created_at).total_seconds() / 86400)
        return call_score * .7 + max(0.0, 1 - age / 30) * .3
    recommended = sorted(published, key=lambda c: (score(c), c.id), reverse=True)[:6]
    latest = sorted(published, key=lambda c: (c.created_at, c.id), reverse=True)[:6]
    popular = sorted(published, key=lambda c: (call_counts.get(c.id, 0), c.id), reverse=True)[:6]

    favorite_ids = list(db.scalars(select(CapabilityFavorite.capability_id).where(CapabilityFavorite.user_id == actor.id).order_by(CapabilityFavorite.created_at.desc()).limit(4)).all())
    favorite_order = {value: index for index, value in enumerate(favorite_ids)}
    favorite_caps = list(db.scalars(select(Capability).where(Capability.id.in_(favorite_ids), *base)).all()) if favorite_ids else []
    favorite_caps.sort(key=lambda c: favorite_order[c.id])

    usages = list(db.scalars(select(CapabilityUserUsage).where(CapabilityUserUsage.user_id == actor.id).order_by(CapabilityUserUsage.use_count.desc(), CapabilityUserUsage.last_used_at.desc()).limit(4)).all())
    usage_map = {u.capability_id: u for u in usages}
    usage_order = {u.capability_id: index for index, u in enumerate(usages)}
    frequent_caps = list(db.scalars(select(Capability).where(Capability.id.in_(usage_map), *base)).all()) if usage_map else []
    frequent_caps.sort(key=lambda c: usage_order[c.id])

    data = HomeOverviewData(
        published=PublishedMetric(total=len(published), skill=sum(c.type == "skill" for c in published), mcp=sum(c.type == "mcp" for c in published)),
        weekly_added=WeeklyAddedMetric(current=current_added, previous=previous_added, difference=current_added - previous_added),
        my_capabilities=MyCapabilitiesMetric(available=can_develop, total=my_total, published=my_published),
        audit=AuditMetric(available=can_audit, pending=pending, avg_review_hours=avg_hours),
        recommended=_serialize(db, actor.id, recommended, call_counts=call_counts),
        latest=_serialize(db, actor.id, latest, call_counts=call_counts),
        popular=_serialize(db, actor.id, popular, call_counts=call_counts),
        favorites=_serialize(db, actor.id, favorite_caps, call_counts=call_counts),
        frequent=_serialize(db, actor.id, frequent_caps, usage_map, call_counts),
    )
    return success_response(request, data)

@router.post("/capabilities/{capability_id}/usage", response_model=ApiResponse[UsageResult])
def record_usage(capability_id: int, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("page.marketplace"))]) -> ApiResponse[UsageResult]:
    capability = db.scalar(select(Capability).where(Capability.id == capability_id, Capability.status == "published", Capability.deleted_at.is_(None)))
    if capability is None:
        raise AppException(code=4045, message="Published capability not found", status_code=404)
    now = _now()
    usage = db.scalar(select(CapabilityUserUsage).where(CapabilityUserUsage.user_id == actor.id, CapabilityUserUsage.capability_id == capability_id).with_for_update())
    if usage is None:
        usage = CapabilityUserUsage(user_id=actor.id, capability_id=capability_id, use_count=1, last_used_at=now)
        db.add(usage)
    else:
        usage.use_count += 1
        usage.last_used_at = now
    db.commit()
    db.refresh(usage)
    return success_response(request, UsageResult(use_count=usage.use_count, last_used_at=usage.last_used_at.isoformat()))
