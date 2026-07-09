from __future__ import annotations

import hashlib
import mimetypes
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Annotated, Literal
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.response import ApiResponse, success_response
from app.core.security import get_personal_credential_user, require_capabilities, require_marketplace_access
from app.db.session import get_db
from app.modules.auth.router import _get_or_create_mcp_credential
from app.modules.business_categories.models import BusinessCategory
from app.modules.capabilities.metrics import capability_call_counts
from app.modules.capabilities.models import Capability, CapabilityVersion
from app.modules.capabilities.storage import resolve_stored_file
from app.modules.marketplace.models import CapabilityDownloadLog, CapabilityDownloadToken, CapabilityFavorite
from app.modules.mcp_runtime.models import McpDeployment
from app.modules.marketplace.schemas import AccessPromptData, DownloadLinkData, FavoriteResult, MarketCapabilityData, MarketContentData, MarketListData, MarketVersionData
from app.modules.users.models import Department, User

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])
public_router = APIRouter(prefix="/api/public", tags=["public-downloads"])

MARKET_CONTENT_FILES = {"quick_start.md", "README.md"}
MAX_MARKET_CONTENT_SIZE = 1024 * 1024
PROMPT_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates" / "capability-prompts"


def _format_author(owner_name: str | None, department_name: str | None) -> str:
    return owner_name or ""


def _serialize_item(
    capability: Capability,
    owner_name: str | None,
    department_name: str | None,
    is_favorite: bool,
    version_history: list[MarketVersionData],
    deployment_public_url: str | None,
    calls: int,
) -> MarketCapabilityData:
    extension = capability.extension_json or {}
    config = extension.get("config") or {}
    cap_type = "Skill" if capability.type == "skill" else "MCP"
    transport = str(config.get("transport") or "HTTP").upper()
    return MarketCapabilityData(
        id=str(capability.id),
        name=capability.name,
        type=cap_type,
        description=capability.description,
        version=capability.version,
        author=_format_author(owner_name, department_name),
        department=department_name,
        category_id=capability.category_id,
        category=capability.category,
        connect_type=transport if capability.type == "mcp" else None,
        server_url=(deployment_public_url or str(config.get("serverUrl") or "") or None)
        if capability.type == "mcp" and transport != "STDIO" else None,
        version_history=version_history,
        tags=extension.get("tags", []),
        calls=calls,
        is_favorite=is_favorite,
        icon=f"/api/marketplace/capabilities/{capability.id}/icon" if capability.icon else None,
        updated_at=capability.updated_at.strftime("%Y-%m-%d"),
    )




def _render_access_prompt(
    template_name: str,
    *,
    ability_name: str,
    version: str,
    download_url: str | None = None,
    server_url: str | None = None,
    personal_credential: str | None = None,
) -> str:
    template_path = PROMPT_TEMPLATE_DIR / template_name
    try:
        template = template_path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        raise AppException(code=5001, message="接入 Prompt 模板不存在", status_code=500) from exc
    return (
        template
        .replace("{{ABILITY_NAME}}", ability_name)
        .replace("{{VERSION}}", version)
        .replace("{{DOWNLOAD_URL}}", download_url or "TODO_短期下载链接暂未启用")
        .replace("{{SERVER_URL}}", server_url or "TODO_MCP Server地址未配置")
        .replace("{{PERSONAL_CREDENTIAL}}", personal_credential or "")
        .strip()
    )


def _get_published_capability(db: Session, capability_id: int) -> Capability:
    capability = db.scalar(
        select(Capability).where(
            Capability.id == capability_id,
            Capability.status == "published",
            Capability.deleted_at.is_(None),
        )
    )
    if capability is None:
        raise AppException(code=4042, message="能力不存在或已下线", status_code=404)
    return capability


@router.get("/capabilities/{capability_id}/icon", response_class=FileResponse)
def get_market_capability_icon(
    capability_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_marketplace_access)],
) -> FileResponse:
    capability = _get_published_capability(db, capability_id)
    if not capability.icon:
        raise AppException(code=4045, message="Capability icon not found", status_code=404)
    return FileResponse(resolve_stored_file(capability.icon))


