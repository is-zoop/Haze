"""add managed business categories

Revision ID: 20260629_0012
Revises: 20260628_0011
"""
import sqlalchemy as sa
from alembic import op

revision = "20260629_0012"
down_revision = "20260628_0011"
branch_labels = None
depends_on = None

DEFAULT_CATEGORIES = ["\u6570\u636e\u5206\u6790", "\u8f6f\u4ef6\u5f00\u53d1", "\u4f01\u4e1a\u529e\u516c", "\u7535\u5546\u8fd0\u8425", "\u8d22\u52a1", "\u4eba\u529b\u8d44\u6e90", "\u77e5\u8bc6\u68c0\u7d22"]


def _columns(bind: sa.engine.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if "business_categories" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "business_categories",
            sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("name_normalized", sa.String(100), nullable=False),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("updated_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("name_normalized", name="uq_business_categories_name_normalized"),
        )
    capability_columns = _columns(bind, "capabilities")
    if "category_id" not in capability_columns:
        op.add_column("capabilities", sa.Column("category_id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), nullable=True))
        capability_columns.add("category_id")

    categories = sa.table("business_categories", sa.column("id", sa.BigInteger()), sa.column("name", sa.String()), sa.column("name_normalized", sa.String()))
    capabilities = sa.table("capabilities", sa.column("category", sa.String()), sa.column("category_id", sa.BigInteger()))
    existing: list[str] = []
    if "category" in capability_columns:
        rows = bind.execute(sa.select(sa.distinct(capabilities.c.category)).where(capabilities.c.category.is_not(None))).all()
        existing = [row[0].strip() for row in rows if row[0] and row[0].strip()]

    names: list[str] = []
    seen: set[str] = set()
    for name in [*DEFAULT_CATEGORIES, *existing]:
        normalized = name.casefold()
        if normalized not in seen:
            seen.add(normalized)
            names.append(name)
    for name in names:
        normalized = name.casefold()
        category_id = bind.scalar(sa.select(categories.c.id).where(categories.c.name_normalized == normalized))
        if category_id is None:
            bind.execute(categories.insert().values(name=name, name_normalized=normalized))
            category_id = bind.scalar(sa.select(categories.c.id).where(categories.c.name_normalized == normalized))
        if "category" in capability_columns:
            bind.execute(
                capabilities.update()
                .where(sa.func.lower(sa.func.trim(capabilities.c.category)) == name.lower())
                .values(category_id=category_id)
            )

    inspector = sa.inspect(bind)
    index_names = {item["name"] for item in inspector.get_indexes("capabilities")}
    foreign_key_names = {item.get("name") for item in inspector.get_foreign_keys("capabilities")}
    with op.batch_alter_table("capabilities") as batch:
        if "ix_capabilities_category_id" not in index_names:
            batch.create_index("ix_capabilities_category_id", ["category_id"])
        if "fk_capabilities_category_id" not in foreign_key_names:
            batch.create_foreign_key("fk_capabilities_category_id", "business_categories", ["category_id"], ["id"], ondelete="RESTRICT")
        if "category" in capability_columns:
            batch.drop_column("category")


def downgrade() -> None:
    bind = op.get_bind()
    capability_columns = _columns(bind, "capabilities")
    if "category" not in capability_columns:
        with op.batch_alter_table("capabilities") as batch:
            batch.add_column(sa.Column("category", sa.String(100), nullable=True))
    bind.execute(sa.text("UPDATE capabilities SET category = (SELECT name FROM business_categories WHERE business_categories.id = capabilities.category_id)"))
    inspector = sa.inspect(bind)
    index_names = {item["name"] for item in inspector.get_indexes("capabilities")}
    foreign_key_names = {item.get("name") for item in inspector.get_foreign_keys("capabilities")}
    with op.batch_alter_table("capabilities") as batch:
        if "fk_capabilities_category_id" in foreign_key_names:
            batch.drop_constraint("fk_capabilities_category_id", type_="foreignkey")
        if "ix_capabilities_category_id" in index_names:
            batch.drop_index("ix_capabilities_category_id")
        if "category_id" in _columns(bind, "capabilities"):
            batch.drop_column("category_id")
    if "business_categories" in sa.inspect(bind).get_table_names():
        op.drop_table("business_categories")