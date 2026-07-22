from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.core.rbac import ADMIN, SYSTEM_ADMIN
from app.modules.business_categories.models import BusinessCategory
from app.modules.capabilities.metrics import capability_call_counts
from app.modules.capabilities.models import Capability, CapabilityVersion
from app.modules.capabilities.schemas import (
    CapabilityCreate,
    CapabilityData,
    CapabilityListData,
    CapabilityUpdate,
    CapabilityVersionCreate,
    CapabilityVersionData,
    CapabilityVersionListData,
    TestStatusUpdate,
)
from app.modules.capabilities.storage import consume_upload, delete_capability_directory, delete_stored_files, peek_upload, resolve_stored_file
from app.modules.users.models import Department, User

ADMIN_ROLES = {SYSTEM_ADMIN, ADMIN}


def _is_admin(user: User) -> bool:
    return any(role.code in ADMIN_ROLES for role in user.roles)


def _normalize_version(version: str) -> str:
    return version.strip().removeprefix("v")


def _extension(capability: Capability) -> dict[str, Any]:
    return deepcopy(capability.extension_json or {})


def _snapshot(capability: Capability) -> dict[str, Any]:
    return {
        "code": capability.code,
        "name": capability.name,
        "type": capability.type,
        "description": capability.description,
        "category_id": capability.category_id,
        "category": capability.category,
        "icon": capability.icon,
        "version": capability.version,
        "status": capability.status,
        "visibility": capability.visibility,
        "owner_id": capability.owner_id,
        "department_id": capability.department_id,
        "extension_json": _extension(capability),
    }


def _serialize(
    db: Session,
    capability: Capability,
    *,
    owner_name: str | None = None,
    department_name: str | None = None,
    calls: int | None = None,
) -> CapabilityData:
    extension = _extension(capability)
    if owner_name is None and capability.owner_id is not None:
        owner = db.get(User, capability.owner_id)
        owner_name = owner.name if owner else None
    creator = db.get(User, capability.created_by) if capability.created_by is not None else None
    if department_name is None and capability.department_id is not None:
        department = db.get(Department, capability.department_id)
        department_name = department.name if department else None
    return CapabilityData(
        id=capability.id,
        code=capability.code,
        name=capability.name,
        type=capability.type,
        description=capability.description,
        category_id=capability.category_id,
        category=capability.category,
        icon=f"/api/developer/capabilities/{capability.id}/icon" if capability.icon else None,
        version=capability.version,
        status=capability.status,
        visibility=capability.visibility,
        owner_id=capability.owner_id,
        owner=owner_name,
        creator=creator.name if creator else None,
        department_id=capability.department_id,
        department=department_name,
        tags=extension.get("tags", []),
        config=extension.get("config", {}),
        calls=capability_call_counts(db, [capability]).get(capability.id, 0) if calls is None else calls,
        recent_test_status=extension.get("recent_test_status", "none"),
        package=extension.get("package"),
        documentation=extension.get("documentation"),
        created_at=capability.created_at,
        updated_at=capability.updated_at,
    )


def _active_filters(actor: User) -> list[Any]:
    filters: list[Any] = [Capability.deleted_at.is_(None)]
    if not _is_admin(actor):
        filters.append(Capability.owner_id == actor.id)
    return filters


def _get_capability(db: Session, capability_id: int, actor: User) -> Capability:
    capability = db.scalar(select(Capability).where(Capability.id == capability_id, *_active_filters(actor)))
    if capability is None:
        raise AppException(code=4042, message="Capability not found", status_code=404)
    return capability


def _ensure_code_available(db: Session, code: str, *, exclude_id: int | None = None) -> None:
    statement = select(Capability.id).where(Capability.code == code)
    if exclude_id is not None:
        statement = statement.where(Capability.id != exclude_id)
    if db.scalar(statement) is not None:
        raise AppException(code=4092, message="Capability code already exists", status_code=409)


