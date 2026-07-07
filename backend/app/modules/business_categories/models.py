from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

BIGINT_PK = BigInteger().with_variant(Integer, "sqlite")
DEFAULT_CATEGORY_NAMES = ["\u6570\u636e\u5206\u6790", "\u8f6f\u4ef6\u5f00\u53d1", "\u4f01\u4e1a\u529e\u516c", "\u7535\u5546\u8fd0\u8425", "\u8d22\u52a1", "\u4eba\u529b\u8d44\u6e90", "\u77e5\u8bc6\u68c0\u7d22"]


class BusinessCategory(Base):
    __tablename__ = "business_categories"
    __table_args__ = (
        UniqueConstraint("name_normalized", name="uq_business_categories_name_normalized"),
        {"comment": "Business categories"},
    )

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_normalized: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
