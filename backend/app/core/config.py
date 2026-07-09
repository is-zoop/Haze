from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_prefix="",
        extra="ignore",
    )

    app_name: str = "Haze Tool API"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    database_url: str = (
        "mysql+pymysql://haze:haze@127.0.0.1:3306/haze?charset=utf8mb4"
    )
    jwt_secret_key: SecretStr = SecretStr("change-me-in-production-use-32-bytes")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = Field(default=60, ge=1)
    initial_admin_name: str | None = None
    initial_admin_phone: str | None = None
    initial_admin_email: str | None = None
    initial_admin_password: SecretStr | None = None
    initial_admin_department: str | None = None
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    local_storage_dir: Path = Path("./storage")
    gateway_public_base_url: str = "http://127.0.0.1:8001"
    download_public_base_url: str = "http://127.0.0.1:8000"
    download_link_expire_minutes: int = Field(default=30, ge=1, le=1440)
    mcp_docker_prepull: bool = False
    mcp_docker_images: list[str] = Field(
        default_factory=lambda: ["node:20-slim", "python:3.12-slim"]
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
