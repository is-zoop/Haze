from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, AsyncGenerator
from zipfile import ZipFile

import httpx


class McpTestEvent:
    @staticmethod
    def step_start(step: int) -> dict:
        return {"type": "step_start", "step": step}

    @staticmethod
    def log(tag: str, text: str) -> dict:
        return {"type": "log", "tag": tag, "text": text}

    @staticmethod
    def step_done(step: int, duration_ms: int) -> dict:
        return {"type": "step_done", "step": step, "duration_ms": duration_ms}

    @staticmethod
    def done(status: str) -> dict:
        return {"type": "done", "status": status}

    @staticmethod
    def error(step: int, message: str) -> dict:
        return {"type": "error", "step": step, "message": message}


_JSONRPC_ID = 0


def _next_id() -> int:
    global _JSONRPC_ID
    _JSONRPC_ID += 1
    return _JSONRPC_ID


def _jsonrpc(method: str, params: dict | None = None) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": _next_id(),
        "method": method,
        "params": params or {},
    }


def _jsonrpc_notify(method: str, params: dict | None = None) -> dict:
    """Notifications 无 id 字段（MCP 规范）。"""
    return {"jsonrpc": "2.0", "method": method, "params": params or {}}


async def _read_sse_or_json(resp: httpx.Response) -> dict:
    """从 httpx 流式响应中提取首条 JSON-RPC 消息（兼容 JSON 和 SSE 两种格式）。"""
    ct = resp.headers.get("content-type", "")
    if "text/event-stream" in ct:
        async for line in resp.aiter_lines():
            stripped = line.strip()
            if stripped.startswith("data:"):
                data = stripped[5:].strip()
                if data:
                    return json.loads(data)
        raise ValueError("SSE 响应中未找到 data 事件")
    content = await resp.aread()
    return json.loads(content)


async def _http_post(client: httpx.AsyncClient, url: str, body: dict) -> dict:
    """POST + 自动解析 JSON 或 SSE 格式响应（兼容 MCP Streamable HTTP）。"""
    async with client.stream("POST", url, json=body, timeout=8.0) as resp:
        resp.raise_for_status()
        return await _read_sse_or_json(resp)


