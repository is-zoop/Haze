from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.rbac import ADMIN, SYSTEM_ADMIN
from app.modules.capabilities.models import Capability, CapabilityVersion
from app.modules.mcp_runtime import enums
from app.modules.mcp_runtime.models import McpCallLog, McpDeployment, McpDeployTask
from app.modules.mcp_runtime.schemas import (
    McpCallLogData,
    McpCallLogListData,
    McpDeploymentData,
    McpDeploymentListData,
    McpRuntimeCapabilityOption,
    McpRuntimeCapabilityOptionListData,
    McpDeployTaskData,
    McpDeployTaskListData,
    McpTaskCreated,
)
from app.modules.users.models import User

ADMIN_ROLES = {SYSTEM_ADMIN, ADMIN}

# 允许通过 operate 接口触发的任务类型
_OPERATE_TASK_TYPES = {enums.TASK_TYPE_START, enums.TASK_TYPE_STOP, enums.TASK_TYPE_RESTART}


def _is_admin(user: User) -> bool:
    """判断用户是否具备管理员角色。"""
    return any(role.code in ADMIN_ROLES for role in user.roles)


def _serialize_deployment(row: McpDeployment, capability: Capability | None, creator_name: str | None = None) -> McpDeploymentData:
    """将 ORM 对象转换为响应 Schema。"""
    return McpDeploymentData(
        id=row.id,
        capability_id=row.capability_id,
        capability_name=capability.name if capability else None,
        capability_code=capability.code if capability else None,
        capability_icon=f"/api/developer/capabilities/{capability.id}/icon" if capability and capability.icon else None,
        creator_name=creator_name,
        version_id=row.version_id,
        deployment_name=row.deployment_name,
        namespace=row.namespace,
        runtime_provider=row.runtime_provider,
        deploy_status=row.deploy_status,
        desired_status=row.desired_status,
        actual_status=row.actual_status,
        image_url=row.image_url,
        internal_service_name=row.internal_service_name,
        internal_url=row.internal_url,
        public_url=row.public_url,
        gateway_route=row.gateway_route,
        replicas=row.replicas,
        ready_replicas=row.ready_replicas,
        restart_count=row.restart_count,
        health_status=row.health_status,
        last_health_check_at=row.last_health_check_at,
        last_error=row.last_error,
        created_at=row.created_at,
        updated_at=row.updated_at,
        started_at=row.started_at,
        stopped_at=row.stopped_at,
    )


def _serialize_task(
    row: McpDeployTask, version: str | None = None, capability_name: str | None = None,
) -> McpDeployTaskData:
    """将任务 ORM 对象转换为响应 Schema。"""
    return McpDeployTaskData(
        id=row.id,
        capability_id=row.capability_id,
        capability_name=capability_name,
        version_id=row.version_id,
        version=version,
        task_type=row.task_type,
        task_status=row.task_status,
        runtime_provider=row.runtime_provider,
        logs=row.logs,
        error_message=row.error_message,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        started_at=row.started_at,
        finished_at=row.finished_at,
    )


def _get_deployment_or_404(db: Session, deployment_id: int, actor: User) -> McpDeployment:
    """查询部署实例，不存在或无权限均返回 404。"""
    row = db.get(McpDeployment, deployment_id)
    if row is None:
        raise AppException(code=4042, message="部署实例不存在", status_code=404)
    # 管理员可访问全部；普通用户只能访问自己创建的能力的实例
    if not _is_admin(actor):
        cap = db.get(Capability, row.capability_id)
        if cap is None or cap.created_by != actor.id:
            raise AppException(code=4042, message="部署实例不存在", status_code=404)
    return row


# ── 列表查询 ─────────────────────────────────────────────────────────────────

