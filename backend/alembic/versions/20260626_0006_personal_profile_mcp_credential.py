"""personal profile and mcp credential

Revision ID: 20260626_0006
Revises: 20260625_0005
Create Date: 2026-06-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260626_0006"
down_revision = "20260625_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))
    op.create_table(
        "user_mcp_credentials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("key_prefix", sa.String(length=32), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_mcp_credentials_user"),
    )
    op.create_index("ix_user_mcp_credentials_key_prefix", "user_mcp_credentials", ["key_prefix"])
    op.create_index("ix_user_mcp_credentials_user_id", "user_mcp_credentials", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_mcp_credentials_user_id", table_name="user_mcp_credentials")
    op.drop_index("ix_user_mcp_credentials_key_prefix", table_name="user_mcp_credentials")
    op.drop_table("user_mcp_credentials")
    op.drop_column("users", "avatar_url")
