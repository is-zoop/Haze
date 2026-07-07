from pydantic import BaseModel, ConfigDict

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class PublishedMetric(StrictModel):
    total: int
    skill: int
    mcp: int

class WeeklyAddedMetric(StrictModel):
    current: int
    previous: int
    difference: int

class MyCapabilitiesMetric(StrictModel):
    available: bool
    total: int | None
    published: int | None

class AuditMetric(StrictModel):
    available: bool
    pending: int | None
    avg_review_hours: float | None

class HomeCapabilityItem(StrictModel):
    id: str
    name: str
    type: str
    description: str | None
    author: str
    department: str | None
    category_id: int | None
    category: str | None
    calls: int
    is_favorite: bool
    icon: str | None
    updated_at: str
    use_count: int | None = None
    last_used_at: str | None = None

class HomeOverviewData(StrictModel):
    published: PublishedMetric
    weekly_added: WeeklyAddedMetric
    my_capabilities: MyCapabilitiesMetric
    audit: AuditMetric
    recommended: list[HomeCapabilityItem]
    latest: list[HomeCapabilityItem]
    popular: list[HomeCapabilityItem]
    favorites: list[HomeCapabilityItem]
    frequent: list[HomeCapabilityItem]

class UsageResult(StrictModel):
    use_count: int
    last_used_at: str