def list_deployments(
    db: Session,
    actor: User,
    *,
    page: int = 1,
    page_size: int = 10,
) -> McpDeploymentListData:
    """查询 MCP 运行实例列表，每个能力只返回最新一条部署记录，且排除已删除的能力。"""
    # 子查询1：每个 capability_id 取 id 最大的（最新）部署记录
    latest_subq = (
        select(func.max(McpDeployment.id).label("latest_id"))
        .group_by(McpDeployment.capability_id)
        .subquery()
    )
    # 子查询2：未删除的能力 id 集合（管理员和普通用户都过滤，避免展示已软删除能力的孤儿实例）
    active_cap_subq = (
        select(Capability.id).where(Capability.deleted_at.is_(None)).subquery()
    )
    stmt = (
        select(McpDeployment)
        .join(latest_subq, McpDeployment.id == latest_subq.c.latest_id)
        .where(McpDeployment.capability_id.in_(active_cap_subq))
    )
    if not _is_admin(actor):
        # 普通用户还需额外过滤：只显示自己创建的能力的实例
        my_cap_ids = db.scalars(
            select(Capability.id).where(
                Capability.created_by == actor.id,
                Capability.deleted_at.is_(None),
            )
        ).all()
        stmt = stmt.where(McpDeployment.capability_id.in_(my_cap_ids))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(McpDeployment.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    # 批量加载关联能力（active_cap_subq 已保证 cap 未删除）
    cap_ids = {r.capability_id for r in rows}
    cap_map: dict[int, Capability] = {}
    if cap_ids:
        caps = db.scalars(select(Capability).where(Capability.id.in_(cap_ids))).all()
        cap_map = {c.id: c for c in caps}

    creator_ids = {c.created_by for c in cap_map.values() if c.created_by}
    creator_map = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(creator_ids))).all()} if creator_ids else {}
    items = [_serialize_deployment(r, cap_map.get(r.capability_id), creator_map.get(cap_map[r.capability_id].created_by) if r.capability_id in cap_map else None) for r in rows]
    return McpDeploymentListData(items=items, total=total)


def get_deployment(db: Session, deployment_id: int, actor: User) -> McpDeploymentData:
    """查询单个 MCP 运行实例详情。"""
    row = _get_deployment_or_404(db, deployment_id, actor)
    cap = db.get(Capability, row.capability_id)
    creator = db.get(User, cap.created_by) if cap and cap.created_by else None
    return _serialize_deployment(row, cap, creator.name if creator else None)


def list_filter_capabilities(db: Session, actor: User) -> McpRuntimeCapabilityOptionListData:
    """返回当前用户可见、存在 MCP 部署记录的能力筛选选项。"""
    stmt = (
        select(Capability.id, Capability.name)
        .join(McpDeployment, McpDeployment.capability_id == Capability.id)
        .where(Capability.deleted_at.is_(None))
        .distinct()
        .order_by(Capability.name.asc())
    )
    if not _is_admin(actor):
        stmt = stmt.where(Capability.created_by == actor.id)
    return McpRuntimeCapabilityOptionListData(
        items=[McpRuntimeCapabilityOption(id=capability_id, name=name) for capability_id, name in db.execute(stmt).all()],
    )

def _record_date_bounds(start_at: date | None, end_at: date | None) -> tuple[datetime, datetime]:
    """返回本地自然日的左闭右开查询范围，未传时默认近七天。"""
    today = datetime.now().date()
    start_date = start_at or today - timedelta(days=6)
    end_date = end_at or today
    if end_date < start_date:
        raise AppException(code=4000, message="结束日期不能早于开始日期", status_code=400)
    return (
        datetime.combine(start_date, datetime.min.time()),
        datetime.combine(end_date + timedelta(days=1), datetime.min.time()),
    )


def _scoped_record_stmt(model, actor: User, *, capability_name: str | None, capability_ids: list[int] | None, start_at: date | None, end_at: date | None):
    """按既有运行监控权限、能力名称和日期范围过滤记录。"""
    start_time, end_time = _record_date_bounds(start_at, end_at)
    stmt = (
        select(model)
        .join(Capability, Capability.id == model.capability_id)
        .where(
            Capability.deleted_at.is_(None),
            model.created_at >= start_time,
            model.created_at < end_time,
        )
    )
    if not _is_admin(actor):
        stmt = stmt.where(Capability.created_by == actor.id)
    if capability_name and capability_name.strip():
        stmt = stmt.where(Capability.name.ilike(f"%{capability_name.strip()}%"))
    if capability_ids:
        stmt = stmt.where(Capability.id.in_(capability_ids))
    return stmt