async def run_http_mcp_test(
    server_url: str,
    capability_code: str,
    zip_path: str = "",
) -> AsyncGenerator[dict, None]:
    """HTTP MCP 测试：6步流程，通过 async generator yield 事件。"""
    protocol_version = "unknown"
    mcp_url = server_url.rstrip("/")
    init_body = _jsonrpc("initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "HazeTestRunner", "version": "1.0"},
    })

    # Step 0: 服务连通性（POST initialize，流式读取，避免 SSE body 阻塞）
    yield McpTestEvent.step_start(0)
    yield McpTestEvent.log("HTTP", f"POST {mcp_url}")
    t0 = time.monotonic()
    init_parsed: dict = {}
    _connected = False
    t1 = t0

    try:
        async with httpx.AsyncClient(verify=False, trust_env=False) as client:
            async with client.stream("POST", mcp_url, json=init_body, timeout=5.0) as resp:
                dur0 = int((time.monotonic() - t0) * 1000)
                yield McpTestEvent.log("HTTP", f"连接成功 ({resp.status_code}) - {dur0}ms")
                yield McpTestEvent.step_done(0, dur0)
                _connected = True

                # Step 1 在同一 stream context 内读取 body
                yield McpTestEvent.step_start(1)
                t1 = time.monotonic()
                init_parsed = await _read_sse_or_json(resp)
    except Exception as exc:
        if not _connected:
            yield McpTestEvent.log("HTTP", f"连接失败: {exc}")
            yield McpTestEvent.error(0, str(exc))
        else:
            yield McpTestEvent.log("MCP", f"响应读取失败: {exc}")
            yield McpTestEvent.error(1, str(exc))
        yield McpTestEvent.done("fail")
        return

    # Step 1: JSON-RPC 结构验证
    try:
        if "jsonrpc" not in init_parsed:
            raise ValueError("响应缺少 jsonrpc 字段（非 JSON-RPC 格式）")
        if "error" in init_parsed:
            raise ValueError(f"initialize 返回错误: {init_parsed['error']}")
        protocol_version = init_parsed.get("result", {}).get("protocolVersion", "unknown")
        dur1 = int((time.monotonic() - t1) * 1000)
        yield McpTestEvent.log("MCP", f"响应为合法 JSON-RPC，协议版本: {protocol_version} - {dur1}ms")
        yield McpTestEvent.step_done(1, dur1)
    except Exception as exc:
        yield McpTestEvent.log("MCP", f"响应格式验证失败: {exc}")
        yield McpTestEvent.error(1, str(exc))
        yield McpTestEvent.done("fail")
        return

    # Step 2: 协议握手完成（notifications/initialized，用 stream 拿到状态码即退出，不读 body）
    yield McpTestEvent.step_start(2)
    t2 = time.monotonic()
    try:
        async with httpx.AsyncClient(verify=False, trust_env=False) as client:
            async with client.stream(
                "POST", mcp_url,
                json=_jsonrpc_notify("notifications/initialized"),
                timeout=5.0,
            ) as notify_resp:
                dur2 = int((time.monotonic() - t2) * 1000)
                yield McpTestEvent.log("MCP", f"协议握手完成 ({notify_resp.status_code}) - {dur2}ms")
        yield McpTestEvent.step_done(2, dur2)
    except Exception as exc:
        dur2 = int((time.monotonic() - t2) * 1000)
        yield McpTestEvent.log("MCP", f"握手通知发送失败（非阻断）: {exc}")
        yield McpTestEvent.step_done(2, dur2)

    # Step 3: 工具列表获取
    yield McpTestEvent.step_start(3)
    yield McpTestEvent.log("TOOLS", "发送 tools/list 请求...")
    t3 = time.monotonic()
    tools_discovered: list[dict] = []
    try:
        async with httpx.AsyncClient(verify=False, trust_env=False) as client:
            result = await _http_post(client, mcp_url, _jsonrpc("tools/list"))
        dur3 = int((time.monotonic() - t3) * 1000)
        tools_discovered = result.get("result", {}).get("tools", [])
        yield McpTestEvent.log("TOOLS", f"获取工具列表成功 - 发现 {len(tools_discovered)} 个工具 - {dur3}ms")
        yield McpTestEvent.step_done(3, dur3)
    except Exception as exc:
        yield McpTestEvent.log("TOOLS", f"获取工具列表失败: {exc}")
        yield McpTestEvent.error(3, str(exc))
        yield McpTestEvent.done("fail")
        return

    # Step 4: 工具调用测试（仅当 mcp-test.json 存在时）
    yield McpTestEvent.step_start(4)
    test_cases: list[dict] = []
    if zip_path:
        try:
            tmp_dir = Path(tempfile.mkdtemp(prefix="haze_mcp_http_"))
            try:
                with ZipFile(zip_path) as zf:
                    zf.extractall(tmp_dir)
                test_cases = _load_test_cases(tmp_dir)
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

    if test_cases:
        t4 = time.monotonic()
        passed = 0
        try:
            async with httpx.AsyncClient(verify=False, trust_env=False) as client:
                for case in test_cases:
                    tool_name = case.get("tool", "")
                    arguments = case.get("arguments", {})
                    try:
                        res = await _http_post(client, mcp_url, _jsonrpc("tools/call", {
                            "name": tool_name,
                            "arguments": arguments,
                        }))
                        content = res.get("result", {}).get("content", [])
                        yield McpTestEvent.log("CALL", f"✓ {tool_name} → {len(content)} 条内容")
                        passed += 1
                    except Exception as exc:
                        yield McpTestEvent.log("CALL", f"✗ {tool_name} 调用失败: {exc}")
            dur4 = int((time.monotonic() - t4) * 1000)
            if passed == 0:
                yield McpTestEvent.error(4, "所有测试用例均失败")
                yield McpTestEvent.done("fail")
                return
            yield McpTestEvent.log("CALL", f"tools/call 完成 {passed}/{len(test_cases)} 通过 - {dur4}ms")
            yield McpTestEvent.step_done(4, dur4)
        except Exception as exc:
            yield McpTestEvent.log("CALL", f"工具调用异常: {exc}")
            yield McpTestEvent.error(4, str(exc))
            yield McpTestEvent.done("fail")
            return
    else:
        yield McpTestEvent.log("CALL", "未找到 mcp-test.json，跳过工具调用测试")
        yield McpTestEvent.step_done(4, 0)

    # Step 5: 完成
    yield McpTestEvent.step_start(5)
    yield McpTestEvent.log("SUCCESS", "所有测试步骤已完成，MCP 服务运行正常。")
    yield McpTestEvent.step_done(5, 0)
    yield McpTestEvent.done("pass")


