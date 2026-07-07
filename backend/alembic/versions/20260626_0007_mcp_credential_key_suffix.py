"""add key_suffix to user_mcp_credentials

Revision ID: 20260626_0007
Revises: 20260626_0006
Create Date: 2026-06-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260626_0007"
down_revision = "20260626_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_mcp_credentials",
        sa.Column("key_suffix", sa.String(length=8), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("user_mcp_credentials", "key_suffix")
