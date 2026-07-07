from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.mcp_runtime import enums

# BigInt 主键，兼容 SQLite（测试用）和 PostgreSQL / MySQL（生产用）
BIGINT_PK = BigInteger().with_variant(Integer, "sqlite")


class McpDeployTask(Base):
    """MCP 部署任务表，记录每次部署/启动/停止/重启操作。

    Backend 只创建任务，Deploy Worker 消费任务。
    多 Worker 实例消费时通过 SELECT FOR UPDATE SKIP LOCKED 防止重复执行。
    """

    __tablename__ = "mcp_deploy_tasks"
    __table_args__ = (
        {"comment": "MCP 部署任务表，Backend 创建、Deploy Worker 消费"},
    )

    id: Mapped[int] = mapped_column(
        BIGINT_PK, primary_key=True, autoincrement=True, comment="任务ID"
    )
    capability_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("capabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联能力ID",
    )
    version_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("capability_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="关联版本ID，构建镜像时从对应版本快照读取源码包",
    )
    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment=f"任务类型：{enums.TASK_TYPE_DEPLOY}/{enums.TASK_TYPE_START}/{enums.TASK_TYPE_STOP}/"
                f"{enums.TASK_TYPE_RESTART}/{enums.TASK_TYPE_REDEPLOY}/{enums.TASK_TYPE_ROLLBACK}",
    )
    task_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=enums.TASK_STATUS_PENDING,
        server_default=enums.TASK_STATUS_PENDING,
        index=True,
        comment=f"任务状态：{enums.TASK_STATUS_PENDING}/{enums.TASK_STATUS_RUNNING}/"
                f"{enums.TASK_STATUS_SUCCESS}/{enums.TASK_STATUS_FAILED}",
    )
    runtime_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=enums.RUNTIME_PROVIDER_K8S,
        server_default=enums.RUNTIME_PROVIDER_K8S,
        comment=f"运行时提供商，当前固定为 {enums.RUNTIME_PROVIDER_K8S}",
    )
    logs: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="任务执行日志，Worker 追写"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="失败时的错误信息"
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="任务创建人用户ID，审核自动触发时为 null",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="Worker 开始执行时间"
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="Worker 执行完成时间（成功或失败）"
    )


class McpDeployment(Base):
    """MCP 运行实例表，记录每个托管 MCP 在 K8s 上的部署状态。

    第一版每个 capability 只维护一个活跃 deployment（capability_id 唯一约束）。
    public_url 格式：https://gateway.haze.io/assets/{code}/mcp
    """

    __tablename__ = "mcp_deployments"
    __table_args__ = (
        UniqueConstraint("capability_id", name="uq_mcp_deployments_capability_id"),
        {"comment": "MCP 运行实例表，记录 K8s 部署状态与访问地址"},
    )

    id: Mapped[int] = mapped_column(
        BIGINT_PK, primary_key=True, autoincrement=True, comment="部署实例ID"
    )
    capability_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("capabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联能力ID，每个能力同时只有一个活跃实例",
    )
    version_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("capability_versions.id", ondelete="SET NULL"),
        nullable=True,
        comment="当前部署的版本ID",
    )
    deployment_name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="K8s Deployment 名称，格式：mcp-{code}"
    )
    namespace: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="haze-runtime",
        server_default="haze-runtime",
        comment="K8s Namespace，MCP Server 统一运行在 haze-runtime",
    )
    runtime_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=enums.RUNTIME_PROVIDER_K8S,
        server_default=enums.RUNTIME_PROVIDER_K8S,
        comment="运行时提供商",
    )
    deploy_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=enums.DEPLOY_STATUS_PENDING,
        server_default=enums.DEPLOY_STATUS_PENDING,
        index=True,
        comment="部署综合状态：pending/building/deploying/running/failed/stopped",
    )
    desired_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=enums.DESIRED_STATUS_RUNNING,
        server_default=enums.DESIRED_STATUS_RUNNING,
        comment="用户期望状态：running/stopped",
    )
    actual_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=enums.ACTUAL_STATUS_PENDING,
        server_default=enums.ACTUAL_STATUS_PENDING,
        comment="K8s Pod 实际状态：pending/running/failed/stopped",
    )
    image_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="构建完成的镜像地址，含 tag"
    )
    internal_service_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="K8s Service 名称，格式：mcp-{code}"
    )
    internal_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="K8s 集群内部访问地址，格式：http://mcp-{code}.haze-runtime.svc.cluster.local:{port}{endpoint}",
    )
    public_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Gateway 对外暴露的访问地址，格式：https://gateway.haze.io/assets/{code}/mcp",
    )
    gateway_route: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="Gateway 路由路径，格式：/assets/{code}/mcp"
    )
    replicas: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1", comment="期望副本数"
    )
    ready_replicas: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="就绪副本数，由 Worker 同步更新"
    )
    restart_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="Pod 重启次数"
    )
    health_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=enums.HEALTH_STATUS_UNKNOWN,
        server_default=enums.HEALTH_STATUS_UNKNOWN,
        comment="健康检查状态：unknown/healthy/unhealthy",
    )
    last_health_check_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="最近一次健康检查时间"
    )
    last_error: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="最近一次错误信息"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="最近一次启动时间"
    )
    stopped_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="最近一次停止时间"
    )


