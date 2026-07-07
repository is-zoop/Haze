"""add capability download logs

Revision ID: 20260702_0014
Revises: 20260630_0013
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260702_0014"
down_revision = "20260630_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "capability_download_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("capability_id", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("download_token_id", sa.Integer(), nullable=True),
        sa.Column("downloaded_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["download_token_id"], ["capability_download_tokens.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_capability_download_logs_capability_id", "capability_download_logs", ["capability_id"])
    op.create_index("ix_capability_download_logs_user_id", "capability_download_logs", ["user_id"])
    op.create_index("ix_capability_download_logs_download_token_id", "capability_download_logs", ["download_token_id"])
    op.create_index("ix_capability_download_logs_downloaded_at", "capability_download_logs", ["downloaded_at"])


def downgrade() -> None:
    op.drop_index("ix_capability_download_logs_downloaded_at", table_name="capability_download_logs")
    op.drop_index("ix_capability_download_logs_download_token_id", table_name="capability_download_logs")
    op.drop_index("ix_capability_download_logs_user_id", table_name="capability_download_logs")
    op.drop_index("ix_capability_download_logs_capability_id", table_name="capability_download_logs")
    op.drop_table("capability_download_logs")
