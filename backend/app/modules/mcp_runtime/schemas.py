from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ── 部署任务 ─────────────────────────────────────────────────────────────────

class McpDeployTaskData(StrictModel):
    """单条部署任务的响应数据。"""

    id: int
    """任务ID"""
    capability_id: int
    """关联能力ID"""
    version_id: int | None
    """关联版本ID，首次 deploy 时关联当前最新版本"""
    version: str | None
    """关联版本号"""
    task_type: str
    """任务类型：deploy/start/stop/restart/redeploy/rollback"""
    task_status: str
    """任务状态：pending/running/success/failed"""
    runtime_provider: str
    """运行时提供商，当前固定为 kubernetes"""
    logs: str | None
    """任务执行日志，Worker 追写"""
    error_message: str | None
    """失败时的错误信息"""
    created_by: int | None
    """任务创建人用户ID"""
    created_at: datetime
    """创建时间"""
    updated_at: datetime
    """更新时间"""
    started_at: datetime | None
    """Worker 开始执行时间"""
    finished_at: datetime | None
    """Worker 执行完成时间"""


class McpDeployTaskListData(StrictModel):
    """部署任务列表的响应数据。"""

    items: list[McpDeployTaskData]
    total: int


# ── 运行实例 ─────────────────────────────────────────────────────────────────

class McpDeploymentData(StrictModel):
    """单个 MCP 运行实例的响应数据，包含关联能力信息。"""

    id: int
    """部署实例ID"""
    capability_id: int
    """关联能力ID"""
    capability_name: str | None
    """能力名称（join 自 capabilities 表）"""
    capability_code: str | None
    """能力编码（join 自 capabilities 表）"""
    capability_icon: str | None
    """能力图标访问地址（join 自 capabilities 表）"""
    creator_name: str | None
    """能力创建人姓名"""
    version_id: int | None
    """当前部署的版本ID"""
    deployment_name: str
    """K8s Deployment 名称，格式：mcp-{code}"""
    namespace: str
    """K8s Namespace"""
    runtime_provider: str
    """运行时提供商"""
    deploy_status: str
    """部署综合状态：pending/building/deploying/running/failed/stopped"""
    desired_status: str
    """用户期望状态：running/stopped"""
    actual_status: str
    """K8s Pod 实际状态：pending/running/failed/stopped"""
    image_url: str | None
    """构建完成的镜像地址"""
    internal_service_name: str | None
    """K8s Service 名称"""
    internal_url: str | None
    """K8s 集群内部访问地址"""
    public_url: str | None
    """Gateway 对外暴露地址，格式：https://gateway.haze.io/assets/{code}/mcp"""
    gateway_route: str | None
    """Gateway 路由路径"""
    replicas: int
    """期望副本数"""
    ready_replicas: int
    """就绪副本数"""
    restart_count: int
    """Pod 重启次数"""
    health_status: str
    """健康检查状态：unknown/healthy/unhealthy"""
    last_health_check_at: datetime | None
    """最近一次健康检查时间"""
    last_error: str | None
    """最近一次错误信息"""
    created_at: datetime
    """创建时间"""
    updated_at: datetime
    """更新时间"""
    started_at: datetime | None
    """最近一次启动时间"""
    stopped_at: datetime | None
    """最近一次停止时间"""


class McpDeploymentListData(StrictModel):
    """运行实例列表的响应数据。"""

    items: list[McpDeploymentData]
    total: int


# ── 调用日志 ─────────────────────────────────────────────────────────────────

class McpCallLogData(StrictModel):
    """单条 Gateway 调用日志的响应数据。"""

    id: int
    """日志ID"""
    capability_id: int
    """关联能力ID"""
    deployment_id: int | None
    """关联部署实例ID"""
    asset_code: str
    """能力编码"""
    request_id: str | None
    """请求唯一ID"""
    user_id: int | None
    """调用方用户ID"""
    caller_name: str | None
    """调用方用户姓名"""
    client_ip: str | None
    """调用方 IP 地址"""
    method: str | None
    """MCP JSON-RPC method"""
    tool_name: str | None
    """调用的工具名称"""
    status_code: int | None
    """HTTP 响应状态码"""
    success: bool | None
    """调用是否成功"""
    duration_ms: int | None
    """请求耗时（毫秒）"""
    error_message: str | None
    """错误信息"""
    created_at: datetime
    """调用时间"""


class McpCallLogListData(StrictModel):
    """调用日志列表及今日聚合指标。"""

    items: list[McpCallLogData]
    total: int
    today_total: int
    today_errors: int
    success_rate: float | None
    avg_duration_ms: int | None


# ── 操作任务创建结果 ─────────────────────────────────────────────────────────

class McpTaskCreated(StrictModel):
    """start / stop / restart 接口创建任务后的响应数据。"""

    task_id: int
    """新建任务ID，前端可轮询此 ID 查询任务状态"""
    task_type: str
    """任务类型：start/stop/restart"""
    task_status: str
    """初始状态，固定为 pending"""
