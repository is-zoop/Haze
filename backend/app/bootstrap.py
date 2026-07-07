from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rbac import (
    PERMISSION_DEFINITIONS,
    ROLE_DEFINITIONS,
    ROLE_PERMISSION_CODES,
    SYSTEM_ADMIN,
)
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.modules.business_categories.models import BusinessCategory, DEFAULT_CATEGORY_NAMES
from app.modules.roles.models import Permission, Role
from app.modules.users.models import Department, User


def _required_admin_settings() -> tuple[str, str, str, str, str]:
    settings = get_settings()
    values = {
        "INITIAL_ADMIN_NAME": settings.initial_admin_name,
        "INITIAL_ADMIN_PHONE": settings.initial_admin_phone,
        "INITIAL_ADMIN_EMAIL": settings.initial_admin_email,
        "INITIAL_ADMIN_PASSWORD": (
            settings.initial_admin_password.get_secret_value()
            if hasattr(settings.initial_admin_password, "get_secret_value")
            else settings.initial_admin_password
        ),
        "INITIAL_ADMIN_DEPARTMENT": settings.initial_admin_department,
    }
    missing = [key for key, value in values.items() if not value]
    if missing:
        raise RuntimeError("Missing bootstrap settings: " + ", ".join(missing))
    return (
        values["INITIAL_ADMIN_NAME"],
        values["INITIAL_ADMIN_PHONE"],
        values["INITIAL_ADMIN_EMAIL"],
        values["INITIAL_ADMIN_PASSWORD"],
        values["INITIAL_ADMIN_DEPARTMENT"],
    )


def bootstrap(session: Session) -> None:
    name, phone, email, password, department_name = _required_admin_settings()

    permissions: dict[str, Permission] = {}
    for code, (permission_name, description) in PERMISSION_DEFINITIONS.items():
        permission = session.scalar(select(Permission).where(Permission.code == code))
        if permission is None:
            permission = Permission(code=code, name=permission_name, description=description)
            session.add(permission)
        else:
            permission.name = permission_name
            permission.description = description
        permissions[code] = permission

    roles: dict[str, Role] = {}
    for code, (role_name, description) in ROLE_DEFINITIONS.items():
        role = session.scalar(select(Role).where(Role.code == code))
        if role is None:
            role = Role(code=code, name=role_name, description=description, is_system=True)
            session.add(role)
        else:
            role.name = role_name
            role.description = description
            role.is_system = True
        roles[code] = role

    session.flush()
    roles[SYSTEM_ADMIN].permissions = list(session.scalars(select(Permission)).all())
    for role_code, permission_codes in ROLE_PERMISSION_CODES.items():
        roles[role_code].permissions = [permissions[code] for code in permission_codes]

    department = session.scalar(select(Department).where(Department.name == department_name))
    if department is None:
        department = Department(name=department_name)
        session.add(department)
        session.flush()

    admin = session.scalar(select(User).where(User.phone == phone, User.deleted == 0))
    if admin is None:
        admin = User(
            member_no="ADMIN0001",
            name=name,
            phone=phone,
            email=email,
            password_hash=hash_password(password),
            department_id=department.id,
            status="active",
            deleted=0,
        )
        session.add(admin)
    else:
        admin.name = name
        admin.email = email
        admin.department_id = department.id
        admin.status = "active"
    admin.roles = [roles[SYSTEM_ADMIN]]
    session.flush()
    for category_name in DEFAULT_CATEGORY_NAMES:
        normalized = category_name.casefold()
        if session.scalar(select(BusinessCategory.id).where(BusinessCategory.name_normalized == normalized)) is None:
            session.add(BusinessCategory(name=category_name, name_normalized=normalized, created_by=admin.id, updated_by=admin.id))
    session.commit()


def main() -> None:
    with SessionLocal() as session:
        bootstrap(session)
    print("Haze authentication bootstrap completed.")


if __name__ == "__main__":
    main()