def _create_download_link(db: Session, capability: Capability, actor: User) -> DownloadLinkData:
    extension = capability.extension_json or {}
    transport = str((extension.get("config") or {}).get("transport") or "HTTP").upper()
    if capability.type == "mcp" and transport != "STDIO":
        raise AppException(code=4001, message="该能力不支持 ZIP 下载", status_code=400)
    package = extension.get("package") or {}
    package_path = package.get("path")
    if not package_path:
        raise AppException(code=4045, message="能力 ZIP 文件不存在", status_code=404)

    settings = get_settings()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        minutes=settings.download_link_expire_minutes
    )
    db.add(CapabilityDownloadToken(
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        capability_id=capability.id,
        package_path=str(package_path),
        file_name=str(package.get("name") or f"{capability.code}-{capability.version}.zip"),
        version=capability.version,
        created_by=actor.id,
        expires_at=expires_at,
    ))
    db.commit()
    download_url = f"{settings.download_public_base_url.rstrip('/')}/api/public/downloads/{token}"
    return DownloadLinkData(download_url=download_url, expires_at=expires_at)

@router.get("/capabilities", response_model=ApiResponse[MarketListData])
def list_market_capabilities(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_marketplace_access)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str = "",
    capability_type: Literal["skill", "mcp"] | None = Query(default=None, alias="type"),
    category_id: int | None = None,
    favorite_only: bool = False,
) -> ApiResponse[MarketListData]:
    base = [Capability.status == "published", Capability.deleted_at.is_(None)]

    if capability_type:
        base.append(Capability.type == capability_type)
    if category_id:
        base.append(Capability.category_id == category_id)
    if search.strip():
        term = f"%{search.strip()}%"
        base.append(or_(
            Capability.name.like(term),
            Capability.description.like(term),
            Capability.business_category.has(BusinessCategory.name.like(term)),
            cast(Capability.extension_json["tags"], String).like(term),
        ))

    if favorite_only:
        base.append(
            Capability.id.in_(
                select(CapabilityFavorite.capability_id).where(CapabilityFavorite.user_id == actor.id)
            )
        )

    total = db.scalar(select(func.count()).select_from(Capability).where(*base)) or 0

    rows = db.execute(
        select(Capability).where(*base).order_by(Capability.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    if not rows:
        return success_response(request, MarketListData(items=[], page=page, page_size=page_size, total=total))

    capability_ids = [c.id for c in rows]
    owner_ids = list({c.owner_id for c in rows if c.owner_id})
    dept_ids = list({c.department_id for c in rows if c.department_id})

    owners: dict[int, str] = {}
    if owner_ids:
        for user in db.scalars(select(User).where(User.id.in_(owner_ids))).all():
            owners[user.id] = user.name

    depts: dict[int, str] = {}
    if dept_ids:
        for dept in db.scalars(select(Department).where(Department.id.in_(dept_ids))).all():
            depts[dept.id] = dept.name

    favorited: set[int] = set(
        db.scalars(
            select(CapabilityFavorite.capability_id).where(
                CapabilityFavorite.user_id == actor.id,
                CapabilityFavorite.capability_id.in_(capability_ids),
            )
        ).all()
    )

    versions_by_capability: dict[int, list[MarketVersionData]] = {capability_id: [] for capability_id in capability_ids}
    version_rows = db.scalars(
        select(CapabilityVersion)
        .where(CapabilityVersion.capability_id.in_(capability_ids))
        .order_by(CapabilityVersion.created_at.desc(), CapabilityVersion.id.desc())
    ).all()
    for version in version_rows:
        versions_by_capability[version.capability_id].append(
            MarketVersionData(
                version=version.version,
                created_at=version.created_at.isoformat(),
                changelog=version.changelog,
            )
        )

    deployment_urls = dict(
        db.execute(
            select(McpDeployment.capability_id, McpDeployment.public_url)
            .where(McpDeployment.capability_id.in_(capability_ids))
        ).all()
    )
    call_counts = capability_call_counts(db, rows)

    items = [
        _serialize_item(
            c,
            owners.get(c.owner_id) if c.owner_id else None,
            depts.get(c.department_id) if c.department_id else None,
            c.id in favorited,
            versions_by_capability.get(c.id, []),
            deployment_urls.get(c.id),
            call_counts.get(c.id, 0),
        )
        for c in rows
    ]

    return success_response(request, MarketListData(items=items, page=page, page_size=page_size, total=total))


@router.post("/capabilities/{capability_id}/download-link", response_model=ApiResponse[DownloadLinkData])
def create_capability_download_link(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.marketplace"))],
) -> ApiResponse[DownloadLinkData]:
    capability = _get_published_capability(db, capability_id)
    return success_response(request, _create_download_link(db, capability, actor))


@router.get("/capabilities/{capability_id}/access-prompt", response_model=ApiResponse[AccessPromptData])
def get_capability_access_prompt(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_marketplace_access)],
) -> ApiResponse[AccessPromptData]:
    capability = _get_published_capability(db, capability_id)
    extension = capability.extension_json or {}
    config = extension.get("config") or {}
    transport = str(config.get("transport") or "HTTP").upper()
    cap_type = "Skill" if capability.type == "skill" else "MCP"
    download: DownloadLinkData | None = None
    server_url: str | None = None

    if capability.type == "skill":
        download = _create_download_link(db, capability, actor)
        access_mode = "skill_download"
        prompt = _render_access_prompt(
            "skill.md",
            ability_name=capability.name,
            version=capability.version,
            download_url=download.download_url,
        )
    elif transport == "STDIO":
        download = _create_download_link(db, capability, actor)
        access_mode = "stdio_mcp_download"
        prompt = _render_access_prompt(
            "stdio-mcp.md",
            ability_name=capability.name,
            version=capability.version,
            download_url=download.download_url,
        )
    else:
        deployment_url = db.scalar(select(McpDeployment.public_url).where(McpDeployment.capability_id == capability.id))
        server_url = deployment_url or str(config.get("serverUrl") or "") or None
        if not server_url:
            raise AppException(code=4005, message="该 MCP 尚未配置可用服务地址", status_code=400)
        credential = _get_or_create_mcp_credential(db, actor)
        if not credential.key_raw:
            raise AppException(code=4006, message="个人服务凭证不可用", status_code=400)
        access_mode = "http_mcp"
        prompt = _render_access_prompt(
            "http-mcp.md",
            ability_name=capability.name,
            version=capability.version,
            server_url=server_url,
            personal_credential=credential.key_raw,
        )

    return success_response(request, AccessPromptData(
        capability_id=str(capability.id),
        name=capability.name,
        type=cap_type,
        version=capability.version,
        access_mode=access_mode,
        prompt=prompt,
        download_url=download.download_url if download else None,
        server_url=server_url,
        expires_at=download.expires_at if download else None,
    ))