def list_capabilities(
    db: Session,
    actor: User,
    *,
    page: int,
    page_size: int,
    search: str,
    capability_type: str | None,
    status: str | None,
) -> CapabilityListData:
    base_filters = _active_filters(actor)
    filters = list(base_filters)
    if search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Capability.code.like(term),
                Capability.name.like(term),
                Capability.description.like(term),
            )
        )
    if capability_type:
        filters.append(Capability.type == capability_type)
    if status:
        filters.append(Capability.status == status)

    total = db.scalar(select(func.count(Capability.id)).where(*filters)) or 0
    rows = db.execute(
        select(Capability, User.name, Department.name)
        .outerjoin(User, Capability.owner_id == User.id)
        .outerjoin(Department, Capability.department_id == Department.id)
        .where(*filters)
        .order_by(Capability.updated_at.desc(), Capability.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    counts = {
        "all": db.scalar(select(func.count(Capability.id)).where(*base_filters)) or 0,
        "draft": db.scalar(select(func.count(Capability.id)).where(*base_filters, Capability.status == "draft")) or 0,
        "reviewing": db.scalar(select(func.count(Capability.id)).where(*base_filters, Capability.status == "reviewing")) or 0,
        "published": db.scalar(select(func.count(Capability.id)).where(*base_filters, Capability.status == "published")) or 0,
        "offline": db.scalar(select(func.count(Capability.id)).where(*base_filters, Capability.status == "offline")) or 0,
        "skill": db.scalar(select(func.count(Capability.id)).where(*base_filters, Capability.type == "skill")) or 0,
        "mcp": db.scalar(select(func.count(Capability.id)).where(*base_filters, Capability.type == "mcp")) or 0,
    }
    call_counts = capability_call_counts(db, [capability for capability, _, _ in rows])
    return CapabilityListData(
        items=[
            _serialize(
                db,
                capability,
                owner_name=owner,
                department_name=department,
                calls=call_counts.get(capability.id, 0),
            )
            for capability, owner, department in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
        counts=counts,
    )


def get_capability(db: Session, capability_id: int, actor: User) -> CapabilityData:
    return _serialize(db, _get_capability(db, capability_id, actor))


def get_capability_icon(db: Session, capability_id: int, actor: User) -> Path:
    capability = _get_capability(db, capability_id, actor)
    if not capability.icon:
        raise AppException(code=4045, message="Capability icon not found", status_code=404)
    return resolve_stored_file(capability.icon)


def list_versions(db: Session, capability_id: int, actor: User) -> CapabilityVersionListData:
    _get_capability(db, capability_id, actor)
    versions = db.scalars(
        select(CapabilityVersion)
        .where(CapabilityVersion.capability_id == capability_id)
        .order_by(CapabilityVersion.created_at.desc(), CapabilityVersion.id.desc())
    ).all()
    return CapabilityVersionListData(
        items=[
            CapabilityVersionData(
                id=item.id,
                capability_id=item.capability_id,
                version=item.version,
                snapshot=item.snapshot_json,
                changelog=item.changelog,
                created_by=item.created_by,
                created_at=item.created_at,
            )
            for item in versions
        ],
        total=len(versions),
    )


def _ensure_category(db: Session, category_id: int | None) -> None:
    if category_id is not None and db.get(BusinessCategory, category_id) is None:
        raise AppException(code=4222, message="业务分类不存在", status_code=422)


def create_capability(db: Session, actor: User, payload: CapabilityCreate) -> CapabilityData:
    _ensure_category(db, payload.category_id)
    _ensure_code_available(db, payload.code)
    package_upload = peek_upload(
        payload.package_upload_token,
        actor_id=actor.id,
        kind="package",
        capability_type=payload.type,
    )
    documentation_upload = None
    if payload.documentation_upload_token:
        documentation_upload = peek_upload(
            payload.documentation_upload_token, actor_id=actor.id, kind="documentation"
        )
    icon_upload = None
    if payload.icon_upload_token:
        icon_upload = peek_upload(payload.icon_upload_token, actor_id=actor.id, kind="icon")

    capability = Capability(
        code=payload.code,
        name=payload.name.strip(),
        type=payload.type,
        description=payload.description.strip() if payload.description else None,
        category_id=payload.category_id,
        version=_normalize_version(payload.version),
        status="draft",
        visibility="internal",
        owner_id=actor.id,
        department_id=actor.department_id,
        created_by=actor.id,
        updated_by=actor.id,
        extension_json={
            "tags": payload.tags,
            "config": payload.config,
            "calls": 0,
            "recent_test_status": "none",
        },
    )
    created_paths: set[str] = set()
    try:
        db.add(capability)
        db.flush()
        extension = _extension(capability)
        package_path, package_meta = consume_upload(
            package_upload,
            destination=Path("capabilities") / str(capability.id) / "versions" / f"{capability.version}_{uuid4().hex}.zip",
        )
        created_paths.add(package_path)
        extension["package"] = package_meta
        if documentation_upload:
            documentation_path, documentation_meta = consume_upload(
                documentation_upload,
                destination=Path("capabilities") / str(capability.id) / "documentation" / f"{uuid4().hex}.zip",
            )
            created_paths.add(documentation_path)
            extension["documentation"] = documentation_meta
        if icon_upload:
            suffix = Path(icon_upload["file_name"]).suffix.lower()
            icon_path, icon_meta = consume_upload(
                icon_upload,
                destination=Path("capabilities") / str(capability.id) / "icons" / f"{uuid4().hex}{suffix}",
            )
            created_paths.add(icon_path)
            capability.icon = icon_path
            extension["icon"] = icon_meta
        capability.extension_json = extension
        db.add(
            CapabilityVersion(
                capability_id=capability.id,
                version=capability.version,
                snapshot_json=_snapshot(capability),
                changelog="Initial version",
                created_by=actor.id,
            )
        )
        db.commit()
        db.refresh(capability)
        return _serialize(db, capability)
    except IntegrityError as exc:
        db.rollback()
        delete_stored_files(created_paths)
        raise AppException(code=4092, message="Capability code or version already exists", status_code=409) from exc
    except Exception:
        db.rollback()
        delete_stored_files(created_paths)
        raise


HTTP_MCP_REPLACEABLE_PACKAGE_STATUSES = {"approved", "deploy_failed", "deployed", "debug_failed", "debug_passed"}
HTTP_MCP_PACKAGE_LOCKED_STATUSES = {"published", "offline"}
HTTP_MCP_REDEPLOY_STATUSES = {"approved", "deploy_failed", "deployed", "debug_failed", "debug_passed"}


def _get_http_mcp_deployment_snapshot_target(
    db: Session,
    capability: Capability,
) -> tuple[CapabilityVersion | None, Any | None]:
    """Resolve the active deployable version before consuming a one-shot upload token."""
    if capability.type != "mcp" or _transport(capability) != "HTTP":
        return None, None
    if capability.status not in HTTP_MCP_REPLACEABLE_PACKAGE_STATUSES:
        return None, None

    from app.modules.mcp_runtime.models import McpDeployment

    deployment = db.scalar(select(McpDeployment).where(McpDeployment.capability_id == capability.id))
    version = db.get(CapabilityVersion, deployment.version_id) if deployment and deployment.version_id else None
    if version is None:
        version = db.scalar(
            select(CapabilityVersion)
            .where(CapabilityVersion.capability_id == capability.id)
            .order_by(CapabilityVersion.created_at.desc())
            .limit(1)
        )
    if version is None:
        raise AppException(code=40912, message="当前部署版本快照不存在，请重新提交版本", status_code=409)
    return version, deployment


def _sync_http_mcp_deployment_snapshot_package(
    package_meta: dict[str, Any],
    version: CapabilityVersion | None,
    deployment: Any | None,
) -> None:
    """Keep the deployable version snapshot aligned with a pre-publish HTTP MCP ZIP replacement."""
    if version is None:
        return

    from app.modules.mcp_runtime import enums as mcp_enums

    snapshot = deepcopy(version.snapshot_json or {})
    snapshot_extension = deepcopy(snapshot.get("extension_json") or {})
    snapshot_extension["package"] = package_meta
    snapshot["extension_json"] = snapshot_extension
    version.snapshot_json = snapshot

    if deployment is not None:
        deployment.image_url = None
        deployment.last_error = None
        deployment.deploy_status = mcp_enums.DEPLOY_STATUS_PENDING
        deployment.actual_status = mcp_enums.ACTUAL_STATUS_PENDING
        deployment.health_status = mcp_enums.HEALTH_STATUS_UNKNOWN
        deployment.version_id = version.id

def update_capability(
    db: Session,
    capability_id: int,
    actor: User,
    payload: CapabilityUpdate,
) -> CapabilityData:
    capability = _get_capability(db, capability_id, actor)
    values = payload.model_dump(exclude_unset=True)
    if "category_id" in values:
        _ensure_category(db, values["category_id"])
    if "code" in values and values["code"] != capability.code:
        _ensure_code_available(db, values["code"], exclude_id=capability.id)

    icon_upload = None
    package_upload = None
    documentation_upload = None
    snapshot_version = None
    snapshot_deployment = None
    if values.get("package_upload_token"):
        snapshot_version, snapshot_deployment = _get_http_mcp_deployment_snapshot_target(db, capability)
    if values.get("icon_upload_token"):
        icon_upload = peek_upload(values["icon_upload_token"], actor_id=actor.id, kind="icon")
    if values.get("package_upload_token"):
        if capability.type == "mcp" and _transport(capability) == "HTTP" and capability.status in HTTP_MCP_PACKAGE_LOCKED_STATUSES:
            raise AppException(code=40913, message="已发布或已下线的 HTTP MCP 请通过新增版本替换 ZIP", status_code=409)
        package_upload = peek_upload(
            values["package_upload_token"], actor_id=actor.id, kind="package", capability_type=capability.type
        )
    if values.get("documentation_upload_token"):
        documentation_upload = peek_upload(
            values["documentation_upload_token"], actor_id=actor.id, kind="documentation"
        )

    old_paths: set[str] = set()
    created_paths: set[str] = set()
    extension = _extension(capability)
    try:
        for field in ("code", "name", "description", "category_id", "visibility"):
            if field in values:
                value = values[field]
                setattr(capability, field, value.strip() if isinstance(value, str) else value)
        if "tags" in values:
            extension["tags"] = values["tags"]
        if "config" in values:
            extension["config"] = values["config"]
        if icon_upload:
            old_icon = capability.icon
            if old_icon:
                old_paths.add(old_icon)
            suffix = Path(icon_upload["file_name"]).suffix.lower()
            icon_path, icon_meta = consume_upload(
                icon_upload,
                destination=Path("capabilities") / str(capability.id) / "icons" / f"{uuid4().hex}{suffix}",
            )
            created_paths.add(icon_path)
            capability.icon = icon_path
            extension["icon"] = icon_meta
        if package_upload:
            package_path, package_meta = consume_upload(
                package_upload,
                destination=Path("capabilities") / str(capability.id) / "current" / f"{uuid4().hex}.zip",
            )
            created_paths.add(package_path)
            extension["package"] = package_meta
            if capability.type == "mcp" and _transport(capability) == "HTTP" and capability.status in HTTP_MCP_REPLACEABLE_PACKAGE_STATUSES:
                capability.status = "approved"
                extension["recent_test_status"] = "none"
            _sync_http_mcp_deployment_snapshot_package(package_meta, snapshot_version, snapshot_deployment)
        if documentation_upload:
            old_documentation = (extension.get("documentation") or {}).get("path")
            if old_documentation:
                old_paths.add(old_documentation)
            documentation_path, documentation_meta = consume_upload(
                documentation_upload,
                destination=Path("capabilities") / str(capability.id) / "documentation" / f"{uuid4().hex}.zip",
            )
            created_paths.add(documentation_path)
            extension["documentation"] = documentation_meta
        capability.extension_json = extension
        capability.updated_by = actor.id
        db.commit()
        db.refresh(capability)
        delete_stored_files(old_paths)
        return _serialize(db, capability)
    except IntegrityError as exc:
        db.rollback()
        delete_stored_files(created_paths)
        raise AppException(code=4092, message="Capability code already exists", status_code=409) from exc
    except Exception:
        db.rollback()
        delete_stored_files(created_paths)
        raise


def create_version(
    db: Session,
    capability_id: int,
    actor: User,
    payload: CapabilityVersionCreate,
) -> CapabilityData:
    capability = _get_capability(db, capability_id, actor)
    if capability.status not in {"published", "debug_passed", "offline", "deploy_failed"}:
        raise AppException(code=4093, message="New versions can only be created from published, debug_passed, offline, or deploy_failed capabilities", status_code=409)
    version = _normalize_version(payload.version)
    if db.scalar(
        select(CapabilityVersion.id).where(
            CapabilityVersion.capability_id == capability.id,
            CapabilityVersion.version == version,
        )
    ) is not None:
        raise AppException(code=4094, message="Capability version already exists", status_code=409)
    if capability.type in {"skill", "mcp"} and not payload.package_upload_token:
        raise AppException(code=4009, message="Skill/MCP version requires a ZIP package", status_code=400)

    package_upload = None
    if payload.package_upload_token:
        package_upload = peek_upload(
            payload.package_upload_token,
            actor_id=actor.id,
            kind="package",
            capability_type=capability.type,
        )
    created_paths: set[str] = set()
    try:
        extension = _extension(capability)
        if package_upload:
            package_path, package_meta = consume_upload(
                package_upload,
                destination=Path("capabilities") / str(capability.id) / "versions" / f"{version}_{uuid4().hex}.zip",
            )
            created_paths.add(package_path)
            extension["package"] = package_meta
        capability.version = version
        capability.status = "draft"
        capability.extension_json = extension
        capability.updated_by = actor.id
        db.add(
            CapabilityVersion(
                capability_id=capability.id,
                version=version,
                snapshot_json=_snapshot(capability),
                changelog=payload.changelog.strip(),
                created_by=actor.id,
            )
        )
        db.commit()
        db.refresh(capability)
        return _serialize(db, capability)
    except IntegrityError as exc:
        db.rollback()
        delete_stored_files(created_paths)
        raise AppException(code=4094, message="Capability version already exists", status_code=409) from exc
    except Exception:
        db.rollback()
        delete_stored_files(created_paths)
        raise


def _transport(capability: Capability) -> str:
    return (_extension(capability).get("config") or {}).get("transport", "HTTP")


def submit_review(db: Session, capability_id: int, actor: User) -> CapabilityData:
    capability = _get_capability(db, capability_id, actor)
    if capability.status not in {"draft", "rejected"}:
        raise AppException(code=4097, message="Only draft or rejected capabilities can be submitted for review", status_code=409)
    capability.status = "reviewing"
    capability.updated_by = actor.id
    extension = _extension(capability)
    extension["submitted_at"] = datetime.utcnow().isoformat()
    extension["submitted_by"] = actor.id
    capability.extension_json = extension
    db.commit()
    db.refresh(capability)
    return _serialize(db, capability)


def _enqueue_mcp_runtime_task(db: Session, capability: Capability, actor: User, task_type: str) -> None:
    if capability.type != "mcp" or _transport(capability) != "HTTP":
        return

    from app.modules.mcp_runtime import enums as mcp_enums
    from app.modules.mcp_runtime.models import McpDeployment, McpDeployTask

    deployment = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == capability.id)
    )
    if deployment is None:
        return
    if task_type == mcp_enums.TASK_TYPE_STOP and deployment.deploy_status == mcp_enums.DEPLOY_STATUS_STOPPED:
        return

    existing = db.scalar(
        select(McpDeployTask)
        .where(
            McpDeployTask.capability_id == capability.id,
            McpDeployTask.task_type == task_type,
            McpDeployTask.task_status.in_([mcp_enums.TASK_STATUS_PENDING, mcp_enums.TASK_STATUS_RUNNING]),
        )
        .order_by(McpDeployTask.created_at.desc())
        .limit(1)
    )
    if existing is not None:
        return

    deployment.desired_status = mcp_enums.DESIRED_STATUS_STOPPED
    task = McpDeployTask(
        capability_id=capability.id,
        version_id=deployment.version_id,
        task_type=task_type,
        task_status=mcp_enums.TASK_STATUS_PENDING,
        runtime_provider=mcp_enums.RUNTIME_PROVIDER_K8S,
        created_by=actor.id,
    )
    db.add(task)


def deploy_capability(db: Session, capability_id: int, actor: User) -> CapabilityData:
    from app.modules.mcp_runtime import enums as mcp_enums
    from app.modules.mcp_runtime.models import McpDeployment, McpDeployTask

    capability = _get_capability(db, capability_id, actor)

    # 只有 HTTP MCP 走托管部署流程
    if capability.type != "mcp" or _transport(capability) != "HTTP":
        raise AppException(code=4098, message="Only HTTP MCP capabilities require deployment", status_code=409)

    if capability.status not in HTTP_MCP_REDEPLOY_STATUSES:
        raise AppException(code=4099, message="Capability must be approved or in pre-publish deployment validation before deployment", status_code=409)

    # 读取最新版本，Worker 从该版本的 snapshot 中找到 ZIP 包路径
    latest_version = db.scalar(
        select(CapabilityVersion)
        .where(CapabilityVersion.capability_id == capability_id)
        .order_by(CapabilityVersion.created_at.desc())
        .limit(1)
    )

    # 创建或重置 mcp_deployments（capability_id 唯一约束，可重复部署）
    deployment = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == capability_id)
    )
    is_initial_deploy = deployment is None
    deployment_name = f"mcp-{capability.code}"
    gateway_route = f"/assets/{capability.code}/mcp"
    public_url = f"{get_settings().gateway_public_base_url.rstrip('/')}/assets/{capability.code}/mcp"

    if deployment:
        # 重试部署：重置状态并清除上次错误
        deployment.deploy_status = mcp_enums.DEPLOY_STATUS_PENDING
        deployment.actual_status = mcp_enums.ACTUAL_STATUS_PENDING
        deployment.version_id = latest_version.id if latest_version else None
        deployment.last_error = None
    else:
        deployment = McpDeployment(
            capability_id=capability_id,
            version_id=latest_version.id if latest_version else None,
            deployment_name=deployment_name,
            namespace="haze-runtime",
            runtime_provider=mcp_enums.RUNTIME_PROVIDER_K8S,
            deploy_status=mcp_enums.DEPLOY_STATUS_PENDING,
            desired_status=mcp_enums.DESIRED_STATUS_RUNNING,
            actual_status=mcp_enums.ACTUAL_STATUS_PENDING,
            gateway_route=gateway_route,
            public_url=public_url,
        )
        db.add(deployment)

    db.flush()  # 确保 deployment.id 已生成，避免外键约束问题

    # 创建部署任务，Deploy Worker 轮询消费后执行真实 K8s 部署
    task = McpDeployTask(
        capability_id=capability_id,
        version_id=latest_version.id if latest_version else None,
        task_type=mcp_enums.TASK_TYPE_DEPLOY if is_initial_deploy else mcp_enums.TASK_TYPE_REDEPLOY,
        task_status=mcp_enums.TASK_STATUS_PENDING,
        runtime_provider=mcp_enums.RUNTIME_PROVIDER_K8S,
        created_by=actor.id,
    )
    db.add(task)
    db.commit()
    db.refresh(capability)
    # capability.status 保持 approved，由 Worker 在部署成功后推进到 deployed；
    # 连接测试通过后再由测试接口推进到 debug_passed。
    return _serialize(db, capability)


