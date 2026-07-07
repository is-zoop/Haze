"""MCP 镜像构建器 — 从 ZIP 包构建并推送 MCP Server 镜像。

流程：解压 ZIP → 读取并校验 mcp.yaml → 动态生成 Dockerfile → docker build → docker push → 自动清理临时目录。

安全约束：
  - 禁止 ZIP 包含自定义 Dockerfile（防止用户绕过安全基线）
  - 禁止 mcp.yaml 中使用 secret: true（第一版不支持 Secret 注入）
  - 只允许 runtime: python 和 node 两种基础镜像
"""
from __future__ import annotations

import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import yaml

from worker.config import WorkerSettings

REQUIRED_FIELDS: frozenset[str] = frozenset(
    {"runtime", "start_command", "port", "mcp_endpoint", "health_check"}
)
SUPPORTED_RUNTIMES: frozenset[str] = frozenset({"python", "node"})
BASE_IMAGES: dict[str, str] = {
    "python": "python:3.12-slim",
    "node": "node:20-slim",
}


class McpBuildError(Exception):
    """构建校验或执行失败，包含用户可读原因，写入 task.error_message。"""


# ── mcp.yaml 读取与校验 ────────────────────────────────────────────────────────

def load_mcp_config(extract_dir: Path) -> dict:
    """读取 mcp.yaml（优先）或 mcp.json（fallback）。两者均不存在则抛出 McpBuildError。"""
    mcp_yaml = extract_dir / "mcp.yaml"
    mcp_json = extract_dir / "mcp.json"

    if mcp_yaml.exists():
        with mcp_yaml.open("r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
    elif mcp_json.exists():
        with mcp_json.open("r", encoding="utf-8") as f:
            config = json.load(f)
    else:
        raise McpBuildError(
            "ZIP 包中缺少 mcp.yaml（或 mcp.json），无法构建镜像，请在 ZIP 根目录添加 mcp.yaml"
        )

    if not isinstance(config, dict):
        raise McpBuildError("mcp.yaml 必须是 YAML 字典格式，当前内容无效")

    return config


def validate_mcp_config(config: dict) -> None:
    """校验 mcp.yaml 必填字段和安全限制，不合规则抛出 McpBuildError。"""
    missing = REQUIRED_FIELDS - config.keys()
    if missing:
        raise McpBuildError(
            f"mcp.yaml 缺少必填字段：{', '.join(sorted(missing))}"
        )

    runtime = str(config.get("runtime", "")).strip().lower()
    if runtime not in SUPPORTED_RUNTIMES:
        raise McpBuildError(
            f"不支持的 runtime：{config.get('runtime')!r}，"
            f"当前仅支持 {sorted(SUPPORTED_RUNTIMES)}"
        )

    if config.get("secret") is True:
        raise McpBuildError(
            "mcp.yaml 禁止使用 secret: true（第一版不支持 Secret 环境变量注入）"
        )


# ── Dockerfile 生成 ───────────────────────────────────────────────────────────

def generate_dockerfile(config: dict, extract_dir: Path) -> str:
    """动态生成 Dockerfile，禁止用户在 ZIP 中包含自定义 Dockerfile。"""
    if (extract_dir / "Dockerfile").exists():
        raise McpBuildError(
            "ZIP 包中不允许包含自定义 Dockerfile，Haze 平台统一管理基础镜像和安全基线"
        )

    runtime = str(config["runtime"]).strip().lower()
    base_image = BASE_IMAGES[runtime]
    port = int(config["port"])
    start_command = str(config["start_command"])

    if runtime == "python":
        install_cmd = "pip install --no-cache-dir -r requirements.txt"
    else:  # node
        install_cmd = "npm install --production"

    return (
        f"FROM {base_image}\n"
        f"WORKDIR /app\n"
        f"COPY . .\n"
        f"RUN {install_cmd}\n"
        f"EXPOSE {port}\n"
        f"CMD {start_command}\n"
    )


# ── docker build + push ───────────────────────────────────────────────────────

def build_and_push(
    extract_dir: Path,
    image_url: str,
    dockerfile_content: str,
    timeout_seconds: int,
    skip_push: bool = False,
) -> None:
    """将生成的 Dockerfile 写入临时目录，执行 docker build（及可选的 docker push）。

    skip_push=True 时跳过推送，仅在本地构建镜像（Mock K8s 模式下无需推送到仓库）。
    """
    dockerfile_path = extract_dir / "Dockerfile"
    dockerfile_path.write_text(dockerfile_content, encoding="utf-8")

    build_result = subprocess.run(
        ["docker", "build", "-t", image_url, "."],
        cwd=str(extract_dir),
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    if build_result.returncode != 0:
        raise McpBuildError(
            f"docker build 失败（exit={build_result.returncode}）：\n"
            f"{build_result.stderr[-2000:]}"
        )

    if skip_push:
        import logging
        logging.getLogger(__name__).info(
            "registry_push_enabled=false，跳过 docker push，镜像仅在本地可用：%s", image_url
        )
        return

    push_result = subprocess.run(
        ["docker", "push", image_url],
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    if push_result.returncode != 0:
        raise McpBuildError(
            f"docker push 失败（exit={push_result.returncode}）：\n"
            f"{push_result.stderr[-2000:]}"
        )


# ── 对外入口 ──────────────────────────────────────────────────────────────────

def build_image(
    zip_path: Path,
    image_url: str,
    settings: WorkerSettings,
) -> dict:
    """完整构建流程：解压 → 校验 → 生成 Dockerfile → build + push → 自动清理。

    返回 {'mcp_config': {...}} 供调用方更新 deployment 字段（port、endpoint 等）。
    临时目录由 TemporaryDirectory context manager 自动清理，不留残留文件。
    """
    with tempfile.TemporaryDirectory(prefix="haze-mcp-build-") as tmpdir:
        extract_dir = Path(tmpdir) / "src"
        extract_dir.mkdir()

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

        config = load_mcp_config(extract_dir)
        validate_mcp_config(config)
        dockerfile = generate_dockerfile(config, extract_dir)
        build_and_push(
            extract_dir,
            image_url,
            dockerfile,
            settings.docker_build_timeout_seconds,
            skip_push=not settings.registry_push_enabled,
        )

    return {"mcp_config": config}