@public_router.get("/downloads/{token}", response_class=FileResponse)
def download_with_short_lived_token(
    token: str,
    db: Annotated[Session, Depends(get_db)],
) -> FileResponse:
    if len(token) < 20 or len(token) > 200:
        raise AppException(code=4046, message="下载链接无效，请重新生成", status_code=404)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    record = db.scalar(
        select(CapabilityDownloadToken).where(CapabilityDownloadToken.token_hash == token_hash)
    )
    if record is None:
        raise AppException(code=4046, message="下载链接无效，请重新生成", status_code=404)
    if record.revoked_at is not None:
        raise AppException(code=4102, message="下载链接已撤销，请重新生成", status_code=410)
    if record.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise AppException(code=4101, message="下载链接已过期，请重新生成", status_code=410)
    capability = db.scalar(
        select(Capability).where(
            Capability.id == record.capability_id,
            Capability.status == "published",
            Capability.deleted_at.is_(None),
        )
    )
    if capability is None:
        raise AppException(code=4042, message="能力不存在或已下线", status_code=404)
    try:
        package_file = resolve_stored_file(record.package_path)
    except AppException as exc:
        raise AppException(code=4045, message="能力 ZIP 文件不存在", status_code=404) from exc
    db.add(CapabilityDownloadLog(
        capability_id=capability.id,
        version=record.version,
        user_id=record.created_by,
        source="short_link",
        download_token_id=record.id,
    ))
    db.commit()
    return FileResponse(
        package_file,
        media_type="application/zip",
        filename=record.file_name,
        headers={"Cache-Control": "no-store"},
    )


