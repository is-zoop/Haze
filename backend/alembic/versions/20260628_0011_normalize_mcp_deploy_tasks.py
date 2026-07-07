"""normalize repeated MCP deploy tasks
Revision ID: 20260628_0011
Revises: 20260628_0010
"""
import sqlalchemy as sa
from alembic import op

revision = "20260628_0011"
down_revision = "20260628_0010"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    tasks = sa.table("mcp_deploy_tasks", sa.column("id", sa.BigInteger()), sa.column("capability_id", sa.BigInteger()), sa.column("task_type", sa.String()), sa.column("created_at", sa.DateTime()))
    rows = bind.execute(sa.select(tasks.c.id, tasks.c.capability_id).where(tasks.c.task_type == "deploy").order_by(tasks.c.capability_id, tasks.c.created_at, tasks.c.id)).all()
    seen: set[int] = set()
    for row in rows:
        if row.capability_id in seen:
            bind.execute(tasks.update().where(tasks.c.id == row.id).values(task_type="redeploy"))
        else:
            seen.add(row.capability_id)

def downgrade() -> None:
    pass
