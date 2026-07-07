"""add capability download tokens

Revision ID: 20260628_0009
Revises: 20260626_0008
Create Date: 2026-06-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260628_0009"
down_revision = "20260626_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "capability_download_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("capability_id", sa.BigInteger(), nullable=False),
        sa.Column("package_path", sa.String(length=1000), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_capability_download_tokens_token_hash"),
    )
    op.create_index("ix_capability_download_tokens_token_hash", "capability_download_tokens", ["token_hash"])
    op.create_index("ix_capability_download_tokens_capability_id", "capability_download_tokens", ["capability_id"])
    op.create_index("ix_capability_download_tokens_created_by", "capability_download_tokens", ["created_by"])
    op.create_index("ix_capability_download_tokens_expires_at", "capability_download_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_capability_download_tokens_expires_at", table_name="capability_download_tokens")
    op.drop_index("ix_capability_download_tokens_created_by", table_name="capability_download_tokens")
    op.drop_index("ix_capability_download_tokens_capability_id", table_name="capability_download_tokens")
    op.drop_index("ix_capability_download_tokens_token_hash", table_name="capability_download_tokens")
    op.drop_table("capability_download_tokens")