# ---------------------------------------------------------------------------
# STDIO MCP 调试 — Docker 隔离执行
# ---------------------------------------------------------------------------

def _detect_runtime(work_dir: Path) -> tuple[str, list[str]]:
    """返回 (docker_image, install_cmd)。按优先级检测运行时。"""
    if (work_dir / "package.json").exists():
        return "node:20-slim", ["npm", "install", "--prefer-offline"]
    if (work_dir / "pyproject.toml").exists():
        return "python:3.12-slim", ["pip", "install", "-e", ".", "-q"]
    if (work_dir / "requirements.txt").exists():
        return "python:3.12-slim", ["pip", "install", "-r", "requirements.txt", "-q"]
    # 默认 node（start_command 以 node/npx 开头时适用）
    return "node:20-slim", []


async def _docker_run(args: list[str], *, timeout: float = 30.0) -> tuple[int, str, str]:
    """在线程池中同步运行 docker 命令，兼容 Windows/Linux。"""
    loop = asyncio.get_event_loop()

    def _run() -> tuple[int, str, str]:
        result = subprocess.run(
            ["docker"] + args,
            capture_output=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout.decode(errors="replace"), result.stderr.decode(errors="replace")

    return await loop.run_in_executor(None, _run)


async def run_stdio_mcp_test(
    start_command: str,
    start_args: str,
    zip_path: str,
) -> AsyncGenerator[dict, None]:
    """STDIO MCP 调试：Docker 隔离，9 步流程。"""
    container_id: str | None = None
    tmp_dir: Path | None = None

    try:
        # ── Step 0: 识别运行时 ──────────────────────────────────────────────
        yield McpTestEvent.step_start(0)
        t0 = time.monotonic()
        try:
            tmp_dir = Path(tempfile.mkdtemp(prefix="haze_mcp_"))
            with ZipFile(zip_path) as zf:
                zf.extractall(tmp_dir)
            image, install_cmd = _detect_runtime(tmp_dir)
            runtime_label = "Node.js" if "node" in image else "Python"
            dur0 = int((time.monotonic() - t0) * 1000)
            yield McpTestEvent.log("RUNTIME", f"识别运行时: {runtime_label} ({image}) - {dur0}ms")
            yield McpTestEvent.step_done(0, dur0)
        except Exception as exc:
            yield McpTestEvent.log("RUNTIME", f"运行时识别失败: {exc}")
            yield McpTestEvent.error(0, str(exc))
            yield McpTestEvent.done("fail")
            return

        # ── Step 1: 拉起容器 ────────────────────────────────────────────────
        yield McpTestEvent.step_start(1)
        t1 = time.monotonic()
        try:
            mount_path = Path(tmp_dir).as_posix()
            rc, cid, err = await _docker_run([
                "run", "-d", "--rm",
                "-v", f"{mount_path}:/app",
                "-w", "/app",
                image, "sleep", "120",
            ], timeout=60.0)
            if rc != 0:
                detail = (err.strip() or cid.strip() or "docker run failed")
                raise RuntimeError(detail)
            container_id = cid.strip()
            dur1 = int((time.monotonic() - t1) * 1000)
            yield McpTestEvent.log("DOCKER", f"容器启动成功 ({container_id[:12]}) - {dur1}ms")
            yield McpTestEvent.step_done(1, dur1)
        except Exception as exc:
            yield McpTestEvent.log("DOCKER", f"容器启动失败: {exc}")
            yield McpTestEvent.error(1, str(exc))
            yield McpTestEvent.done("fail")
            return

        # ── Step 2: 安装依赖 ────────────────────────────────────────────────
        yield McpTestEvent.step_start(2)
        t2 = time.monotonic()
        if install_cmd:
            try:
                rc, out, err = await _docker_run(
                    ["exec", container_id] + install_cmd,
                    timeout=120.0,
                )
                dur2 = int((time.monotonic() - t2) * 1000)
                if rc != 0:
                    snippet = (err or out).strip().splitlines()[-1]
                    raise RuntimeError(snippet)
                yield McpTestEvent.log("INSTALL", f"依赖安装成功 - {dur2}ms")
                yield McpTestEvent.step_done(2, dur2)
            except Exception as exc:
                yield McpTestEvent.log("INSTALL", f"依赖安装失败: {exc}")
                yield McpTestEvent.error(2, str(exc))
                yield McpTestEvent.done("fail")
                return
        else:
            yield McpTestEvent.log("INSTALL", "无需安装依赖，跳过")
            yield McpTestEvent.step_done(2, 0)

        # ── Step 3-8: 同步 Popen 跑 MCP 进程，executor 里执行避免 Windows 事件循环限制 ──
        cmd_parts = start_command.split() + (start_args.split() if start_args.strip() else [])
        test_cases = _load_test_cases(tmp_dir)

        loop = asyncio.get_event_loop()
        events: list[dict] = await loop.run_in_executor(
            None,
            _run_mcp_protocol_sync,
            container_id,
            cmd_parts,
            test_cases,
        )
        for ev in events:
            yield ev
        # 判断是否已经 yield done
        if any(e.get("type") == "done" for e in events):
            return

        # 完成（_run_mcp_protocol_sync 内部已 yield done，走不到这里）
        yield McpTestEvent.done("pass")

    except asyncio.TimeoutError:
        yield McpTestEvent.log("ERROR", "操作超时")
        yield McpTestEvent.error(-1, "Timeout")
        yield McpTestEvent.done("fail")
    except Exception as exc:
        yield McpTestEvent.log("ERROR", f"测试异常: {exc}")
        yield McpTestEvent.error(-1, str(exc))
        yield McpTestEvent.done("fail")
    finally:
        # 销毁容器
        if container_id:
            try:
                await _docker_run(["rm", "-f", container_id], timeout=10.0)
            except Exception:
                pass
        # 删除临时目录
        if tmp_dir and tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)


