from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MarketVersionData(StrictModel):
    version: str
    created_at: str
    changelog: str | list[str] | None


class MarketCapabilityData(StrictModel):
    id: str
    name: str
    type: str
    description: str | None
    version: str
    author: str
    department: str | None
    category_id: int | None
    category: str | None
    connect_type: str | None
    server_url: str | None
    version_history: list[MarketVersionData]
    tags: list[str]
    calls: int
    is_favorite: bool
    icon: str | None
    updated_at: str


class AccessPromptData(StrictModel):
    capability_id: str
    name: str
    type: str
    version: str
    access_mode: str
    prompt: str
    download_url: str | None = None
    server_url: str | None = None
    expires_at: datetime | None = None


class DownloadLinkData(StrictModel):
    download_url: str
    expires_at: datetime


class MarketContentData(StrictModel):
    file_name: str
    base_path: str
    content: str | None


class MarketListData(StrictModel):
    items: list[MarketCapabilityData]
    page: int
    page_size: int
    total: int


class FavoriteResult(StrictModel):
    is_favorite: bool
