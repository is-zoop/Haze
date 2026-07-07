"""create capability asset and version tables

Revision ID: 20260623_0002
Revises: 20260623_0001
Create Date: 2026-06-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260623_0002"
down_revision: str | Sequence[str] | None = "20260623_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "capabilities",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="能力ID"),
        sa.Column("code", sa.String(length=100), nullable=False, comment="能力编码"),
        sa.Column("name", sa.String(length=200), nullable=False, comment="能力名称"),
        sa.Column("type", sa.String(length=50), nullable=False, comment="能力类型：skill/mcp"),
        sa.Column("description", sa.String(length=1000), nullable=True, comment="能力描述"),
        sa.Column("category", sa.String(length=100), nullable=True, comment="能力分类"),
        sa.Column("icon", sa.String(length=255), nullable=True, comment="图标路径"),
        sa.Column("version", sa.String(length=50), server_default="1.0.0", nullable=False, comment="当前版本"),
        sa.Column(
            "status",
            sa.String(length=50),
            server_default="draft",
            nullable=False,
            comment="状态：draft/published/offline",
        ),
        sa.Column(
            "visibility",
            sa.String(length=50),
            server_default="internal",
            nullable=False,
            comment="可见范围：internal",
        ),
        sa.Column("owner_id", sa.Integer(), nullable=True, comment="负责人用户ID"),
        sa.Column("department_id", sa.Integer(), nullable=True, comment="所属部门ID"),
        sa.Column("extension_json", sa.JSON(), nullable=True, comment="扩展信息，Skill/MCP差异字段统一存这里"),
        sa.Column("created_by", sa.Integer(), nullable=True, comment="创建人"),
        sa.Column("updated_by", sa.Integer(), nullable=True, comment="更新人"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            nullable=False,
            comment="更新时间",
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True, comment="软删除时间"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uk_capabilities_code"),
        comment="能力资产主表，Skill / MCP 共用",
    )
    op.create_index("ix_capabilities_created_by", "capabilities", ["created_by"])
    op.create_index("ix_capabilities_department_id", "capabilities", ["department_id"])
    op.create_index("ix_capabilities_owner_id", "capabilities", ["owner_id"])
    op.create_index("ix_capabilities_updated_by", "capabilities", ["updated_by"])

    op.create_table(
        "capability_versions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="能力版本ID"),
        sa.Column("capability_id", sa.BigInteger(), nullable=False, comment="能力ID"),
        sa.Column("version", sa.String(length=50), nullable=False, comment="版本号"),
        sa.Column("snapshot_json", sa.JSON(), nullable=False, comment="能力配置快照"),
        sa.Column("changelog", sa.Text(), nullable=True, comment="版本说明"),
        sa.Column("created_by", sa.Integer(), nullable=True, comment="创建人"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
            comment="创建时间",
        ),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "capability_id",
            "version",
            name="uk_capability_versions_capability_version",
        ),
        comment="能力版本表",
    )
    op.create_index("ix_capability_versions_capability_id", "capability_versions", ["capability_id"])
    op.create_index("ix_capability_versions_created_by", "capability_versions", ["created_by"])


def downgrade() -> None:
    op.drop_table("capability_versions")
    op.drop_table("capabilities")