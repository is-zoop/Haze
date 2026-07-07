from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CategoryData(BaseModel):
    id: int
    name: str
    description: str | None
    created_by: str | None
    created_at: datetime
    updated_by: str | None
    updated_at: datetime
