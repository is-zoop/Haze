from __future__ import annotations

import json
from typing import Annotated, AsyncGenerator, Literal

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.response import ApiResponse, success_response
from app.core.config import get_settings
from app.core.security import require_capabilities
from app.db.session import get_db
from app.modules.capabilities import service
from app.modules.capabilities.models import Capability
from app.modules.capabilities.test_runner import run_http_mcp_test, run_stdio_mcp_test
from app.modules.mcp_runtime.models import McpDeployment
from app.modules.capabilities.schemas import (
    CapabilityCreate,
    CapabilityData,
    CapabilityListData,
    CapabilityUpdate,
    CapabilityVersionCreate,
    CapabilityVersionListData,
    DeleteResult,
    TestStatusUpdate,
    UploadData,
)
from app.modules.capabilities.storage import create_upload
from app.modules.users.models import User

router = APIRouter(prefix="/api/developer", tags=["developer capabilities"])


@router.get("/capabilities", response_model=ApiResponse[CapabilityListData])
def list_capabilities(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.read"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str = "",
    capability_type: Literal["skill", "mcp"] | None = Query(default=None, alias="type"),
    status: Literal[
        "draft",
        "reviewing",
        "approved",
        "rejected",
        "deployed",
        "deploy_failed",
        "debug_passed",
        "debug_failed",
        "published",
        "offline",
    ]
    | None = None,
) -> ApiResponse[CapabilityListData]:
    data = service.list_capabilities(
        db,
        actor,
        page=page,
        page_size=page_size,
        search=search,
        capability_type=capability_type,
        status=status,
    )
    return success_response(request, data)


@router.post("/uploads/icon", response_model=ApiResponse[UploadData])
async def upload_icon(
    request: Request,
    actor: Annotated[User, Depends(require_capabilities("capabilities.create"))],
    file: Annotated[UploadFile, File(...)],
) -> ApiResponse[UploadData]:
    metadata = await create_upload(file, kind="icon", actor_id=actor.id)
    return success_response(request, UploadData(
        upload_token=metadata["token"],
        kind="icon",
        file_name=metadata["file_name"],
        size=metadata["size"],
        expires_at=metadata["expires_at"],
    ))


@router.post("/uploads/package", response_model=ApiResponse[UploadData])
async def upload_package(
    request: Request,
    actor: Annotated[User, Depends(require_capabilities("capabilities.create"))],
    type: Annotated[Literal["skill", "mcp"], Query()],
    file: Annotated[UploadFile, File(...)],
) -> ApiResponse[UploadData]:
    metadata = await create_upload(file, kind="package", actor_id=actor.id, capability_type=type)
    return success_response(request, UploadData(
        upload_token=metadata["token"],
        kind="package",
        file_name=metadata["file_name"],
        size=metadata["size"],
        expires_at=metadata["expires_at"],
        files=metadata["files"],
        manifest=metadata["manifest"],
    ))


@router.post("/uploads/documentation", response_model=ApiResponse[UploadData])
async def upload_documentation(
    request: Request,
    actor: Annotated[User, Depends(require_capabilities("capabilities.create"))],
    file: Annotated[UploadFile, File(...)],
) -> ApiResponse[UploadData]:
    metadata = await create_upload(file, kind="documentation", actor_id=actor.id)
    return success_response(request, UploadData(
        upload_token=metadata["token"],
        kind="documentation",
        file_name=metadata["file_name"],
        size=metadata["size"],
        expires_at=metadata["expires_at"],
        files=metadata["files"],
    ))


