"""add capability user usage
Revision ID: 20260628_0010
Revises: 20260628_0009
"""
import sqlalchemy as sa
from alembic import op
revision = "20260628_0010"
down_revision = "20260628_0009"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("capability_user_usage",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False), sa.Column("capability_id", sa.BigInteger(), nullable=False),
        sa.Column("use_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_used_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "capability_id", name="uq_capability_user_usage_user_capability"))
    op.create_index("ix_capability_user_usage_user_id", "capability_user_usage", ["user_id"])
    op.create_index("ix_capability_user_usage_capability_id", "capability_user_usage", ["capability_id"])
    op.create_index("ix_capability_user_usage_last_used_at", "capability_user_usage", ["last_used_at"])

def downgrade() -> None:
    op.drop_index("ix_capability_user_usage_last_used_at", table_name="capability_user_usage")
    op.drop_index("ix_capability_user_usage_capability_id", table_name="capability_user_usage")
    op.drop_index("ix_capability_user_usage_user_id", table_name="capability_user_usage")
    op.drop_table("capability_user_usage")
