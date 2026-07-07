from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.response import ApiResponse, success_response
from app.core.security import require_capabilities
from app.db.session import get_db
from app.modules.mcp_runtime import service
from app.modules.mcp_runtime.schemas import (
    McpCallLogListData,
    McpDeploymentData,
    McpDeploymentListData,
    McpDeployTaskListData,
    McpTaskCreated,
)
from app.modules.users.models import User

router = APIRouter(prefix="/api/mcp-runtime", tags=["mcp runtime"])


@router.get("/deployments", response_model=ApiResponse[McpDeploymentListData])
def list_deployments(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.read"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
) -> ApiResponse[McpDeploymentListData]:
    """查询 MCP 运行实例列表。管理员可查全部，普通用户只查自己的能力实例。"""
    return success_response(
        request,
        service.list_deployments(db, actor, page=page, page_size=page_size),
    )


@router.get("/deployments/{deployment_id}", response_model=ApiResponse[McpDeploymentData])
def get_deployment(
    deployment_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.read"))],
) -> ApiResponse[McpDeploymentData]:
    """查询单个 MCP 运行实例详情。"""
    return success_response(request, service.get_deployment(db, deployment_id, actor))


@router.get("/deployments/{deployment_id}/tasks", response_model=ApiResponse[McpDeployTaskListData])
def list_tasks(
    deployment_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.read"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ApiResponse[McpDeployTaskListData]:
    """查询部署实例的历史任务列表，按创建时间倒序。"""
    return success_response(
        request,
        service.list_tasks(db, deployment_id, actor, page=page, page_size=page_size),
    )


@router.get("/deployments/{deployment_id}/logs", response_class=PlainTextResponse)
def get_logs(
    deployment_id: int,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.read"))],
) -> str:
    """获取部署实例最新任务的执行日志，返回纯文本。"""
    return service.get_logs(db, deployment_id, actor)


@router.get("/deployments/{deployment_id}/calls", response_model=ApiResponse[McpCallLogListData])
def list_calls(
    deployment_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.read"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ApiResponse[McpCallLogListData]:
    """查询部署实例的 Gateway 调用日志，按调用时间倒序。"""
    return success_response(
        request,
        service.list_calls(db, deployment_id, actor, page=page, page_size=page_size),
    )


@router.post("/deployments/{deployment_id}/start", response_model=ApiResponse[McpTaskCreated])
def start_deployment(
    deployment_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.operate"))],
) -> ApiResponse[McpTaskCreated]:
    """创建 start 任务（replicas 从 0 改为 1），由 Deploy Worker 异步执行。"""
    return success_response(
        request,
        service.create_operate_task(db, deployment_id, actor, "start"),
    )


@router.post("/deployments/{deployment_id}/stop", response_model=ApiResponse[McpTaskCreated])
def stop_deployment(
    deployment_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.operate"))],
) -> ApiResponse[McpTaskCreated]:
    """创建 stop 任务（replicas 改为 0），由 Deploy Worker 异步执行。"""
    return success_response(
        request,
        service.create_operate_task(db, deployment_id, actor, "stop"),
    )


@router.post("/sync-status")
def sync_status(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.read"))],
) -> ApiResponse[dict]:
    """手动触发 K8s → DB 状态同步，立即返回更新实例数量。"""
    return success_response(request, service.sync_k8s_status(db, actor))


@router.post("/deployments/{deployment_id}/restart", response_model=ApiResponse[McpTaskCreated])
def restart_deployment(
    deployment_id: int,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_capabilities("mcp_runtime.operate"))],
) -> ApiResponse[McpTaskCreated]:
    """创建 restart 任务（触发 Pod 滚动重启），由 Deploy Worker 异步执行。"""
    return success_response(
        request,
        service.create_operate_task(db, deployment_id, actor, "restart"),
    )
