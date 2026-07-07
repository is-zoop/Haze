from __future__ import annotations

import secrets
import string
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.rbac import ADMIN, DEVELOPER, SYSTEM_ADMIN, USER
from app.core.response import ApiResponse, success_response
from app.core.security import get_current_user, hash_password, require_capabilities
from app.db.session import get_db
from app.modules.roles.models import Role
from app.modules.users.models import Department, User
from app.modules.users.schemas import (
    DepartmentOption,
    MemberCreate,
    MemberCreatedData,
    MemberData,
    MemberListData,
    MemberUpdate,
    RoleChange,
    RoleOption,
    StatusChange,
    TemporaryPasswordData,
)

router = APIRouter(prefix="/api", tags=["members"])
MANAGEABLE_ROLE_CODES = {ADMIN, DEVELOPER, USER}


def _role_code(user: User) -> str:
    return user.roles[0].code


def _serialize_member(user: User) -> MemberData:
    role = user.roles[0]
    return MemberData(
        member_no=user.member_no,
        name=user.name,
        email=user.email,
        phone=user.phone,
        department=user.department.name,
        role_code=role.code,
        role_name=role.name,
        status=user.status,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def _get_target(db: Session, member_no: str, actor: User) -> User:
    target = db.scalar(select(User).where(User.member_no == member_no, User.deleted == 0))
    if target is None or (_role_code(actor) == ADMIN and _role_code(target) == SYSTEM_ADMIN):
        raise AppException(code=4041, message="Member not found", status_code=404)
    return target


def _ensure_mutable(target: User) -> None:
    if _role_code(target) == SYSTEM_ADMIN:
        raise AppException(code=4032, message="System administrator cannot be modified", status_code=403)


def _get_role(db: Session, role_code: str) -> Role:
    if role_code not in MANAGEABLE_ROLE_CODES:
        raise AppException(code=4002, message="Role cannot be assigned", status_code=400)
    role = db.scalar(select(Role).where(Role.code == role_code))
    if role is None:
        raise AppException(code=4003, message="Role not found", status_code=400)
    return role


def _get_or_create_department(db: Session, name: str) -> Department:
    department = db.scalar(select(Department).where(Department.name == name.strip()))
    if department is None:
        department = Department(name=name.strip())
        db.add(department)
        db.flush()
    return department


def _ensure_unique(db: Session, *, phone: str | None = None, email: str | None = None, exclude_id: int | None = None) -> None:
    conditions = []
    if phone:
        conditions.append(User.phone == phone)
    if email:
        conditions.append(User.email == email)
    if not conditions:
        return
    stmt = select(User).where(User.deleted == 0, or_(*conditions))
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    duplicate = db.scalar(stmt)
    if duplicate:
        message = "Phone number already exists" if phone and duplicate.phone == phone else "Email already exists"
        raise AppException(code=4091, message=message, status_code=409)


def _ensure_member_no_available(db: Session, member_no: str) -> None:
    duplicate_id = db.scalar(select(User.id).where(func.lower(User.member_no) == member_no.lower()))
    if duplicate_id is not None:
        raise AppException(code=4091, message="Member number already exists", status_code=409)


def _temporary_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(14))


@router.get("/users", response_model=ApiResponse[MemberListData])
def list_users(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("members.read"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str = "",
    role_code: str | None = None,
    status: str | None = Query(default=None, pattern=r"^(active|disabled)$"),
) -> ApiResponse[MemberListData]:
    filters = [User.deleted == 0]
    if _role_code(actor) == ADMIN:
        filters.append(~User.roles.any(Role.code == SYSTEM_ADMIN))
    if search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(User.member_no.like(term), User.name.like(term), User.email.like(term), User.phone.like(term)))
    if role_code:
        filters.append(User.roles.any(Role.code == role_code))
    if status:
        filters.append(User.status == status)

    total = db.scalar(select(func.count(User.id)).where(*filters)) or 0
    users = db.scalars(
        select(User).where(*filters).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    base_filters = [User.deleted == 0]
    if _role_code(actor) == ADMIN:
        base_filters.append(~User.roles.any(Role.code == SYSTEM_ADMIN))
    all_count = db.scalar(select(func.count(User.id)).where(*base_filters)) or 0
    active_count = db.scalar(select(func.count(User.id)).where(*base_filters, User.status == "active")) or 0
    disabled_count = db.scalar(select(func.count(User.id)).where(*base_filters, User.status == "disabled")) or 0
    return success_response(request, MemberListData(
        items=[_serialize_member(user) for user in users],
        page=page,
        page_size=page_size,
        total=total,
        counts={"all": all_count, "active": active_count, "disabled": disabled_count},
    ))


@router.post("/users", response_model=ApiResponse[MemberCreatedData])
def create_user(payload: MemberCreate, request: Request, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_capabilities("members.create"))]) -> ApiResponse[MemberCreatedData]:
    member_no = payload.member_no.strip()
    if not member_no:
        raise AppException(code=4221, message="Member number is required", status_code=422)
    _ensure_unique(db, phone=payload.phone, email=str(payload.email) if payload.email else None)
    _ensure_member_no_available(db, member_no)
    role = _get_role(db, payload.role_code)
    department = _get_or_create_department(db, payload.department)
    temporary_password = payload.initial_password or _temporary_password()
    user = User(
        member_no=member_no,
        name=payload.name.strip(),
        email=str(payload.email).lower() if payload.email else None,
        phone=payload.phone,
        password_hash=hash_password(temporary_password),
        department_id=department.id,
        status=payload.status,
        deleted=0,
        roles=[role],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return success_response(request, MemberCreatedData(member=_serialize_member(user), temporary_password=temporary_password))


@router.get("/users/{member_no}", response_model=ApiResponse[MemberData])
def get_user(member_no: str, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("members.read"))]) -> ApiResponse[MemberData]:
    return success_response(request, _serialize_member(_get_target(db, member_no, actor)))