def mark_debug_passed(db: Session, capability_id: int, actor: User) -> CapabilityData:
    capability = _get_capability(db, capability_id, actor)
    if capability.type != "mcp":
        raise AppException(code=4004, message="Only MCP capabilities require debugging", status_code=400)
    if _transport(capability) == "HTTP":
        allowed = {"deployed", "debug_failed", "debug_passed"}
    else:
        allowed = {"approved", "debug_failed"}
    if capability.status not in allowed:
        raise AppException(code=40910, message="Capability is not ready for debugging", status_code=409)
    # 调试功能暂未开发，默认置为调试通过，并同步测试状态
    capability.status = "debug_passed"
    extension = _extension(capability)
    extension["recent_test_status"] = "pass"
    capability.extension_json = extension
    capability.updated_by = actor.id
    db.commit()
    db.refresh(capability)
    return _serialize(db, capability)


def publish_capability(db: Session, capability_id: int, actor: User) -> CapabilityData:
    capability = _get_capability(db, capability_id, actor)
    required = {"approved", "offline"} if capability.type == "skill" else {"debug_passed", "offline"}
    if capability.status not in required:
        raise AppException(code=40911, message="Capability is not ready to be published", status_code=409)
    capability.status = "published"
    capability.updated_by = actor.id
    db.commit()
    db.refresh(capability)
    return _serialize(db, capability)


