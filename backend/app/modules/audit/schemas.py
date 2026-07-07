from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AuditCapabilityItem(StrictModel):
    id: str
    name: str
    code: str
    type: str
    status: str
    version: str
    category_id: int | None
    category: str | None
    tags: list[str]
    author: str
    department: str | None
    submitted_at: str | None
    reviewed_at: str | None
    reviewer_name: str | None
    comment: str | None
    icon: str | None


class AuditListData(StrictModel):
    items: list[AuditCapabilityItem]
    page: int
    page_size: int
    total: int


class AuditStatsData(StrictModel):
    pending: int
    today_reviewed: int
    week_pass_rate: float | None
    avg_review_hours: float | None


class AuditDetailCapability(StrictModel):
    id: str
    name: str
    code: str
    type: str
    version: str
    category_id: int | None
    category: str | None
    tags: list[str]
    description: str | None
    recent_test_status: str
    connect_type: str | None
    icon: str | None


class AuditDetailDeveloper(StrictModel):
    name: str | None
    department: str | None
    submitted_at: str | None


class AuditDetailVersion(StrictModel):
    changelog: str | None
    is_first_publish: bool


class AuditDetailReview(StrictModel):
    status: str
    comment: str | None
    reviewer_name: str | None
    reviewed_at: str | None


class AuditDetailData(StrictModel):
    capability: AuditDetailCapability
    developer: AuditDetailDeveloper
    version_info: AuditDetailVersion
    review: AuditDetailReview | None


class AuditReviewPayload(StrictModel):
    action: Literal["approved", "rejected"]
    comment: str | None = None


class AuditResultData(StrictModel):
    success: bool
    capability_id: str
    new_status: str
