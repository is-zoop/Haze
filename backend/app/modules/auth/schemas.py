from datetime import datetime

from pydantic import BaseModel, Field


PHONE_PATTERN = r"^1\d{10}$"


class LoginRequest(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)
    password: str = Field(min_length=6, max_length=128)


class AuthUser(BaseModel):
    member_no: str
    name: str
    phone: str
    email: str | None = None
    avatar_url: str | None = None
    department: str
    role_code: str
    role_name: str
    status: str
    permissions: list[str]


class PersonalCredentialUser(BaseModel):
    member_no: str
    name: str
    phone: str
    email: str | None = None
    department: str
    role_code: str
    role_name: str
    status: str


class LoginData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser


class ProfileUpdate(BaseModel):
    avatar_url: str | None = Field(default=None, max_length=65_000)


class PasswordResetRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class PasswordResetData(BaseModel):
    reset: bool


class McpCredentialData(BaseModel):
    id: int
    name: str
    key_prefix: str
    masked_key: str
    created_at: datetime
    updated_at: datetime


class McpCredentialSecretData(McpCredentialData):
    key: str