class McpGatewayRoute(Base):
    """MCP Gateway 路由表，记录 asset_code 到 K8s 内部服务的转发规则。

    Gateway 启动时读取此表构建路由缓存，stop 时将 enabled 置为 False。
    """

    __tablename__ = "mcp_gateway_routes"
    __table_args__ = (
        {"comment": "MCP Gateway 路由表，asset_code → 内部服务地址的映射"},
    )

    id: Mapped[int] = mapped_column(
        BIGINT_PK, primary_key=True, autoincrement=True, comment="路由ID"
    )
    capability_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("capabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联能力ID",
    )
    deployment_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("mcp_deployments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联部署实例ID",
    )
    asset_code: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="能力编码，Gateway 路由匹配的主键，如 sales-query",
    )
    route_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Gateway 路由路径，格式：/assets/{code}/mcp",
    )
    target_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="转发目标地址，K8s Service 内部地址，如 http://mcp-sales-query.haze-runtime.svc.cluster.local:8000/mcp",
    )
    rate_limit: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="每分钟请求数上限，null 表示不限流（第一版暂不启用）"
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="路由是否启用，stop 时置为 False，start 后恢复 True",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )


class McpCallLog(Base):
    """MCP Gateway 调用日志表，记录每次通过 Gateway 的 MCP 工具调用。

    只追加不更新，无 updated_at。
    v1 中 user_id 为 null，后续通过 API Key 机制填充。
    """

    __tablename__ = "mcp_call_logs"
    __table_args__ = (
        {"comment": "MCP Gateway 调用日志表，由 Gateway 服务写入"},
    )

    id: Mapped[int] = mapped_column(
        BIGINT_PK, primary_key=True, autoincrement=True, comment="日志ID"
    )
    capability_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("capabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联能力ID",
    )
    deployment_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("mcp_deployments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="关联部署实例ID",
    )
    asset_code: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="能力编码，冗余存储便于查询"
    )
    request_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="请求唯一ID，来自 X-Request-ID Header"
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="调用方用户ID，v1 为 null，后续通过 API Key → user 映射填充",
    )
    client_ip: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="调用方 IP 地址"
    )
    method: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="MCP JSON-RPC method，如 tools/call"
    )
    tool_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="调用的工具名称，从 tools/call 参数解析，v1 可为 null"
    )
    status_code: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="HTTP 响应状态码"
    )
    success: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, comment="调用是否成功"
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="请求耗时（毫秒）"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="错误信息"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        index=True,
        comment="调用时间，用于按时间范围查询调用记录",
    )
