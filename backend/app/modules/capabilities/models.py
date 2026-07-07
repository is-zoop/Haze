from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

BIGINT_PK = BigInteger().with_variant(Integer, "sqlite")


class Capability(Base):
    __tablename__ = "capabilities"
    __table_args__ = (
        UniqueConstraint("code", name="uk_capabilities_code"),
        {"comment": "能力资产主表，Skill / MCP 共用"},
    )

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True, comment="能力ID")
    code: Mapped[str] = mapped_column(String(100), nullable=False, comment="能力编码")
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="能力名称")
    type: Mapped[str] = mapped_column(String(50), nullable=False, comment="能力类型：skill/mcp")
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment="能力描述")
    category_id: Mapped[int | None] = mapped_column(BIGINT_PK, ForeignKey("business_categories.id", ondelete="RESTRICT"), nullable=True, index=True, comment="业务分类ID")
    business_category = relationship("BusinessCategory")
    icon: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="图标路径")
    version: Mapped[str] = mapped_column(
        String(50), nullable=False, default="1.0.0", server_default="1.0.0", comment="当前版本"
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="draft", server_default="draft", comment="状态：draft/reviewing/published/offline"
    )
    visibility: Mapped[str] = mapped_column(
        String(50), nullable=False, default="internal", server_default="internal", comment="可见范围：internal"
    )
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True, comment="负责人用户ID"
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="所属部门ID",
    )
    extension_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, comment="扩展信息，Skill/MCP差异字段统一存这里"
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True, comment="创建人"
    )
    updated_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True, comment="更新人"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="软删除时间")

    @property
    def category(self) -> str | None:
        return self.business_category.name if self.business_category else None

    versions: Mapped[list[CapabilityVersion]] = relationship(
        back_populates="capability", cascade="all, delete-orphan", passive_deletes=True
    )


class CapabilityVersion(Base):
    __tablename__ = "capability_versions"
    __table_args__ = (
        UniqueConstraint("capability_id", "version", name="uk_capability_versions_capability_version"),
        {"comment": "能力版本表"},
    )

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True, comment="能力版本ID")
    capability_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("capabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="能力ID",
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False, comment="版本号")
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, comment="能力配置快照")
    changelog: Mapped[str | None] = mapped_column(Text, nullable=True, comment="版本说明")
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True, comment="创建人"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="创建时间"
    )

    capability: Mapped[Capability] = relationship(back_populates="versions")