def _load_test_cases(work_dir: Path) -> list[dict[str, Any]]:
    """从 mcp-test.json 读取 testCases，文件不存在则返回空列表。"""
    test_file = work_dir / "mcp-test.json"
    if not test_file.exists():
        return []
    try:
        data = json.loads(test_file.read_text(encoding="utf-8"))
        cases = data.get("testCases", [])
        return cases if isinstance(cases, list) else []
    except Exception:
        return []


def _run_mcp_protocol_sync(
    container_id: str,
    cmd_parts: list[str],
    test_cases: list[dict],
) -> list[dict]:
    """
    同步执行步骤 3-8（进程存活→stdout格式→stderr→initialize→tools/list→tools/call）。
    使用 subprocess.Popen 避免 Windows SelectorEventLoop 的 asyncio 子进程限制。
    返回所有事件列表，调用方 yield 出去。
    """
    events: list[dict] = []

    def ev(e: dict) -> None:
        events.append(e)

    def send_rpc(proc: "subprocess.Popen[bytes]", method: str, params: dict | None = None) -> dict:
        msg = json.dumps(_jsonrpc(method, params)) + "\n"
        assert proc.stdin
        proc.stdin.write(msg.encode())
        proc.stdin.flush()
        assert proc.stdout
        raw = proc.stdout.readline()
        if not raw:
            raise RuntimeError("stdout closed")
        return json.loads(raw.decode())

    # Step 3: 进程存活检测
    ev(McpTestEvent.step_start(3))
    t3 = time.monotonic()
    proc = subprocess.Popen(
        ["docker", "exec", "-i", container_id] + cmd_parts,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(1.0)
    if proc.poll() is not None:
        ev(McpTestEvent.log("PROC", f"进程已退出 (code={proc.returncode})"))
        ev(McpTestEvent.error(3, "Process exited immediately"))
        ev(McpTestEvent.done("fail"))
        return events
    dur3 = int((time.monotonic() - t3) * 1000)
    ev(McpTestEvent.log("PROC", f"进程正常运行中 - {dur3}ms"))
    ev(McpTestEvent.step_done(3, dur3))

    # Step 4: stdout 格式（发 initialize，验证首条响应是合法 JSON-RPC）
    ev(McpTestEvent.step_start(4))
    t4 = time.monotonic()
    init_resp: dict = {}
    try:
        init_resp = send_rpc(proc, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "HazeTestRunner", "version": "1.0"},
        })
        if "jsonrpc" not in init_resp:
            raise ValueError("响应缺少 jsonrpc 字段")
        dur4 = int((time.monotonic() - t4) * 1000)
        proto = init_resp.get("result", {}).get("protocolVersion", "unknown")
        ev(McpTestEvent.log("STDOUT", f"stdout 格式正确，协议版本: {proto} - {dur4}ms"))
        ev(McpTestEvent.step_done(4, dur4))
    except Exception as exc:
        ev(McpTestEvent.log("STDOUT", f"stdout 格式检测失败: {exc}"))
        ev(McpTestEvent.error(4, str(exc)))
        proc.kill()
        ev(McpTestEvent.done("fail"))
        return events

    # Step 5: stderr 检测（非阻断，读已有缓冲 0.3s）
    ev(McpTestEvent.step_start(5))
    t5 = time.monotonic()
    stderr_warning = False
    try:
        import select as _select
        stderr_lines: list[str] = []
        deadline5 = time.monotonic() + 0.3
        assert proc.stderr
        while time.monotonic() < deadline5:
            ready, _, _ = _select.select([proc.stderr], [], [], max(0.0, deadline5 - time.monotonic()))
            if not ready:
                break
            line = proc.stderr.readline()
            if not line:
                break
            stderr_lines.append(line.decode(errors="replace").rstrip())
        error_lines = [l for l in stderr_lines if "ERROR" in l.upper()]
        dur5 = int((time.monotonic() - t5) * 1000)
        if error_lines:
            stderr_warning = True
            ev(McpTestEvent.log("STDERR", f"⚠ 发现错误日志（不阻断）: {error_lines[0][:120]}"))
        else:
            ev(McpTestEvent.log("STDERR", f"stderr 正常，共 {len(stderr_lines)} 行日志 - {dur5}ms"))
        ev(McpTestEvent.step_done(5, dur5))
    except Exception:
        ev(McpTestEvent.step_done(5, 0))

    # Step 6: 协议握手完成（notifications/initialized，失败不阻断）
    ev(McpTestEvent.step_start(6))
    t6 = time.monotonic()
    try:
        notify_msg = json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}) + "\n"
        assert proc.stdin
        proc.stdin.write(notify_msg.encode())
        proc.stdin.flush()
        dur6 = int((time.monotonic() - t6) * 1000)
        ev(McpTestEvent.log("MCP", f"协议握手完成 - {dur6}ms"))
        ev(McpTestEvent.step_done(6, dur6))
    except Exception as exc:
        ev(McpTestEvent.log("MCP", f"握手通知发送失败（非阻断）: {exc}"))
        ev(McpTestEvent.step_done(6, 0))

    # Step 7: tools/list
    ev(McpTestEvent.step_start(7))
    t7 = time.monotonic()
    try:
        result = send_rpc(proc, "tools/list")
        dur7 = int((time.monotonic() - t7) * 1000)
        tools: list[dict] = result.get("result", {}).get("tools", [])
        ev(McpTestEvent.log("TOOLS", f"获取工具列表成功 - 发现 {len(tools)} 个工具 - {dur7}ms"))
        ev(McpTestEvent.step_done(7, dur7))
    except Exception as exc:
        ev(McpTestEvent.log("TOOLS", f"tools/list 失败: {exc}"))
        ev(McpTestEvent.error(7, str(exc)))
        proc.kill()
        ev(McpTestEvent.done("fail"))
        return events

    # Step 8: tools/call（仅当 mcp-test.json 存在时）
    if test_cases:
        ev(McpTestEvent.step_start(8))
        t8 = time.monotonic()
        passed = 0
        for case in test_cases:
            tool_name = case.get("tool", "")
            arguments = case.get("arguments", {})
            try:
                res = send_rpc(proc, "tools/call", {"name": tool_name, "arguments": arguments})
                content = res.get("result", {}).get("content", [])
                ev(McpTestEvent.log("CALL", f"✓ {tool_name} → {len(content)} 条内容"))
                passed += 1
            except Exception as exc:
                ev(McpTestEvent.log("CALL", f"✗ {tool_name} 调用失败: {exc}"))
        dur8 = int((time.monotonic() - t8) * 1000)
        if passed == 0:
            proc.kill()
            ev(McpTestEvent.error(8, "所有测试用例均失败"))
            ev(McpTestEvent.done("fail"))
            return events
        ev(McpTestEvent.log("CALL", f"tools/call 完成 {passed}/{len(test_cases)} 通过 - {dur8}ms"))
        ev(McpTestEvent.step_done(8, dur8))
    else:
        ev(McpTestEvent.log("CALL", "未找到 mcp-test.json，跳过 tools/call 测试"))

    proc.kill()
    summary = "所有测试步骤已完成，STDIO MCP 服务运行正常。"
    if stderr_warning:
        summary += "（stderr 有警告日志，请关注）"
    ev(McpTestEvent.step_start(9))
    ev(McpTestEvent.log("SUCCESS", summary))
    ev(McpTestEvent.step_done(9, 0))
    ev(McpTestEvent.done("pass"))
    return events


def _pick_readonly_tool(tools: list[dict]) -> dict | None:
    """优先选名称含 list/get/query/read/fetch/show 的工具。"""
    readonly_keywords = ("list", "get", "query", "read", "fetch", "show", "describe", "info")
    for tool in tools:
        name = tool.get("name", "").lower()
        if any(kw in name for kw in readonly_keywords):
            return tool
    return tools[0] if tools else None


def _build_minimal_args(tool: dict) -> dict:
    """构建最小参数集：只填 required 字段，字符串给空字符串，数字给 0。"""
    schema = tool.get("inputSchema", {})
    required = schema.get("required", [])
    props = schema.get("properties", {})
    args: dict[str, Any] = {}
    for field in required:
        prop_type = props.get(field, {}).get("type", "string")
        if prop_type == "integer" or prop_type == "number":
            args[field] = 0
        elif prop_type == "boolean":
            args[field] = False
        elif prop_type == "array":
            args[field] = []
        else:
            args[field] = ""
    return args
