from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.response import ApiResponse, success_response
from app.core.security import create_access_token, get_current_user, get_personal_credential_user, get_user_permission_codes, hash_password, verify_password
from app.db.session import get_db
from app.modules.auth.schemas import (
    AuthUser,
    LoginData,
    LoginRequest,
    McpCredentialData,
    McpCredentialSecretData,
    PasswordResetData,
    PasswordResetRequest,
    PersonalCredentialUser,
    ProfileUpdate,
)
from app.modules.users.models import User, UserMcpCredential

router = APIRouter(prefix="/api/auth", tags=["auth"])
PERSONAL_KEY_PREFIX = "haze_"


def _hash_mcp_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _generate_mcp_key() -> str:
    return f"{PERSONAL_KEY_PREFIX}{secrets.token_urlsafe(32)}"


def _mask_mcp_key(key_prefix: str, key_suffix: str) -> str:
    return f"{key_prefix}{'*' * 8}{key_suffix}"


def _serialize_mcp_credential(credential: UserMcpCredential) -> McpCredentialSecretData:
    return McpCredentialSecretData(
        id=credential.id,
        name=credential.name,
        key_prefix=credential.key_prefix,
        masked_key=_mask_mcp_key(credential.key_prefix, credential.key_suffix or ""),
        key=credential.key_raw or "",
        created_at=credential.created_at,
        updated_at=credential.updated_at,
    )


def _get_or_create_mcp_credential(db: Session, user: User) -> UserMcpCredential:
    credential = db.scalar(select(UserMcpCredential).where(UserMcpCredential.user_id == user.id))
    if credential is not None:
        changed = False
        if credential.key_prefix.startswith("haze_mcp_"):
            key = _generate_mcp_key()
            credential.key_prefix = key[:18]
            credential.key_suffix = key[-4:]
            credential.key_hash = _hash_mcp_key(key)
            credential.key_raw = key
            changed = True
        if credential.name != "Personal Service Access Credential":
            credential.name = "Personal Service Access Credential"
            changed = True
        if changed:
            db.commit()
            db.refresh(credential)
        return credential
    key = _generate_mcp_key()
    credential = UserMcpCredential(
        user_id=user.id,
        name="Personal Service Access Credential",
        key_prefix=key[:18],
        key_suffix=key[-4:],
        key_hash=_hash_mcp_key(key),
        key_raw=key,
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    return credential


def serialize_auth_user(user: User) -> AuthUser:
    role = user.roles[0]
    return AuthUser(
        member_no=user.member_no,
        name=user.name,
        phone=user.phone,
        email=user.email,
        avatar_url=user.avatar_url,
        department=user.department.name,
        role_code=role.code,
        role_name=role.name,
        status=user.status,
        permissions=sorted(get_user_permission_codes(user)),
    )


def serialize_personal_credential_user(user: User) -> PersonalCredentialUser:
    role = user.roles[0]
    return PersonalCredentialUser(
        member_no=user.member_no,
        name=user.name,
        phone=user.phone,
        email=user.email,
        department=user.department.name,
        role_code=role.code,
        role_name=role.name,
        status=user.status,
    )


@router.post("/login", response_model=ApiResponse[LoginData])
def login(payload: LoginRequest, request: Request, db: Annotated[Session, Depends(get_db)]) -> ApiResponse[LoginData]:
    user = db.scalar(select(User).where(User.phone == payload.phone, User.deleted == 0))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppException(code=4011, message="Invalid phone number or password", status_code=401)
    if user.status != "active":
        raise AppException(code=4031, message="Account is disabled", status_code=403)
    permissions = sorted(get_user_permission_codes(user))
    token = create_access_token(
        user.member_no,
        roles=[role.code for role in user.roles],
        capabilities=permissions,
        token_version=user.token_version,
    )
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    settings = get_settings()
    return success_response(request, LoginData(
        access_token=token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        user=serialize_auth_user(user),
    ))


@router.post("/logout", response_model=ApiResponse[dict[str, bool]])
def logout(request: Request, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> ApiResponse[dict[str, bool]]:
    user.token_version += 1
    db.commit()
    return success_response(request, {"logged_out": True})


@router.get("/me", response_model=ApiResponse[AuthUser])
def me(request: Request, user: Annotated[User, Depends(get_current_user)]) -> ApiResponse[AuthUser]:
    return success_response(request, serialize_auth_user(user))


@router.get("/personal-credential/me", response_model=ApiResponse[PersonalCredentialUser])
def personal_credential_me(request: Request, user: Annotated[User, Depends(get_personal_credential_user)]) -> ApiResponse[PersonalCredentialUser]:
    return success_response(request, serialize_personal_credential_user(user))



@router.post("/mcp-token-exchange", response_model=ApiResponse[dict[str, str | int]])
def exchange_mcp_token(
    request: Request,
    user: Annotated[User, Depends(get_personal_credential_user)],
) -> ApiResponse[dict[str, str | int]]:
    expires_in = 5 * 60
    token = create_access_token(
        user.member_no,
        roles=[role.code for role in user.roles],
        capabilities=sorted(get_user_permission_codes(user)),
        token_version=user.token_version,
        expires_delta=timedelta(seconds=expires_in),
        extra_claims={"token_use": "mcp_exchange", "scopes": ["marketplace.read"]},
    )
    return success_response(request, {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
    })

@router.patch("/me/profile", response_model=ApiResponse[AuthUser])
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiResponse[AuthUser]:
    user.avatar_url = payload.avatar_url.strip() if payload.avatar_url and payload.avatar_url.strip() else None
    db.commit()
    db.refresh(user)
    return success_response(request, serialize_auth_user(user))


@router.post("/me/reset-password", response_model=ApiResponse[PasswordResetData])
def reset_own_password(
    payload: PasswordResetRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiResponse[PasswordResetData]:
    if not verify_password(payload.current_password, user.password_hash):
        raise AppException(code=4012, message="Current password is incorrect", status_code=401)
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    db.commit()
    return success_response(request, PasswordResetData(reset=True))


@router.get("/me/mcp-credential", response_model=ApiResponse[McpCredentialSecretData])
def get_mcp_credential(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiResponse[McpCredentialSecretData]:
    credential = _get_or_create_mcp_credential(db, user)
    return success_response(request, _serialize_mcp_credential(credential))


@router.post("/me/mcp-credential/reset", response_model=ApiResponse[McpCredentialSecretData])
def reset_mcp_credential(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiResponse[McpCredentialSecretData]:
    key = _generate_mcp_key()
    credential = _get_or_create_mcp_credential(db, user)
    credential.key_prefix = key[:18]
    credential.key_suffix = key[-4:]
    credential.key_hash = _hash_mcp_key(key)
    credential.key_raw = key
    db.commit()
    db.refresh(credential)
    return success_response(request, _serialize_mcp_credential(credential))
