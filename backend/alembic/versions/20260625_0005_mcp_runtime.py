"""mcp_runtime: 新增 MCP 托管部署相关表

新增 4 张表：
  - mcp_deploy_tasks    部署任务表
  - mcp_deployments     运行实例表
  - mcp_gateway_routes  Gateway 路由表
  - mcp_call_logs       调用日志表

Revision ID: 20260625_0005
Revises: 20260624_0004
Create Date: 2026-06-25
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260625_0005"
down_revision = "20260624_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── mcp_deploy_tasks ────────────────────────────────────────────────────
    # Backend 创建、Deploy Worker 消费，多 Worker 实例通过行锁防重复执行
    op.create_table(
        "mcp_deploy_tasks",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="任务ID"),
        sa.Column("capability_id", sa.BigInteger(), nullable=False, comment="关联能力ID"),
        sa.Column("version_id", sa.BigInteger(), nullable=True, comment="关联版本ID"),
        sa.Column("task_type", sa.String(50), nullable=False, comment="任务类型：deploy/start/stop/restart/redeploy/rollback"),
        sa.Column("task_status", sa.String(20), nullable=False, server_default="pending", comment="任务状态：pending/running/success/failed"),
        sa.Column("runtime_provider", sa.String(50), nullable=False, server_default="kubernetes", comment="运行时提供商"),
        sa.Column("logs", sa.Text(), nullable=True, comment="任务执行日志"),
        sa.Column("error_message", sa.Text(), nullable=True, comment="失败时的错误信息"),
        sa.Column("created_by", sa.Integer(), nullable=True, comment="任务创建人用户ID，审核自动触发时为 null"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="创建时间"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="更新时间"),
        sa.Column("started_at", sa.DateTime(), nullable=True, comment="Worker 开始执行时间"),
        sa.Column("finished_at", sa.DateTime(), nullable=True, comment="Worker 执行完成时间"),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["capability_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        comment="MCP 部署任务表，Backend 创建、Deploy Worker 消费",
    )
    op.create_index("ix_mcp_deploy_tasks_capability_id", "mcp_deploy_tasks", ["capability_id"])
    op.create_index("ix_mcp_deploy_tasks_task_status", "mcp_deploy_tasks", ["task_status"])

    # ── mcp_deployments ─────────────────────────────────────────────────────
    # 每个能力同时只有一个活跃实例（capability_id 唯一约束）
    op.create_table(
        "mcp_deployments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="部署实例ID"),
        sa.Column("capability_id", sa.BigInteger(), nullable=False, comment="关联能力ID，每个能力同时只有一个活跃实例"),
        sa.Column("version_id", sa.BigInteger(), nullable=True, comment="当前部署的版本ID"),
        sa.Column("deployment_name", sa.String(200), nullable=False, comment="K8s Deployment 名称，格式：mcp-{code}"),
        sa.Column("namespace", sa.String(100), nullable=False, server_default="haze-runtime", comment="K8s Namespace"),
        sa.Column("runtime_provider", sa.String(50), nullable=False, server_default="kubernetes", comment="运行时提供商"),
        sa.Column("deploy_status", sa.String(30), nullable=False, server_default="pending", comment="部署综合状态：pending/building/deploying/running/failed/stopped"),
        sa.Column("desired_status", sa.String(20), nullable=False, server_default="running", comment="用户期望状态：running/stopped"),
        sa.Column("actual_status", sa.String(20), nullable=False, server_default="pending", comment="K8s Pod 实际状态：pending/running/failed/stopped"),
        sa.Column("image_url", sa.String(500), nullable=True, comment="构建完成的镜像地址，含 tag"),
        sa.Column("internal_service_name", sa.String(200), nullable=True, comment="K8s Service 名称，格式：mcp-{code}"),
        sa.Column("internal_url", sa.String(500), nullable=True, comment="K8s 集群内部访问地址"),
        sa.Column("public_url", sa.String(500), nullable=True, comment="Gateway 对外暴露地址，格式：https://gateway.haze.io/assets/{code}/mcp"),
        sa.Column("gateway_route", sa.String(500), nullable=True, comment="Gateway 路由路径，格式：/assets/{code}/mcp"),
        sa.Column("replicas", sa.Integer(), nullable=False, server_default="1", comment="期望副本数"),
        sa.Column("ready_replicas", sa.Integer(), nullable=False, server_default="0", comment="就绪副本数"),
        sa.Column("restart_count", sa.Integer(), nullable=False, server_default="0", comment="Pod 重启次数"),
        sa.Column("health_status", sa.String(20), nullable=False, server_default="unknown", comment="健康检查状态：unknown/healthy/unhealthy"),
        sa.Column("last_health_check_at", sa.DateTime(), nullable=True, comment="最近一次健康检查时间"),
        sa.Column("last_error", sa.Text(), nullable=True, comment="最近一次错误信息"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="创建时间"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="更新时间"),
        sa.Column("started_at", sa.DateTime(), nullable=True, comment="最近一次启动时间"),
        sa.Column("stopped_at", sa.DateTime(), nullable=True, comment="最近一次停止时间"),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["capability_versions.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("capability_id", name="uq_mcp_deployments_capability_id"),
        sa.PrimaryKeyConstraint("id"),
        comment="MCP 运行实例表，记录 K8s 部署状态与访问地址",
    )
    op.create_index("ix_mcp_deployments_capability_id", "mcp_deployments", ["capability_id"])
    op.create_index("ix_mcp_deployments_deploy_status", "mcp_deployments", ["deploy_status"])

    # ── mcp_gateway_routes ──────────────────────────────────────────────────
    # asset_code → 内部服务地址的映射，Gateway 按此表做请求转发
    op.create_table(
        "mcp_gateway_routes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="路由ID"),
        sa.Column("capability_id", sa.BigInteger(), nullable=False, comment="关联能力ID"),
        sa.Column("deployment_id", sa.BigInteger(), nullable=False, comment="关联部署实例ID"),
        sa.Column("asset_code", sa.String(100), nullable=False, comment="能力编码，Gateway 路由匹配的主键"),
        sa.Column("route_path", sa.String(500), nullable=False, comment="Gateway 路由路径，格式：/assets/{code}/mcp"),
        sa.Column("target_url", sa.String(500), nullable=False, comment="转发目标地址，K8s Service 内部地址"),
        sa.Column("rate_limit", sa.Integer(), nullable=True, comment="每分钟请求数上限，null 表示不限流"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1", comment="路由是否启用，stop 时置为 False（MySQL TINYINT 1=True）"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="创建时间"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="更新时间"),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deployment_id"], ["mcp_deployments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        comment="MCP Gateway 路由表，asset_code → 内部服务地址的映射",
    )
    op.create_index("ix_mcp_gateway_routes_asset_code", "mcp_gateway_routes", ["asset_code"])
    op.create_index("ix_mcp_gateway_routes_capability_id", "mcp_gateway_routes", ["capability_id"])

    # ── mcp_call_logs ───────────────────────────────────────────────────────
    # 只追加不更新，Gateway 写入。v1 中 user_id 为 null。
    op.create_table(
        "mcp_call_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="日志ID"),
        sa.Column("capability_id", sa.BigInteger(), nullable=False, comment="关联能力ID"),
        sa.Column("deployment_id", sa.BigInteger(), nullable=True, comment="关联部署实例ID"),
        sa.Column("asset_code", sa.String(100), nullable=False, comment="能力编码，冗余存储便于查询"),
        sa.Column("request_id", sa.String(100), nullable=True, comment="请求唯一ID，来自 X-Request-ID Header"),
        sa.Column("user_id", sa.Integer(), nullable=True, comment="调用方用户ID，v1 为 null，后续通过 API Key 填充"),
        sa.Column("client_ip", sa.String(50), nullable=True, comment="调用方 IP 地址"),
        sa.Column("method", sa.String(50), nullable=True, comment="MCP JSON-RPC method，如 tools/call"),
        sa.Column("tool_name", sa.String(200), nullable=True, comment="调用的工具名称，v1 可为 null"),
        sa.Column("status_code", sa.Integer(), nullable=True, comment="HTTP 响应状态码"),
        sa.Column("success", sa.Boolean(), nullable=True, comment="调用是否成功"),
        sa.Column("duration_ms", sa.Integer(), nullable=True, comment="请求耗时（毫秒）"),
        sa.Column("error_message", sa.Text(), nullable=True, comment="错误信息"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False, comment="调用时间"),
        sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deployment_id"], ["mcp_deployments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        comment="MCP Gateway 调用日志表，由 Gateway 服务写入，只追加不更新",
    )
    op.create_index("ix_mcp_call_logs_capability_id", "mcp_call_logs", ["capability_id"])
    op.create_index("ix_mcp_call_logs_created_at", "mcp_call_logs", ["created_at"])


def downgrade() -> None:
    # 逆序删除，保证外键依赖不报错
    op.drop_index("ix_mcp_call_logs_created_at", table_name="mcp_call_logs")
    op.drop_index("ix_mcp_call_logs_capability_id", table_name="mcp_call_logs")
    op.drop_table("mcp_call_logs")

    op.drop_index("ix_mcp_gateway_routes_capability_id", table_name="mcp_gateway_routes")
    op.drop_index("ix_mcp_gateway_routes_asset_code", table_name="mcp_gateway_routes")
    op.drop_table("mcp_gateway_routes")

    op.drop_index("ix_mcp_deployments_deploy_status", table_name="mcp_deployments")
    op.drop_index("ix_mcp_deployments_capability_id", table_name="mcp_deployments")
    op.drop_table("mcp_deployments")

    op.drop_index("ix_mcp_deploy_tasks_task_status", table_name="mcp_deploy_tasks")
    op.drop_index("ix_mcp_deploy_tasks_capability_id", table_name="mcp_deploy_tasks")
    op.drop_table("mcp_deploy_tasks")