@router.get("/capabilities/{capability_id}/download", response_class=FileResponse)
def download_capability_package(
    capability_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_personal_credential_user)],
) -> FileResponse:
    capability = db.scalar(
        select(Capability).where(
            Capability.id == capability_id,
            Capability.status == "published",
            Capability.deleted_at.is_(None),
        )
    )
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)
    extension = capability.extension_json or {}
    transport = str((extension.get("config") or {}).get("transport") or "HTTP").upper()
    if capability.type == "mcp" and transport != "STDIO":
        raise AppException(code=4004, message="Only Skill or STDIO MCP packages can be downloaded", status_code=400)
    package = extension.get("package") or {}
    package_path = package.get("path")
    if not package_path:
        raise AppException(code=4045, message="Capability package not found", status_code=404)
    file_name = str(package.get("name") or f"{capability.code}-{capability.version}.zip")
    package_file = resolve_stored_file(str(package_path))
    db.add(CapabilityDownloadLog(
        capability_id=capability.id,
        version=capability.version,
        user_id=user.id,
        source="personal_credential",
    ))
    db.commit()
    return FileResponse(package_file, media_type="application/zip", filename=file_name)


def _read_market_content(capability: Capability, file_name: str) -> tuple[str | None, str]:
    if file_name not in MARKET_CONTENT_FILES:
        return None, ""
    documentation = (capability.extension_json or {}).get("documentation") or {}
    package_path = documentation.get("path")
    if not package_path:
        return None, ""

    try:
        with ZipFile(resolve_stored_file(str(package_path))) as archive:
            candidates = [
                info
                for info in archive.infolist()
                if not info.is_dir()
                and PurePosixPath(info.filename).name.lower() == file_name.lower()
                and info.file_size <= MAX_MARKET_CONTENT_SIZE
            ]
            if not candidates:
                return None, ""
            target = min(candidates, key=lambda info: len(PurePosixPath(info.filename).parts))
            target_path = PurePosixPath(target.filename)
            base_path = "" if str(target_path.parent) == "." else target_path.parent.as_posix()
            return archive.read(target).decode("utf-8-sig"), base_path
    except (BadZipFile, UnicodeDecodeError, OSError):
        return None, ""


@router.get("/capabilities/{capability_id}/content", response_model=ApiResponse[MarketContentData])
def get_market_content(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.marketplace"))],
    file_name: Literal["quick_start.md", "README.md"] = Query(alias="file"),
) -> ApiResponse[MarketContentData]:
    capability = db.scalar(
        select(Capability).where(
            Capability.id == capability_id,
            Capability.status == "published",
            Capability.deleted_at.is_(None),
        )
    )
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)
    content, base_path = _read_market_content(capability, file_name)
    return success_response(
        request,
        MarketContentData(file_name=file_name, base_path=base_path, content=content),
    )


@router.get("/capabilities/{capability_id}/documentation/{asset_path:path}")
def get_market_document_asset(
    capability_id: int,
    asset_path: str,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.marketplace"))],
) -> Response:
    capability = db.scalar(
        select(Capability).where(
            Capability.id == capability_id,
            Capability.status == "published",
            Capability.deleted_at.is_(None),
        )
    )
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)
    path = PurePosixPath(asset_path)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise AppException(code=4045, message="Documentation asset not found", status_code=404)
    documentation = (capability.extension_json or {}).get("documentation") or {}
    package_path = documentation.get("path")
    if not package_path:
        raise AppException(code=4045, message="Documentation asset not found", status_code=404)
    try:
        with ZipFile(resolve_stored_file(str(package_path))) as archive:
            data = archive.read(path.as_posix())
    except (BadZipFile, KeyError, OSError):
        raise AppException(code=4045, message="Documentation asset not found", status_code=404)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return Response(content=data, media_type=media_type)


@router.post("/capabilities/{capability_id}/favorite", response_model=ApiResponse[FavoriteResult])
def toggle_favorite(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("page.marketplace"))],
) -> ApiResponse[FavoriteResult]:
    capability = db.scalar(
        select(Capability).where(
            Capability.id == capability_id,
            Capability.status == "published",
            Capability.deleted_at.is_(None),
        )
    )
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)

    existing = db.scalar(
        select(CapabilityFavorite).where(
            CapabilityFavorite.user_id == actor.id,
            CapabilityFavorite.capability_id == capability_id,
        )
    )
    if existing:
        db.delete(existing)
        db.commit()
        return success_response(request, FavoriteResult(is_favorite=False))

    try:
        db.add(CapabilityFavorite(user_id=actor.id, capability_id=capability_id))
        db.commit()
    except IntegrityError:
        db.rollback()
    return success_response(request, FavoriteResult(is_favorite=True))
