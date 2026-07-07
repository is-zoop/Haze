"""allow users without email

Revision ID: 20260630_0013
Revises: 20260629_0012
"""

from alembic import op
import sqlalchemy as sa


revision = "20260630_0013"
down_revision = "20260629_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE users SET email = CONCAT('no-email-', id, '@invalid.local') "
            "WHERE email IS NULL"
        )
    )
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=255),
        nullable=False,
    )