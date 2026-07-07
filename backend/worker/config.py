from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # 复用主 backend .env 中的 DATABASE_URL，不新增配置文件
    database_url: str = (
        "mysql+pymysql://haze:haze@127.0.0.1:3306/haze?charset=utf8mb4"
    )
    poll_interval_seconds: int = 5        # 无 pending 任务时的轮询间隔（秒）
    task_lock_timeout_seconds: int = 300  # 预留：stuck running 任务超时判定（后续版本补充）

    # K8s 连接
    k8s_in_cluster: bool = False          # True 时使用 Pod 内 ServiceAccount（生产）
    k8s_config_path: str | None = None   # kubeconfig 路径，None = 默认 ~/.kube/config
    k8s_verify_ssl: bool = True           # False 时跳过 TLS 证书校验（本地开发自签名证书场景）
    k8s_proxy_base_url: str = ""          # 非空时用 kubectl proxy 格式构造 internal_url（Windows kind 开发环境）

    # K8s 资源
    k8s_namespace: str = "haze-runtime"  # MCP Server namespace
    gateway_public_base_url: str = "http://127.0.0.1:8001"  # Public base URL for /assets/{code}/mcp
    mcp_placeholder_image: str = "node:20-slim"  # image_url 为空时的占位镜像（Phase 6 前使用）
    pod_ready_timeout_seconds: int = 120  # 等待 Pod Ready 的最大秒数
    pod_ready_poll_seconds: int = 5       # 轮询间隔（秒）

    # MCP 容器资源限制
    mcp_cpu_request: str = "100m"
    mcp_cpu_limit: str = "500m"
    mcp_memory_request: str = "128Mi"
    mcp_memory_limit: str = "512Mi"

    # 镜像仓库
    registry_url: str = "registry.haze.io"    # 不含协议前缀
    registry_project: str = "haze-mcp"        # 镜像仓库项目名

    # 镜像构建
    docker_build_timeout_seconds: int = 300   # docker build + push 单次超时（秒）
    registry_push_enabled: bool = True        # False 时跳过 docker push（本地开发用，Mock K8s 不需要真实镜像）


@lru_cache
def get_worker_settings() -> WorkerSettings:
    return WorkerSettings()
