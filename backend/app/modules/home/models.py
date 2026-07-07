from __future__ import annotations

from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

BIGINT_PK = BigInteger().with_variant(Integer, "sqlite")

class CapabilityUserUsage(Base):
    __tablename__ = "capability_user_usage"
    __table_args__ = (UniqueConstraint("user_id", "capability_id", name="uq_capability_user_usage_user_capability"),)
    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    capability_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("capabilities.id", ondelete="CASCADE"), nullable=False, index=True)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_used_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
