from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

CapabilityType = Literal["skill", "mcp"]
CapabilityStatus = Literal[
    "draft",
    "reviewing",
    "approved",
    "rejected",
    "deployed",
    "deploy_failed",
    "debug_passed",
    "debug_failed",
    "published",
    "offline",
]
TestStatus = Literal["none", "testing", "pass", "fail"]
VERSION_PATTERN = r"^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$"
CODE_PATTERN = r"^[a-z0-9_-]{3,100}$"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CapabilityCreate(StrictModel):
    code: str = Field(pattern=CODE_PATTERN)
    name: str = Field(min_length=1, max_length=200)
    type: CapabilityType
    description: str | None = Field(default=None, max_length=1000)
    category_id: int | None = None
    version: str = Field(default="1.0.0", pattern=VERSION_PATTERN)
    visibility: Literal["internal"] = "internal"
    tags: list[str] = Field(default_factory=list, max_length=30)
    config: dict[str, Any] = Field(default_factory=dict)
    icon_upload_token: str | None = None
    package_upload_token: str
    documentation_upload_token: str | None = None


class CapabilityUpdate(StrictModel):
    code: str | None = Field(default=None, pattern=CODE_PATTERN)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    category_id: int | None = None
    visibility: Literal["internal"] | None = None
    tags: list[str] | None = Field(default=None, max_length=30)
    config: dict[str, Any] | None = None
    icon_upload_token: str | None = None
    package_upload_token: str | None = None
    documentation_upload_token: str | None = None


class CapabilityVersionCreate(StrictModel):
    version: str = Field(pattern=VERSION_PATTERN)
    changelog: str = Field(min_length=1, max_length=5000)
    package_upload_token: str | None = None


class TestStatusUpdate(StrictModel):
    status: TestStatus


class UploadFileItem(StrictModel):
    name: str
    size: int


class UploadData(StrictModel):
    upload_token: str
    kind: Literal["icon", "package", "documentation"]
    file_name: str
    size: int
    expires_at: datetime
    files: list[UploadFileItem] = Field(default_factory=list)
    manifest: dict[str, Any] | None = None


class CapabilityData(StrictModel):
    id: int
    code: str
    name: str
    type: CapabilityType
    description: str | None
    category_id: int | None
    category: str | None
    icon: str | None
    version: str
    status: CapabilityStatus
    visibility: str
    owner_id: int | None
    owner: str | None
    creator: str | None
    department_id: int | None
    department: str | None
    tags: list[str]
    config: dict[str, Any]
    calls: int
    recent_test_status: TestStatus
    package: dict[str, Any] | None
    documentation: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class CapabilityListData(StrictModel):
    items: list[CapabilityData]
    page: int
    page_size: int
    total: int
    counts: dict[str, int]


class CapabilityVersionData(StrictModel):
    id: int
    capability_id: int
    version: str
    snapshot: dict[str, Any]
    changelog: str | None
    created_by: int | None
    created_at: datetime


class CapabilityVersionListData(StrictModel):
    items: list[CapabilityVersionData]
    total: int


class DeleteResult(StrictModel):
    deleted: bool
