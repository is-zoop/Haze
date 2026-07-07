# MCP 运行时枚举常量，集中定义，供 models / service / worker 复用

# ── 部署任务类型 ────────────────────────────────────────────────────────────
TASK_TYPE_DEPLOY   = "deploy"    # 首次部署
TASK_TYPE_START    = "start"     # 启动（replicas 从 0 改为 1）
TASK_TYPE_STOP     = "stop"      # 停止（replicas 改为 0）
TASK_TYPE_RESTART  = "restart"   # 重启 Pod
TASK_TYPE_REDEPLOY = "redeploy"  # 重新部署（更新镜像）
TASK_TYPE_ROLLBACK = "rollback"  # 回滚到上一个版本
TASK_TYPE_DELETE   = "delete"    # delete K8s resources

# ── 部署任务状态 ────────────────────────────────────────────────────────────
TASK_STATUS_PENDING = "pending"  # 等待 Worker 消费
TASK_STATUS_RUNNING = "running"  # Worker 正在执行
TASK_STATUS_SUCCESS = "success"  # 执行成功
TASK_STATUS_FAILED  = "failed"   # 执行失败

# ── 运行时提供商 ────────────────────────────────────────────────────────────
RUNTIME_PROVIDER_K8S = "kubernetes"  # Kubernetes 集群

# ── 部署实例综合状态 ────────────────────────────────────────────────────────
DEPLOY_STATUS_PENDING   = "pending"    # 任务已创建，等待开始
DEPLOY_STATUS_BUILDING  = "building"   # 正在构建镜像
DEPLOY_STATUS_DEPLOYING = "deploying"  # 正在创建 K8s 资源
DEPLOY_STATUS_RUNNING   = "running"    # Pod 健康运行中
DEPLOY_STATUS_FAILED    = "failed"     # 部署或运行失败
DEPLOY_STATUS_STOPPED   = "stopped"    # 已主动停止

# ── 期望运行状态（用户意图） ────────────────────────────────────────────────
DESIRED_STATUS_RUNNING = "running"  # 用户希望运行
DESIRED_STATUS_STOPPED = "stopped"  # 用户希望停止

# ── 实际运行状态（K8s Pod 真实状态） ───────────────────────────────────────
ACTUAL_STATUS_PENDING = "pending"  # Pod 尚未就绪
ACTUAL_STATUS_RUNNING = "running"  # Pod 正在运行
ACTUAL_STATUS_FAILED  = "failed"   # Pod 异常退出
ACTUAL_STATUS_STOPPED = "stopped"  # Pod 已停止（replicas=0）

# ── 健康检查状态 ────────────────────────────────────────────────────────────
HEALTH_STATUS_UNKNOWN   = "unknown"    # 尚未执行健康检查
HEALTH_STATUS_HEALTHY   = "healthy"    # 健康检查通过
HEALTH_STATUS_UNHEALTHY = "unhealthy"  # 健康检查失败
