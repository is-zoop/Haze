"""audit_records

Revision ID: 20260624_0004
Revises: 20260624_0003
Create Date: 2026-06-24
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260624_0004"
down_revision = "20260624_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "capability_audit_records",
        sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column("capability_id", sa.BigInteger(), nullable=False),
        sa.Column("submitted_by", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("capability_id", name="uq_audit_capability_id"),
    )


def downgrade() -> None:
    op.drop_table("capability_audit_records")
