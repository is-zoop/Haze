from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    users: Mapped[list[User]] = relationship(back_populates="department")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("phone", "deleted", name="uq_users_phone_deleted"),
        UniqueConstraint("email", "deleted", name="uq_users_email_deleted"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    member_no: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    token_version: Mapped[int] = mapped_column(default=0)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    department: Mapped[Department] = relationship(back_populates="users")
    roles: Mapped[list["Role"]] = relationship(secondary="user_roles", lazy="selectin")
    mcp_credential: Mapped["UserMcpCredential | None"] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_roles_user"),
        UniqueConstraint("user_id", "role_id", name="uq_user_roles_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)


class UserMcpCredential(Base):
    __tablename__ = "user_mcp_credentials"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_mcp_credentials_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), default="Personal Service Access Credential")
    key_prefix: Mapped[str] = mapped_column(String(32), index=True)
    key_suffix: Mapped[str] = mapped_column(String(8), default="")
    key_hash: Mapped[str] = mapped_column(String(64))
    key_raw: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="mcp_credential")


from app.modules.roles.models import Role  # noqa: E402
