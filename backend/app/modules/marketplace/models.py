from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

BIGINT_PK = BigInteger().with_variant(Integer, "sqlite")


class CapabilityDownloadToken(Base):
    __tablename__ = "capability_download_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    capability_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("capabilities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    package_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class CapabilityDownloadLog(Base):
    __tablename__ = "capability_download_logs"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    capability_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("capabilities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    download_token_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("capability_download_tokens.id", ondelete="SET NULL"), nullable=True, index=True
    )
    downloaded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )


class CapabilityFavorite(Base):
    __tablename__ = "capability_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "capability_id", name="uq_capability_favorites_user_capability"),
        {"comment": "用户收藏能力表"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, comment="收藏ID")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="收藏人用户ID"
    )
    capability_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("capabilities.id", ondelete="CASCADE"), nullable=False, index=True, comment="被收藏能力ID"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="收藏时间"
    )