def offline_capability(db: Session, capability_id: int, actor: User) -> CapabilityData:
    from app.modules.mcp_runtime import enums as mcp_enums

    capability = _get_capability(db, capability_id, actor)
    if capability.status == "draft":
        raise AppException(code=4096, message="Draft capability cannot be taken offline", status_code=409)
    capability.status = "offline"
    capability.updated_by = actor.id
    _enqueue_mcp_runtime_task(db, capability, actor, mcp_enums.TASK_TYPE_STOP)
    db.commit()
    db.refresh(capability)
    return _serialize(db, capability)


def update_test_status(
    db: Session,
    capability_id: int,
    actor: User,
    payload: TestStatusUpdate,
) -> CapabilityData:
    capability = _get_capability(db, capability_id, actor)
    if capability.type != "mcp":
        raise AppException(code=4004, message="Skill capability does not require testing", status_code=400)
    extension = _extension(capability)
    extension["recent_test_status"] = payload.status
    capability.extension_json = extension
    capability.updated_by = actor.id
    db.commit()
    db.refresh(capability)
    return _serialize(db, capability)


def delete_capability(db: Session, capability_id: int, actor: User) -> None:
    from app.modules.mcp_runtime import enums as mcp_enums

    capability = _get_capability(db, capability_id, actor)
    paths: set[str] = set()
    extension = _extension(capability)
    original_code = capability.code
    if capability.icon:
        paths.add(capability.icon)
    package = extension.get("package") or {}
    if package.get("path"):
        paths.add(package["path"])
    documentation = extension.get("documentation") or {}
    if documentation.get("path"):
        paths.add(documentation["path"])
    for version in capability.versions:
        snapshot_extension = (version.snapshot_json or {}).get("extension_json") or {}
        snapshot_package = snapshot_extension.get("package") or {}
        if snapshot_package.get("path"):
            paths.add(snapshot_package["path"])
        snapshot_icon = (version.snapshot_json or {}).get("icon")
        if snapshot_icon:
            paths.add(snapshot_icon)

    deleted_at = datetime.utcnow()
    extension["original_code"] = original_code
    extension["deleted_by"] = actor.id
    _enqueue_mcp_runtime_task(db, capability, actor, mcp_enums.TASK_TYPE_DELETE)
    capability.extension_json = extension
    capability.code = f"{original_code[:45]}__deleted_{capability.id}_{int(deleted_at.timestamp())}"[:100]
    capability.deleted_at = deleted_at
    capability.updated_by = actor.id
    db.commit()
    delete_stored_files(paths)
    delete_capability_directory(capability.id)
