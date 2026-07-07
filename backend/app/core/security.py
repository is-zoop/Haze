from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import datetime, timedelta, timezone
import hashlib
from typing import Annotated, Any

import jwt
from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.db.session import get_db
from app.modules.users.models import User, UserMcpCredential

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
personal_credential_scheme = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    sub: str
    roles: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    ver: int = 0
    exp: datetime
    token_use: str | None = None
    scopes: list[str] = Field(default_factory=list)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    *,
    roles: Sequence[str] = (),
    capabilities: Sequence[str] = (),
    token_version: int = 0,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    claims: dict[str, Any] = {
        "sub": subject,
        "roles": list(roles),
        "capabilities": list(capabilities),
        "ver": token_version,
        "exp": expires_at,
    }
    if extra_claims:
        claims.update(extra_claims)
    return jwt.encode(
        claims,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> TokenPayload:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
        return TokenPayload.model_validate(payload)
    except (InvalidTokenError, ValueError) as exc:
        raise AppException(
            code=4010,
            message="invalid or expired token",
            status_code=status.HTTP_401_UNAUTHORIZED,
        ) from exc


def get_current_token_payload(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> TokenPayload:
    return decode_access_token(token)


def get_current_user(
    payload: Annotated[TokenPayload, Depends(get_current_token_payload)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if payload.token_use == "mcp_exchange":
        raise AppException(
            code=4010,
            message="invalid or expired token",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return _get_active_user(payload, db)


def _get_active_user(payload: TokenPayload, db: Session) -> User:
    user = db.scalar(select(User).where(User.member_no == payload.sub, User.deleted == 0))
    if user is None or user.status != "active" or user.token_version != payload.ver:
        raise AppException(
            code=4010,
            message="invalid or expired token",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return user



def require_marketplace_access(
    payload: Annotated[TokenPayload, Depends(get_current_token_payload)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = _get_active_user(payload, db)
    if payload.token_use == "mcp_exchange" and "marketplace.read" not in payload.scopes:
        raise AppException(code=4030, message="insufficient token scope", status_code=status.HTTP_403_FORBIDDEN)
    if "page.marketplace" not in get_user_permission_codes(user):
        raise AppException(code=4030, message="insufficient capabilities", status_code=status.HTTP_403_FORBIDDEN)
    return user

def get_personal_credential_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(personal_credential_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppException(code=4013, message="personal service credential required", status_code=status.HTTP_401_UNAUTHORIZED)
    key_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    credential = db.scalar(select(UserMcpCredential).where(UserMcpCredential.key_hash == key_hash))
    user = db.get(User, credential.user_id) if credential else None
    if user is None or user.deleted != 0 or user.status != "active":
        raise AppException(code=4013, message="invalid or expired personal service credential", status_code=status.HTTP_401_UNAUTHORIZED)
    return user


def get_user_permission_codes(user: User) -> set[str]:
    return {
        permission.code
        for role in user.roles
        for permission in role.permissions
    }


def require_capabilities(
    *required_capabilities: str,
) -> Callable[[User], User]:
    def capability_dependency(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        missing = set(required_capabilities) - get_user_permission_codes(user)
        if missing:
            raise AppException(
                code=4030,
                message="insufficient capabilities",
                status_code=status.HTTP_403_FORBIDDEN,
                data={"missing_capabilities": sorted(missing)},
            )
        return user

    return capability_dependency
