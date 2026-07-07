from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.auth.schemas import PHONE_PATTERN


class MemberBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str = Field(pattern=PHONE_PATTERN)
    department: str = Field(min_length=1, max_length=100)


class MemberCreate(MemberBase):
    member_no: str = Field(min_length=1, max_length=30)
    initial_password: str | None = Field(default=None, min_length=6, max_length=128)
    role_code: str
    status: str = Field(default="active", pattern=r"^(active|disabled)$")


class MemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    department: str | None = Field(default=None, min_length=1, max_length=100)


class RoleChange(BaseModel):
    role_code: str


class StatusChange(BaseModel):
    status: str = Field(pattern=r"^(active|disabled)$")


class MemberData(MemberBase):
    model_config = ConfigDict(from_attributes=True)

    member_no: str
    role_code: str
    role_name: str
    status: str
    last_login_at: datetime | None = None
    created_at: datetime


class MemberListData(BaseModel):
    items: list[MemberData]
    page: int
    page_size: int
    total: int
    counts: dict[str, int]


class MemberCreatedData(BaseModel):
    member: MemberData
    temporary_password: str


class TemporaryPasswordData(BaseModel):
    temporary_password: str


class RoleOption(BaseModel):
    code: str
    name: str


class DepartmentOption(BaseModel):
    id: int
    name: str