@router.patch("/users/{member_no}", response_model=ApiResponse[MemberData])
def update_user(member_no: str, payload: MemberUpdate, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("members.update"))]) -> ApiResponse[MemberData]:
    target = _get_target(db, member_no, actor)
    _ensure_mutable(target)
    values = payload.model_dump(exclude_unset=True)
    _ensure_unique(db, phone=values.get("phone"), email=str(values["email"]) if values.get("email") else None, exclude_id=target.id)
    if "department" in values:
        target.department = _get_or_create_department(db, values.pop("department"))
    for key, value in values.items():
        setattr(target, key, str(value).lower() if key == "email" and value else value.strip() if isinstance(value, str) else value)
    db.commit()
    return success_response(request, _serialize_member(target))


@router.put("/users/{member_no}/role", response_model=ApiResponse[MemberData])
def change_role(member_no: str, payload: RoleChange, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("members.role"))]) -> ApiResponse[MemberData]:
    target = _get_target(db, member_no, actor)
    _ensure_mutable(target)
    target.roles = [_get_role(db, payload.role_code)]
    target.token_version += 1
    db.commit()
    return success_response(request, _serialize_member(target))


@router.post("/users/{member_no}/reset-password", response_model=ApiResponse[TemporaryPasswordData])
def reset_password(member_no: str, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("members.reset_password"))]) -> ApiResponse[TemporaryPasswordData]:
    target = _get_target(db, member_no, actor)
    _ensure_mutable(target)
    temporary_password = _temporary_password()
    target.password_hash = hash_password(temporary_password)
    target.token_version += 1
    db.commit()
    return success_response(request, TemporaryPasswordData(temporary_password=temporary_password))


@router.patch("/users/{member_no}/status", response_model=ApiResponse[MemberData])
def change_status(member_no: str, payload: StatusChange, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("members.status"))]) -> ApiResponse[MemberData]:
    target = _get_target(db, member_no, actor)
    _ensure_mutable(target)
    target.status = payload.status
    target.token_version += 1
    db.commit()
    return success_response(request, _serialize_member(target))


@router.delete("/users/{member_no}", response_model=ApiResponse[dict[str, bool]])
def delete_user(member_no: str, request: Request, db: Annotated[Session, Depends(get_db)], actor: Annotated[User, Depends(require_capabilities("members.delete"))]) -> ApiResponse[dict[str, bool]]:
    target = _get_target(db, member_no, actor)
    _ensure_mutable(target)
    target.deleted = int(time.time())
    target.token_version += 1
    db.commit()
    return success_response(request, {"deleted": True})


@router.get("/roles", response_model=ApiResponse[list[RoleOption]])
def list_roles(request: Request, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_capabilities("members.read"))]) -> ApiResponse[list[RoleOption]]:
    roles = db.scalars(select(Role).where(Role.code.in_(MANAGEABLE_ROLE_CODES)).order_by(Role.id)).all()
    return success_response(request, [RoleOption(code=role.code, name=role.name) for role in roles])


@router.get("/departments", response_model=ApiResponse[list[DepartmentOption]])
def list_departments(request: Request, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_capabilities("members.read"))]) -> ApiResponse[list[DepartmentOption]]:
    departments = db.scalars(select(Department).order_by(Department.name)).all()
    return success_response(request, [DepartmentOption(id=item.id, name=item.name) for item in departments])
