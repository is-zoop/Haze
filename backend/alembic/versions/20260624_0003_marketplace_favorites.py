"""create capability_favorites table

Revision ID: 20260624_0003
Revises: 20260623_0002
Create Date: 2026-06-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260624_0003"
down_revision: str | Sequence[str] | None = "20260623_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "capability_favorites",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="收藏ID"),
        sa.Column("user_id", sa.Integer(), nullable=False, comment="收藏人用户ID"),
        sa.Column("capability_id", sa.BigInteger(), nullable=False, comment="被收藏能力ID"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="收藏时间"),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "capability_id", name="uq_capability_favorites_user_capability"),
        comment="用户收藏能力表",
    )
    op.create_index("ix_capability_favorites_user_id", "capability_favorites", ["user_id"])
    op.create_index("ix_capability_favorites_capability_id", "capability_favorites", ["capability_id"])


def downgrade() -> None:
    op.drop_index("ix_capability_favorites_capability_id", table_name="capability_favorites")
    op.drop_index("ix_capability_favorites_user_id", table_name="capability_favorites")
    op.drop_table("capability_favorites")