def _capability_name_map(db: Session, capability_ids: set[int]) -> dict[int, str]:
    if not capability_ids:
        return {}
    return {
        capability.id: capability.name
        for capability in db.scalars(select(Capability).where(Capability.id.in_(capability_ids))).all()
    }

# ── 任务记录 ─────────────────────────────────────────────────────────────────

def list_tasks(
    db: Session,
    deployment_id: int,
    actor: User,
    *,
    page: int = 1,
    page_size: int = 20,
) -> McpDeployTaskListData:
    """兼容旧接口：查询单个部署实例所属能力的全部历史任务。"""
    row = _get_deployment_or_404(db, deployment_id, actor)
    capability = db.get(Capability, row.capability_id)
    stmt = select(McpDeployTask).where(McpDeployTask.capability_id == row.capability_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    tasks = db.scalars(
        stmt.order_by(McpDeployTask.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    version_ids = {task.version_id for task in tasks if task.version_id}
    versions = {
        version.id: version.version
        for version in db.scalars(select(CapabilityVersion).where(CapabilityVersion.id.in_(version_ids))).all()
    } if version_ids else {}
    return McpDeployTaskListData(
        items=[_serialize_task(task, versions.get(task.version_id), capability.name if capability else None) for task in tasks],
        total=total,
    )


def list_all_tasks(
    db: Session,
    actor: User,
    *,
    capability_name: str | None = None,
    capability_ids: list[int] | None = None,
    start_at: date | None = None,
    end_at: date | None = None,
    page: int = 1,
    page_size: int = 20,
) -> McpDeployTaskListData:
    """按能力名称和日期范围跨能力查询部署任务。"""
    stmt = _scoped_record_stmt(
        McpDeployTask, actor, capability_name=capability_name, capability_ids=capability_ids, start_at=start_at, end_at=end_at,
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    tasks = db.scalars(
        stmt.order_by(McpDeployTask.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    version_ids = {task.version_id for task in tasks if task.version_id}
    versions = {
        version.id: version.version
        for version in db.scalars(select(CapabilityVersion).where(CapabilityVersion.id.in_(version_ids))).all()
    } if version_ids else {}
    names = _capability_name_map(db, {task.capability_id for task in tasks})
    return McpDeployTaskListData(
        items=[_serialize_task(task, versions.get(task.version_id), names.get(task.capability_id)) for task in tasks],
        total=total,
    )

def get_logs(db: Session, deployment_id: int, actor: User) -> str:
    """获取最新一条 deploy 任务的执行日志，无日志时返回空字符串。"""
    row = _get_deployment_or_404(db, deployment_id, actor)

    latest_task = db.scalar(
        select(McpDeployTask)
        .where(McpDeployTask.capability_id == row.capability_id)
        .order_by(McpDeployTask.created_at.desc())
        .limit(1)
    )
    if latest_task is None or latest_task.logs is None:
        return ""
    return latest_task.logs



def _redact_debug_text(text: str) -> str:
    import re

    patterns = (
        r"(?i)(authorization\s*[:=]\s*bearer\s+)[^\s,;]+",
        r"(?i)(cookie\s*[:=]\s*)[^\r\n]+",
        r"(?i)((?:token|credential|password|secret)\s*[:=]\s*)[^\s,;]+",
    )
    for pattern in patterns:
        text = re.sub(pattern, r"\1***", text)
    return text


def get_debug_log(db: Session, deployment_id: int, actor: User) -> str:
    """导出当前部署任务的脱敏调试日志，不改变任务状态或原始部署流程。"""
    deployment = _get_deployment_or_404(db, deployment_id, actor)
    task = db.scalar(
        select(McpDeployTask)
        .where(McpDeployTask.capability_id == deployment.capability_id)
        .order_by(McpDeployTask.created_at.desc())
        .limit(1)
    )
    capability = db.get(Capability, deployment.capability_id)
    version = db.get(CapabilityVersion, task.version_id) if task and task.version_id else None
    task_logs = _redact_debug_text(task.logs or "") if task else ""
    raw_error = _redact_debug_text(task.error_message or "") if task else ""

    lines = [
        "MCP 部署调试日志",
        f"能力：{capability.name if capability else deployment.deployment_name}",
        f"版本：{version.version if version else '—'}",
        f"部署实例：{deployment.deployment_name}",
        f"任务类型：{task.task_type if task else '—'}",
        f"任务状态：{task.task_status if task else deployment.deploy_status}",
        f"创建时间：{task.created_at.isoformat(sep=' ', timespec='seconds') if task else '—'}",
        f"完成时间：{task.finished_at.isoformat(sep=' ', timespec='seconds') if task and task.finished_at else '—'}",
        "",
        "[调试日志]",
        task_logs or (f"[TASK_ERROR] {raw_error}" if raw_error else "暂无可导出的任务日志。"),
    ]
    return "\n".join(lines).strip() + "\n"

# ── 调用日志 ─────────────────────────────────────────────────────────────────

def _serialize_call(log: McpCallLog, caller_name: str | None, capability_name: str | None) -> McpCallLogData:
    return McpCallLogData(
        id=log.id,
        capability_id=log.capability_id,
        capability_name=capability_name,
        deployment_id=log.deployment_id,
        asset_code=log.asset_code,
        request_id=log.request_id,
        user_id=log.user_id,
        caller_name=caller_name,
        client_ip=log.client_ip,
        method=log.method,
        tool_name=log.tool_name,
        status_code=log.status_code,
        success=log.success,
        duration_ms=log.duration_ms,
        error_message=log.error_message,
        created_at=log.created_at,
    )


def _call_metrics(db: Session, stmt) -> tuple[int, int, float | None, int | None]:
    """计算当前查询范围内的调用聚合指标。"""
    rows = db.scalars(stmt).all()
    known_results = [row for row in rows if row.success is not None]
    durations = [row.duration_ms for row in rows if row.duration_ms is not None]
    success_rate = round(sum(row.success is True for row in known_results) / len(known_results) * 100, 1) if known_results else None
    avg_duration = round(sum(durations) / len(durations)) if durations else None
    return len(rows), sum(row.success is False for row in rows), success_rate, avg_duration


def list_calls(
    db: Session, deployment_id: int, actor: User, *, page: int = 1, page_size: int = 20,
) -> McpCallLogListData:
    """兼容旧接口：查询单个部署实例的 Gateway 调用日志。"""
    row = _get_deployment_or_404(db, deployment_id, actor)
    capability = db.get(Capability, row.capability_id)
    stmt = select(McpCallLog).where(McpCallLog.deployment_id == row.id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    logs = db.scalars(stmt.order_by(McpCallLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    user_ids = {log.user_id for log in logs if log.user_id}
    users = {user.id: user.name for user in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_total, today_errors, success_rate, avg_duration = _call_metrics(db, stmt.where(McpCallLog.created_at >= today_start))
    period_total, period_errors, _, _ = _call_metrics(db, stmt)
    available_methods = sorted({method for method in db.scalars(stmt.with_only_columns(McpCallLog.method).distinct()).all() if method})
    return McpCallLogListData(
        items=[_serialize_call(log, users.get(log.user_id), capability.name if capability else None) for log in logs],
        total=total,
        today_total=today_total,
        today_errors=today_errors,
        success_rate=success_rate,
        avg_duration_ms=avg_duration,
        period_total=period_total,
        period_errors=period_errors,
        available_methods=available_methods,
    )


def list_all_calls(
    db: Session,
    actor: User,
    *,
    capability_name: str | None = None,
    capability_ids: list[int] | None = None,
    start_at: date | None = None,
    end_at: date | None = None,
    methods: list[str] | None = None,
    page: int = 1,
    page_size: int = 20,
) -> McpCallLogListData:
    """按能力名称、日期和 MCP 方法跨能力查询调用日志。"""
    base_stmt = _scoped_record_stmt(
        McpCallLog, actor, capability_name=capability_name, capability_ids=capability_ids, start_at=start_at, end_at=end_at,
    )
    available_methods = sorted({method for method in db.scalars(base_stmt.with_only_columns(McpCallLog.method).distinct()).all() if method})
    stmt = base_stmt.where(McpCallLog.method.in_(methods)) if methods else base_stmt
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    logs = db.scalars(
        stmt.order_by(McpCallLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    user_ids = {log.user_id for log in logs if log.user_id}
    users = {user.id: user.name for user in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    names = _capability_name_map(db, {log.capability_id for log in logs})
    period_total, period_errors, success_rate, avg_duration = _call_metrics(db, stmt)
    return McpCallLogListData(
        items=[_serialize_call(log, users.get(log.user_id), names.get(log.capability_id)) for log in logs],
        total=total,
        today_total=period_total,
        today_errors=period_errors,
        success_rate=success_rate,
        avg_duration_ms=avg_duration,
        period_total=period_total,
        period_errors=period_errors,
        available_methods=available_methods,
    )

# ── 运行操作 ─────────────────────────────────────────────────────────────────

def create_operate_task(
    db: Session,
    deployment_id: int,
    actor: User,
    task_type: str,
) -> McpTaskCreated:
    """创建 start / stop / restart 任务。只写入任务记录，不直接操作 K8s。"""
    if task_type not in _OPERATE_TASK_TYPES:
        raise AppException(code=4000, message=f"不支持的操作类型: {task_type}", status_code=400)

    row = _get_deployment_or_404(db, deployment_id, actor)

    # 状态前置校验，避免重复操作
    if task_type == enums.TASK_TYPE_START and row.deploy_status == enums.DEPLOY_STATUS_RUNNING:
        raise AppException(code=4090, message="实例已在运行中，无需重复启动", status_code=409)
    if task_type == enums.TASK_TYPE_STOP and row.deploy_status == enums.DEPLOY_STATUS_STOPPED:
        raise AppException(code=4090, message="实例已停止，无需重复停止", status_code=409)

    task = McpDeployTask(
        capability_id=row.capability_id,
        version_id=row.version_id,
        task_type=task_type,
        task_status=enums.TASK_STATUS_PENDING,
        runtime_provider=enums.RUNTIME_PROVIDER_K8S,
        created_by=actor.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return McpTaskCreated(
        task_id=task.id,
        task_type=task.task_type,
        task_status=task.task_status,
    )


def sync_k8s_status(db: Session, actor: User) -> dict:
    """手动从 K8s 拉取副本状态并同步到 DB，返回 {"updated": <更新数量>}。

    权限与列表查询对齐：管理员同步所有实例，普通用户只同步自己的能力实例。
    Mock 模式（无 kubeconfig）下 provider.get_deployment_status 返回 None，更新数为 0。
    """
    from worker.config import get_worker_settings  # noqa: PLC0415
    from worker.kubernetes_provider import KubernetesRuntimeProvider  # noqa: PLC0415

    provider = KubernetesRuntimeProvider(get_worker_settings())

    stmt = select(McpDeployment).where(
        McpDeployment.deploy_status.in_([
            enums.DEPLOY_STATUS_RUNNING,
            enums.DEPLOY_STATUS_STOPPED,
            enums.DEPLOY_STATUS_DEPLOYING,
            enums.DEPLOY_STATUS_FAILED,
        ])
    )
    if not _is_admin(actor):
        my_cap_ids = db.scalars(
            select(Capability.id).where(
                Capability.created_by == actor.id,
                Capability.deleted_at.is_(None),
            )
        ).all()
        stmt = stmt.where(McpDeployment.capability_id.in_(my_cap_ids))

    deps = db.scalars(stmt).all()
    updated = 0
    for dep in deps:
        try:
            k8s = provider.get_deployment_status(dep.deployment_name, dep.namespace)
        except Exception:
            continue
        if k8s is None:
            continue
        ready: int = k8s["ready_replicas"]
        desired: int = k8s["replicas"]
        new_deploy: str = k8s["deploy_status"]
        new_actual = enums.ACTUAL_STATUS_RUNNING if ready > 0 else enums.ACTUAL_STATUS_STOPPED
        if (
            dep.deploy_status != new_deploy
            or dep.actual_status != new_actual
            or dep.ready_replicas != ready
            or dep.replicas != desired
        ):
            dep.deploy_status = new_deploy
            dep.actual_status = new_actual
            dep.ready_replicas = ready
            dep.replicas = desired
            updated += 1

    if updated:
        db.commit()

    return {"updated": updated}