@router.post("/capabilities", response_model=ApiResponse[CapabilityData])
def create_capability(
    payload: CapabilityCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.create"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.create_capability(db, actor, payload))


@router.get("/capabilities/{capability_id}", response_model=ApiResponse[CapabilityData])
def get_capability(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.read"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.get_capability(db, capability_id, actor))


@router.get("/capabilities/{capability_id}/icon", response_class=FileResponse)
def get_capability_icon(
    capability_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.read"))],
) -> FileResponse:
    path = service.get_capability_icon(db, capability_id, actor)
    return FileResponse(path)


@router.patch("/capabilities/{capability_id}", response_model=ApiResponse[CapabilityData])
def update_capability(
    capability_id: int,
    payload: CapabilityUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.update"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.update_capability(db, capability_id, actor, payload))


@router.get("/capabilities/{capability_id}/versions", response_model=ApiResponse[CapabilityVersionListData])
def list_versions(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.read"))],
) -> ApiResponse[CapabilityVersionListData]:
    return success_response(request, service.list_versions(db, capability_id, actor))


@router.post("/capabilities/{capability_id}/versions", response_model=ApiResponse[CapabilityData])
def create_version(
    capability_id: int,
    payload: CapabilityVersionCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.version"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.create_version(db, capability_id, actor, payload))


@router.post("/capabilities/{capability_id}/submit-review", response_model=ApiResponse[CapabilityData])
def submit_review(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.publish"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.submit_review(db, capability_id, actor))


@router.post("/capabilities/{capability_id}/deploy", response_model=ApiResponse[CapabilityData])
def deploy_capability(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.publish"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.deploy_capability(db, capability_id, actor))


@router.post("/capabilities/{capability_id}/debug", response_model=ApiResponse[CapabilityData])
def debug_capability(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.publish"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.mark_debug_passed(db, capability_id, actor))


@router.post("/capabilities/{capability_id}/publish", response_model=ApiResponse[CapabilityData])
def publish_capability(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.publish"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.publish_capability(db, capability_id, actor))


@router.post("/capabilities/{capability_id}/offline", response_model=ApiResponse[CapabilityData])
def offline_capability(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.offline"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.offline_capability(db, capability_id, actor))


@router.patch("/capabilities/{capability_id}/test-status", response_model=ApiResponse[CapabilityData])
def update_test_status(
    capability_id: int,
    payload: TestStatusUpdate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.test_result"))],
) -> ApiResponse[CapabilityData]:
    return success_response(request, service.update_test_status(db, capability_id, actor, payload))


@router.get("/capabilities/{capability_id}/test-run")
async def run_capability_test(
    capability_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.read"))],
) -> StreamingResponse:
    capability = db.scalar(
        select(Capability).where(Capability.id == capability_id, Capability.deleted_at.is_(None))
    )
    if capability is None:
        from app.core.exceptions import AppException
        raise AppException(code=4042, message="Capability not found", status_code=404)

    config = (capability.extension_json or {}).get("config", {})
    transport = config.get("transport", "HTTP")
    server_url: str = config.get("serverUrl", "")
    start_command: str = config.get("startCommand", "")
    start_args: str = config.get("startArgs", "")

    # For HTTP MCPs deployed to K8s, fall back to the deployment's internal URL
    if transport != "STDIO" and not server_url:
        dep = db.scalar(
            select(McpDeployment)
            .where(McpDeployment.capability_id == capability.id)
            .order_by(McpDeployment.id.desc())
        )
        if dep and dep.internal_url:
            server_url = dep.internal_url

    async def event_stream() -> AsyncGenerator[str, None]:
        final_status = "fail"
        try:
            if transport == "STDIO":
                pkg = (capability.extension_json or {}).get("package", {})
                zip_rel = pkg.get("path", "")
                zip_abs = str(get_settings().local_storage_dir.resolve() / zip_rel) if zip_rel else ""
                gen = run_stdio_mcp_test(start_command, start_args, zip_abs)
            else:
                if not server_url:
                    yield f"data: {json.dumps({'type': 'error', 'step': 0, 'message': 'serverUrl 未配置，且尚未完成 K8s 部署'})}\n\n"
                    yield f"data: {json.dumps({'type': 'done', 'status': 'fail'})}\n\n"
                    return
                pkg = (capability.extension_json or {}).get("package", {})
                zip_rel = pkg.get("path", "")
                zip_abs = str(get_settings().local_storage_dir.resolve() / zip_rel) if zip_rel else ""
                gen = run_http_mcp_test(server_url, capability.code, zip_abs)

            async for event in gen:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("type") == "done":
                    final_status = event.get("status", "fail")
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'step': -1, 'message': str(exc)})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'status': 'fail'})}\n\n"
            final_status = "fail"
        finally:
            ext = dict(capability.extension_json or {})
            ext["recent_test_status"] = "pass" if final_status == "pass" else "fail"
            if final_status == "pass" and capability.type == "mcp":
                allowed = {"deployed", "debug_failed"} if transport == "HTTP" else {"approved", "debug_failed"}
                if capability.status in allowed:
                    capability.status = "debug_passed"
                    capability.updated_by = actor.id
            capability.extension_json = ext
            db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/capabilities/{capability_id}", response_model=ApiResponse[DeleteResult])
def delete_capability(
    capability_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("capabilities.delete"))],
) -> ApiResponse[DeleteResult]:
    service.delete_capability(db, capability_id, actor)
    return success_response(request, DeleteResult(deleted=True))