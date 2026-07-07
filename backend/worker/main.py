"""Deploy Worker — 轮询消费 mcp_deploy_tasks，独立于 Haze Backend 运行。

启动方式：在 backend/ 目录下执行 python -m worker.main
多实例并发安全：通过 SELECT FOR UPDATE SKIP LOCKED 保证同一任务只被一个 Worker 消费。
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.capabilities.models import Capability, CapabilityVersion
from app.modules.capabilities.storage import resolve_stored_file
from app.modules.mcp_runtime import enums
from app.modules.mcp_runtime.models import McpDeployment, McpDeployTask, McpGatewayRoute
from worker.config import get_worker_settings
from worker.image_builder import McpBuildError, build_image
from worker.kubernetes_provider import KubernetesRuntimeProvider

logger = logging.getLogger(__name__)


def _make_session_factory():
    """创建独立的 SQLAlchemy SessionFactory，不与 Haze Backend 共享 engine。"""
    settings = get_worker_settings()
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _claim_next_task(db: Session) -> McpDeployTask | None:
    """SELECT FOR UPDATE SKIP LOCKED 抢占一条 pending 任务并原子标记为 running。"""
    task = db.scalar(
        select(McpDeployTask)
        .where(McpDeployTask.task_status == enums.TASK_STATUS_PENDING)
        .order_by(McpDeployTask.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if task is None:
        return None
    task.task_status = enums.TASK_STATUS_RUNNING
    task.started_at = _now()
    db.commit()
    return task


def _get_mcp_config(db: Session, capability_id: int) -> tuple[int, str]:
    """从 capability.extension_json.config 读取 port 和 mcpEndpoint，不存在时用默认值。"""
    cap = db.get(Capability, capability_id)
    if cap is None:
        return 8000, "/mcp"
    cfg = ((cap.extension_json or {}).get("config") or {})
    return int(cfg.get("port", 8000)), str(cfg.get("mcpEndpoint", "/mcp"))


# ── 辅助：Gateway 路由同步 ─────────────────────────────────────────────────────

def _sync_gateway_route(db: Session, dep: McpDeployment, enabled: bool) -> None:
    """创建或更新 mcp_gateway_routes 中对应 deployment 的路由记录。

    deploy 成功时 enabled=True（创建路由）；stop 时 enabled=False；start 时 enabled=True。
    重试场景下记录可能已存在，对 target_url 和 enabled 做就地更新。
    """
    asset_code = dep.deployment_name.removeprefix("mcp-")

    route = db.scalar(
        select(McpGatewayRoute).where(McpGatewayRoute.deployment_id == dep.id)
    )
    if route is None:
        db.add(McpGatewayRoute(
            capability_id=dep.capability_id,
            deployment_id=dep.id,
            asset_code=asset_code,
            route_path=f"/assets/{asset_code}/mcp",
            target_url=dep.internal_url or "",
            enabled=enabled,
        ))
    else:
        # 重试/重部署时 internal_url 可能更新，保持路由指向最新 Service 地址
        route.target_url = dep.internal_url or route.target_url
        route.enabled = enabled


# ── handlers ──────────────────────────────────────────────────────────────────

def _handle_deploy(db: Session, task: McpDeployTask) -> None:
    """构建镜像 → 创建 K8s 资源 → 等待 Pod Ready → 推进 capability 到 deployed。"""
    dep = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == task.capability_id)
    )
    if dep is None:
        raise ValueError(f"未找到 capability_id={task.capability_id} 对应的 deployment 记录")

    settings = get_worker_settings()
    provider = KubernetesRuntimeProvider(settings)
    port, endpoint = _get_mcp_config(db, task.capability_id)

    # ── 阶段 1：构建镜像 ────────────────────────────────────────────────────────
    dep.deploy_status = enums.DEPLOY_STATUS_BUILDING
    db.commit()

    version = db.get(CapabilityVersion, task.version_id) if task.version_id else None
    if version is None:
        raise McpBuildError("部署任务未关联版本记录，无法获取 ZIP 包路径")

    expected_image_url = (
        f"{settings.registry_url}/{settings.registry_project}/"
        f"{dep.deployment_name}:{version.version}-r{version.id}"
    )
    image_url = expected_image_url
    if dep.image_url != expected_image_url:
        # 每条版本记录使用唯一镜像标签；版本变化时必须从对应快照重新构建。
        snap_ext = (version.snapshot_json or {}).get("extension_json", {})
        zip_rel = (snap_ext.get("package") or {}).get("path")
        if not zip_rel:
            raise McpBuildError("版本快照中未找到 ZIP 包路径，请重新提交版本")
        zip_abs = resolve_stored_file(zip_rel)
        build_image(zip_abs, image_url, settings)
        dep.image_url = image_url

    # ── 阶段 2：K8s 部署 ────────────────────────────────────────────────────────
    dep.deploy_status = enums.DEPLOY_STATUS_DEPLOYING
    db.commit()

    _, svc_name, internal_url = provider.deploy(dep, port, endpoint)
    dep.internal_service_name = svc_name
    dep.internal_url = internal_url

    ready = provider.wait_for_ready(dep, settings.pod_ready_timeout_seconds)
    if not ready:
        raise RuntimeError(
            f"Pod {dep.deployment_name} 在 {settings.pod_ready_timeout_seconds}s 内未就绪，"
            "请检查镜像是否存在及容器启动日志"
        )

    dep.deploy_status = enums.DEPLOY_STATUS_RUNNING
    dep.actual_status = enums.ACTUAL_STATUS_RUNNING
    dep.ready_replicas = 1
    dep.health_status = enums.HEALTH_STATUS_HEALTHY
    dep.started_at = _now()

    cap = db.get(Capability, task.capability_id)
    if cap:
        cap.status = "deployed"

    # 同步 Gateway 路由，internal_url 已由 provider.deploy 写入 dep
    asset_code = dep.deployment_name.removeprefix("mcp-")
    dep.gateway_route = f"/assets/{asset_code}/mcp"
    dep.public_url = f"{settings.gateway_public_base_url.rstrip('/')}/assets/{asset_code}/mcp"
    _sync_gateway_route(db, dep, enabled=True)

    task.logs = (
        f"镜像已构建并推送：{image_url}\n"
        f"K8s Deployment/{svc_name} 已创建\n"
        f"K8s Service/{svc_name} 已创建\n"
        f"K8s NetworkPolicy/{svc_name}-netpol 已创建\n"
        f"Pod Ready\n"
        f"部署成功，internal_url={internal_url}\n"
        f"Gateway 路由已创建：/assets/{asset_code}/mcp → {internal_url}\n"
        f"公开访问地址：{dep.public_url}"
    )


def _handle_start(db: Session, task: McpDeployTask) -> None:
    """将 K8s Deployment replicas 设为 1，恢复停止的服务。"""
    dep = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == task.capability_id)
    )
    if dep is None:
        raise ValueError(f"未找到 capability_id={task.capability_id} 的 deployment 记录")

    provider = KubernetesRuntimeProvider(get_worker_settings())
    provider.start(dep)
    dep.deploy_status = enums.DEPLOY_STATUS_RUNNING
    dep.actual_status = enums.ACTUAL_STATUS_RUNNING
    dep.desired_status = enums.DESIRED_STATUS_RUNNING
    dep.replicas = 1
    dep.ready_replicas = 1
    dep.started_at = _now()
    # 启动成功后恢复 Gateway 路由，调用方恢复正常转发
    _sync_gateway_route(db, dep, enabled=True)
    task.logs = f"K8s Deployment/{dep.deployment_name} replicas 已设为 1"


def _handle_stop(db: Session, task: McpDeployTask) -> None:
    """将 K8s Deployment replicas 设为 0，停止服务（保留资源）。"""
    dep = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == task.capability_id)
    )
    if dep is None:
        raise ValueError(f"未找到 capability_id={task.capability_id} 的 deployment 记录")

    provider = KubernetesRuntimeProvider(get_worker_settings())
    provider.stop(dep)
    dep.deploy_status = enums.DEPLOY_STATUS_STOPPED
    dep.actual_status = enums.ACTUAL_STATUS_STOPPED
    dep.desired_status = enums.DESIRED_STATUS_STOPPED
    dep.replicas = 0
    dep.ready_replicas = 0
    dep.stopped_at = _now()
    # 停止服务后关闭 Gateway 路由，调用方立刻收到 503
    _sync_gateway_route(db, dep, enabled=False)
    task.logs = f"K8s Deployment/{dep.deployment_name} replicas 已设为 0"


def _handle_delete(db: Session, task: McpDeployTask) -> None:
    """Delete K8s resources for a deployment and disable its Gateway route."""
    dep = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == task.capability_id)
    )
    if dep is None:
        task.logs = f"No deployment found for capability_id={task.capability_id}; nothing to delete"
        return

    provider = KubernetesRuntimeProvider(get_worker_settings())
    provider.delete(dep)
    dep.deploy_status = enums.DEPLOY_STATUS_STOPPED
    dep.actual_status = enums.ACTUAL_STATUS_STOPPED
    dep.desired_status = enums.DESIRED_STATUS_STOPPED
    dep.replicas = 0
    dep.ready_replicas = 0
    dep.stopped_at = _now()
    _sync_gateway_route(db, dep, enabled=False)
    task.logs = f"K8s resources for Deployment/{dep.deployment_name} deleted"


def _handle_restart(db: Session, task: McpDeployTask) -> None:
    """更新 Pod annotation 触发 K8s 滚动重启。"""
    dep = db.scalar(
        select(McpDeployment).where(McpDeployment.capability_id == task.capability_id)
    )
    if dep is None:
        raise ValueError(f"未找到 capability_id={task.capability_id} 的 deployment 记录")

    provider = KubernetesRuntimeProvider(get_worker_settings())
    provider.restart(dep)
    dep.restart_count = (dep.restart_count or 0) + 1
    task.logs = f"K8s Deployment/{dep.deployment_name} 滚动重启已触发"


def _sync_k8s_status(db: Session, provider: KubernetesRuntimeProvider) -> None:
    """将 K8s 实际副本状态同步到 DB，弥补 Worker 无法感知 K8s 外部变化的问题。

    同步 running / stopped / deploying / failed 状态的实例，覆盖 Pod 已就绪但 DB 仍停在
    deploying 的场景（任务流程正常结束时会更新，但超时或进程重启可能导致遗漏）。
    """
    deps = db.scalars(
        select(McpDeployment).where(
            McpDeployment.deploy_status.in_([
                enums.DEPLOY_STATUS_RUNNING,
                enums.DEPLOY_STATUS_STOPPED,
                enums.DEPLOY_STATUS_DEPLOYING,  # Pod 已就绪但 DB 仍停留在部署中
                enums.DEPLOY_STATUS_FAILED,     # 短暂失败后 Pod 可能已恢复
            ])
        )
    ).all()

    updated = 0
    for dep in deps:
        try:
            k8s = provider.get_deployment_status(dep.deployment_name, dep.namespace)
        except Exception as exc:
            logger.warning("查询 K8s 状态失败 deployment=%s: %s", dep.deployment_name, exc)
            continue

        if k8s is None:
            continue  # Mock 模式或资源不存在，跳过

        ready: int = k8s["ready_replicas"]
        desired: int = k8s["replicas"]
        new_deploy: str = k8s["deploy_status"]
        new_actual = enums.ACTUAL_STATUS_RUNNING if ready > 0 else enums.ACTUAL_STATUS_STOPPED

        changed = (
            dep.deploy_status != new_deploy
            or dep.actual_status != new_actual
            or dep.ready_replicas != ready
            or dep.replicas != desired
        )
        if changed:
            dep.deploy_status = new_deploy
            dep.actual_status = new_actual
            dep.ready_replicas = ready
            dep.replicas = desired
            updated += 1

    if updated:
        db.commit()
        logger.info("K8s 状态同步：%d 个实例已更新", updated)


_HANDLERS = {
    enums.TASK_TYPE_DEPLOY:   _handle_deploy,
    enums.TASK_TYPE_REDEPLOY: _handle_deploy,
    enums.TASK_TYPE_START:    _handle_start,
    enums.TASK_TYPE_STOP:     _handle_stop,
    enums.TASK_TYPE_DELETE:   _handle_delete,
    enums.TASK_TYPE_RESTART:  _handle_restart,
}


def _process_task(db: Session, task: McpDeployTask) -> None:
    """执行任务，成功/失败都回写状态。"""
    now = _now()
    # 在 handler 可能抛异常前先保存标量，避免 rollback 后对象 expire 导致二次查询失败
    task_id = task.id
    capability_id = task.capability_id
    task_type = task.task_type
    handler = _HANDLERS.get(task_type)

    try:
        if handler is None:
            raise ValueError(f"未知任务类型: {task_type}")
        handler(db, task)
        task.task_status = enums.TASK_STATUS_SUCCESS
        task.finished_at = now
        db.commit()
        logger.info("任务 %d (%s) 执行成功", task_id, task_type)
    except Exception as exc:
        logger.exception("任务 %d (%s) 执行失败", task_id, task_type)
        try:
            db.rollback()
        except Exception:
            pass
        try:
            # rollback 后对象已 expire，通过 PK 重新加载以获取 running 状态
            task = db.get(McpDeployTask, task_id)
            if task:
                task.task_status = enums.TASK_STATUS_FAILED
                task.error_message = str(exc)
                task.finished_at = now
            dep = db.scalar(
                select(McpDeployment).where(
                    McpDeployment.capability_id == capability_id
                )
            )
            if dep:
                dep.deploy_status = enums.DEPLOY_STATUS_FAILED
                dep.last_error = str(exc)
            db.commit()
        except Exception:
            logger.exception(
                "回写失败状态时出错，任务 %d 可能滞留 running 状态", task_id
            )


_K8S_SYNC_INTERVAL = 30  # 每 30 秒同步一次 K8s 实际状态


def run_worker() -> None:
    """Worker 主循环，阻塞运行直到进程退出。"""
    settings = get_worker_settings()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logger.info("Deploy Worker 启动，轮询间隔 %ds，K8s 状态同步间隔 %ds",
                settings.poll_interval_seconds, _K8S_SYNC_INTERVAL)

    SessionFactory = _make_session_factory()
    # 提前创建 provider，避免每次循环重新加载 kubeconfig
    sync_provider = KubernetesRuntimeProvider(settings)
    last_k8s_sync = 0.0

    while True:
        task_claimed = False
        try:
            with SessionFactory() as db:
                task = _claim_next_task(db)
                if task:
                    task_claimed = True
                    _process_task(db, task)

                # 周期性 K8s → DB 状态同步（与任务处理共用同一 db session）
                now = time.monotonic()
                if now - last_k8s_sync >= _K8S_SYNC_INTERVAL:
                    try:
                        _sync_k8s_status(db, sync_provider)
                    except Exception:
                        logger.exception("K8s 状态同步失败，跳过本次同步")
                    last_k8s_sync = now
        except Exception:
            logger.exception("Worker 主循环异常，等待重试")

        if not task_claimed:
            time.sleep(settings.poll_interval_seconds)


if __name__ == "__main__":
    run_worker()
