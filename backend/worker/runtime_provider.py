"""RuntimeProvider 抽象接口，供 KubernetesRuntimeProvider 及后续 provider 实现。

使用 typing.Protocol，无需继承，duck typing 满足接口即可。
"""
from __future__ import annotations

from typing import Protocol

from app.modules.mcp_runtime.models import McpDeployment


class RuntimeProvider(Protocol):
    def deploy(
        self,
        dep: McpDeployment,
        port: int,
        endpoint: str,
    ) -> tuple[str, str, str]:
        """创建 K8s Deployment / Service / NetworkPolicy。

        返回 (image_url, internal_service_name, internal_url)。
        """
        ...

    def start(self, dep: McpDeployment) -> None:
        """将 Deployment replicas 设为 1，恢复服务。"""
        ...

    def stop(self, dep: McpDeployment) -> None:
        """将 Deployment replicas 设为 0，停止服务。"""
        ...

    def restart(self, dep: McpDeployment) -> None:
        """更新 Pod 注解触发滚动重启，不停机。"""
        ...

    def delete(self, dep: McpDeployment) -> None:
        """Delete Deployment / Service / NetworkPolicy resources."""
        ...

    def wait_for_ready(self, dep: McpDeployment, timeout_seconds: int) -> bool:
        """轮询等待至少 1 个 Pod Ready，超时返回 False。"""
        ...

    def get_pod_logs(self, dep: McpDeployment, tail_lines: int = 100) -> str:
        """返回最新 Pod 日志，无 Pod 时返回空字符串。"""
        ...
