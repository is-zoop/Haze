"""MCP Gateway — 转发外部 MCP 调用到 K8s 内部服务，记录调用日志。

启动方式：在 backend/ 目录下执行 python -m gateway.main
独立进程，不与 Haze Backend 共享 FastAPI app，但共享同一数据库。
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from functools import lru_cache
from uuid import uuid4

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.modules.capabilities.models import Capability
from app.modules.mcp_runtime import enums
from app.modules.mcp_runtime.models import McpCallLog, McpDeployment, McpGatewayRoute
from app.modules.users.models import UserMcpCredential

logger = logging.getLogger(__name__)


# ── 配置 ───────────────────────────────────────────────────────────────────────

class GatewaySettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # 复用主 backend .env 中的 DATABASE_URL
    database_url: str = "mysql+pymysql://haze:haze@127.0.0.1:3306/haze?charset=utf8mb4"
    proxy_timeout_seconds: float = 30.0  # 转发上游超时（秒）
    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8001
    trusted_mcp_credential_passthrough: str = ""


@lru_cache
def get_gateway_settings() -> GatewaySettings:
    return GatewaySettings()


# ── DB Session Factory ─────────────────────────────────────────────────────────

def _make_session_factory():
    """独立建 engine，不依赖 Haze Backend 的 app.db.session。"""
    s = get_gateway_settings()
    engine = create_engine(s.database_url, pool_pre_ping=True, pool_recycle=3600)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


_SessionFactory = _make_session_factory()

# ── FastAPI App ────────────────────────────────────────────────────────────────

app = FastAPI(title="Haze MCP Gateway", docs_url=None, redoc_url=None)
MCP_KEY_PREFIX = "haze_"


# ── 辅助函数 ───────────────────────────────────────────────────────────────────

def _hash_mcp_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _verify_mcp_key(db, raw_key: str) -> UserMcpCredential | None:
    """用 key_prefix 索引快速定位，再用 key_hash 精确验证。"""
    candidate = db.scalar(
        select(UserMcpCredential).where(UserMcpCredential.key_prefix == raw_key[:18])
    )
    if candidate and candidate.key_hash == _hash_mcp_key(raw_key):
        return candidate
    return None


def _parse_mcp_body(body: bytes) -> tuple[str | None, str | None]:
    """从 JSON-RPC body 解析 method 和 tool_name，解析失败返回 (None, None)。"""
    try:
        payload = json.loads(body)
        method = payload.get("method")
        # tools/call 时才提取 tool_name，其他 method 无此字段
        tool = (payload.get("params") or {}).get("name") if method == "tools/call" else None
        return method, tool
    except Exception:
        return None, None


def _build_forward_headers(headers, request_id: str, asset_code: str) -> dict:
    """透传 MCP 请求头；受信任能力额外使用内部头传递个人凭证。"""
    trusted_assets = {
        item.strip()
        for item in get_gateway_settings().trusted_mcp_credential_passthrough.split(",")
        if item.strip()
    }
    result = {}
    personal_credential = None
    for k, v in headers.items():
        lk = k.lower()
        if lk == "x-haze-personal-credential":
            continue  # 丢弃调用方伪造的内部凭证头
        if lk == "authorization" and v.lower().startswith(
            f"bearer {MCP_KEY_PREFIX}"
        ):
            if asset_code not in trusted_assets:
                continue  # 非受信任能力不透传个人凭证
            personal_credential = v
        if lk in ("content-type", "accept", "authorization") or lk.startswith("x-mcp-"):
            result[k] = v
    if personal_credential:
        result["X-Haze-Personal-Credential"] = personal_credential
    result["X-Request-ID"] = request_id
    return result


async def _forward_request(
    target_url: str,
    body: bytes,
    headers: dict,
    timeout: float,
) -> tuple[int, bool, bytes, str, str | None]:
    """httpx 异步代理，返回 (status_code, success, content, content_type, error_msg)。"""
    try:
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            resp = await client.post(target_url, content=body, headers=headers)
        return (
            resp.status_code,
            resp.status_code < 400,
            resp.content,
            resp.headers.get("content-type", "application/json"),
            None,
        )
    except httpx.TimeoutException:
        return (
            504, False,
            json.dumps({"error": "upstream timeout"}).encode(),
            "application/json",
            "上游超时",
        )
    except Exception as exc:
        return (
            502, False,
            json.dumps({"error": "gateway error"}).encode(),
            "application/json",
            str(exc),
        )


def _write_call_log(
    db,
    route: McpGatewayRoute,
    request_id: str | None,
    client_ip: str | None,
    method: str | None,
    tool_name: str | None,
    status_code: int,
    success: bool,
    elapsed_ms: int,
    error_msg: str | None,
    user_id: int | None = None,
) -> None:
    """写入 mcp_call_logs，失败时只记录日志不抛出（不能因为日志写失败影响主流程）。"""
    try:
        db.add(McpCallLog(
            capability_id=route.capability_id,
            deployment_id=route.deployment_id,
            asset_code=route.asset_code,
            request_id=request_id,
            user_id=user_id,
            client_ip=client_ip,
            method=method,
            tool_name=tool_name,
            status_code=status_code,
            success=success,
            duration_ms=elapsed_ms,
            error_message=error_msg,
        ))
        db.commit()
    except Exception:
        logger.exception("调用日志写入失败，asset_code=%s request_id=%s", route.asset_code, request_id)


# ── 路由 ───────────────────────────────────────────────────────────────────────

@app.get("/assets/{asset_code}/mcp")
async def mcp_get(asset_code: str):
    """GET 保留给未来 SSE 扩展，第一版统一返回 405。"""
    return Response(status_code=405, headers={"Allow": "POST"})


@app.post("/assets/{asset_code}/mcp")
async def mcp_post(asset_code: str, request: Request):
    """接收外部 MCP 调用，校验路由/部署/发布状态，代理到 K8s 内部服务，写入调用日志。"""
    start = time.monotonic()
    # 优先使用调用方传入的 request_id，否则自动生成
    request_id = request.headers.get("X-Request-ID") or uuid4().hex
    client_ip = request.client.host if request.client else None
    body = await request.body()

    mcp_method, tool_name = _parse_mcp_body(body)

    # ── API Key 鉴权
    auth_header = request.headers.get("Authorization", "")
    raw_key = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    if not raw_key.startswith(MCP_KEY_PREFIX):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    with _SessionFactory() as db:
        credential = _verify_mcp_key(db, raw_key)
        if credential is None:
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        caller_user_id: int = credential.user_id

    # ── 路由校验（sync SQLAlchemy；Phase 7 DB 读操作耗时极短，可接受阻塞 event loop）
    with _SessionFactory() as db:
        route = db.scalar(
            select(McpGatewayRoute)
            .where(McpGatewayRoute.asset_code == asset_code)
            .order_by(McpGatewayRoute.id.desc())
        )
        if route is None:
            return JSONResponse({"error": "route not found"}, status_code=404)

        if not route.enabled:
            _write_call_log(db, route, request_id, client_ip, mcp_method, tool_name, 503, False, 0, "服务已停止", caller_user_id)
            return JSONResponse({"error": "service stopped"}, status_code=503)

        dep = db.get(McpDeployment, route.deployment_id)
        if dep is None or dep.deploy_status != enums.DEPLOY_STATUS_RUNNING:
            _write_call_log(db, route, request_id, client_ip, mcp_method, tool_name, 503, False, 0, "部署未运行", caller_user_id)
            return JSONResponse({"error": "deployment not running"}, status_code=503)

        cap = db.get(Capability, route.capability_id)
        if cap is None or cap.status != "published":
            _write_call_log(db, route, request_id, client_ip, mcp_method, tool_name, 403, False, 0, "能力未发布", caller_user_id)
            return JSONResponse({"error": "capability not published"}, status_code=403)

        # 提前取出标量，db 关闭后属性访问会触发 DetachedInstanceError
        target_url = route.target_url
        capability_id = route.capability_id
        deployment_id = route.deployment_id

    # ── 异步代理转发
    settings = get_gateway_settings()
    forward_headers = _build_forward_headers(request.headers, request_id, asset_code)
    status_code, success, resp_content, resp_content_type, error_msg = await _forward_request(
        target_url, body, forward_headers, settings.proxy_timeout_seconds
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # ── 写入调用日志
    with _SessionFactory() as db:
        db.add(McpCallLog(
            capability_id=capability_id,
            deployment_id=deployment_id,
            asset_code=asset_code,
            request_id=request_id,
            user_id=caller_user_id,
            client_ip=client_ip,
            method=mcp_method,
            tool_name=tool_name,
            status_code=status_code,
            success=success,
            duration_ms=elapsed_ms,
            error_message=error_msg,
        ))
        db.commit()

    return Response(
        content=resp_content,
        status_code=status_code,
        headers={"Content-Type": resp_content_type, "X-Request-ID": request_id},
    )


# ── 入口 ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    s = get_gateway_settings()
    logger.info("MCP Gateway 启动，监听 %s:%d", s.gateway_host, s.gateway_port)
    uvicorn.run(app, host=s.gateway_host, port=s.gateway_port)
