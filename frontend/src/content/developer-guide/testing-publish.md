---
title: 调试与发布
description: 说明能力审核通过后如何部署、调试、查看测试结果，并发布到能力市场。
updatedAt: 2026-07-01
readingTime: 8 分钟
order: 5
actionLabel: 查看发布状态
actionMenu: dev
checklist:
  - id: 1
    title: 审核通过
    desc: 只有审核通过后的能力才建议进入部署和调试流程。
    icon: ShieldCheck
  - id: 2
    title: 发起部署
    desc: MCP Server 需要完成服务部署后才能进行连接测试。
    icon: Rocket
  - id: 3
    title: 执行调试
    desc: 根据 HTTP 或 STDIO 类型执行对应测试步骤。
    icon: Terminal
  - id: 4
    title: 发布能力
    desc: 调试通过后发布到能力市场。
    icon: Sparkles
faqs:
  - q: 为什么发布按钮不可用？
    a: 通常是能力还没有完成审核、部署或调试。请先确认状态是否满足发布条件。
  - q: MCP 测试失败怎么办？
    a: 先查看测试日志，确认失败发生在服务连通性、协议握手、工具列表还是工具调用阶段。
  - q: Skill 需要部署吗？
    a: Skill 通常不需要像 MCP Server 一样部署服务，但仍建议通过审核和基础测试后再发布。
---

## 调试与发布流程

能力从创建到发布通常经过以下流程：

```text
保存草稿 → 提交审核 → 审核通过 → 发起部署 → 执行调试 → 调试通过 → 发布能力
```

## 发布前检查

发布前请确认：

| 检查项         | Skill | MCP Server |
|-------------| --- |------------|
| 基础信息完整      | 必须 | 必须         |
| ZIP 包已上传    | 必须 | 必须         |
| 审核已通过       | 必须 | 必须         |
| SKILL.md 完整 | 必须 | 不适用        |
| mcp.json 完整 | 不适用 | 必须         |
| mcp.yaml 完整 | 不适用 | http必须     |
| 服务部署成功      | 不适用 | http必须         |
| 工具测试通过      | 不适用 | 必须         |
| 无敏感信息       | 必须 | 必须         |

## MCP HTTP 测试步骤

HTTP 类型 MCP Server 会重点检查：

| 步骤 | 检查内容 | 常见失败原因 |
| --- | --- | --- |
| 1. 服务连通性 | HTTP POST 到 MCP 端点可达 | 地址错误、网络不通、服务未启动 |
| 2. 响应格式验证 | 响应为合法 JSON-RPC | 返回 HTML、纯文本或异常堆栈 |
| 3. 协议握手完成 | initialize 和 initialized 正常 | 协议实现不完整 |
| 4. 工具列表获取 | tools/list 返回工具列表 | 未注册工具或响应格式错误 |
| 5. 工具调用测试 | 有测试用例时执行 tools/call | 参数错误、工具内部异常 |
| 6. 完成 | 汇总测试结果 | 前面任一步骤失败 |

## MCP STDIO 测试步骤

STDIO 类型 MCP Server 会重点检查：

| 步骤 | 检查内容 | 常见失败原因 |
| --- | --- | --- |
| 1. 识别运行时 | 检测 Node.js / Python 环境 | 缺少运行时或版本不匹配 |
| 2. 拉起容器 | Docker 隔离容器启动 | 镜像拉取失败、容器启动失败 |
| 3. 安装依赖 | npm install / pip install | 依赖缺失、版本冲突、网络失败 |
| 4. 进程存活 | 进程启动后持续运行 | 启动命令错误、入口文件错误 |
| 5. stdout 格式 | 首条输出为合法 JSON-RPC | 输出了普通日志污染协议 |
| 6. stderr 检测 | 无 ERROR 级别日志输出 | 程序启动报错 |
| 7. 协议握手完成 | initialized 事件正常 | MCP 协议实现不完整 |
| 8. tools/list | 获取工具列表成功 | 工具注册失败 |
| 9. tools/call | 有测试用例时执行工具调用 | 参数错误、工具内部异常 |
| 10. 完成 | 汇总测试结果 | 前面任一步骤失败 |

## 测试日志怎么看

测试日志通常包含：

```text
[START] 开始测试 MCP 服务
[HTTP] POST /mcp
[RPC] initialize
[RPC] tools/list
[TOOL] query_order_status
[PASS] 工具调用成功
[DONE] 测试通过
```

如果失败，优先看最后一条 `ERROR` 日志。

常见错误示例：

```text
[ERROR] 请求失败 (404)
```

说明服务地址可能不正确。

```text
[ERROR] initialize response is not valid JSON-RPC
```

说明服务返回格式不符合 MCP 协议。

```text
[ERROR] command not found: python
```

说明 STDIO 运行环境缺少 Python，或启动命令写错。

```text
[ERROR] Cannot find module './dist/server.js'
```

说明 Node.js 构建产物不存在，可能没有执行 build，或 mcp.json 中 args 路径写错。

## 发布能力

调试通过后，可以点击「发布」。

发布后：

- 能力会出现在能力市场。
- 企业内部用户可以搜索和查看。
- 用户可以复制 Prompt 或查看接入说明。
- MCP Server 可以被调用，具体能力取决于工具定义和权限配置。

## 下线能力

如果能力不再使用，或者发现异常，可以点击「下线」。

下线后：

- 普通用户不再在能力市场看到该能力。
- 已有调用应逐步迁移到其他能力或新版本。
- 开发者可以继续保留能力记录和版本记录。

## 创建新版本

当已发布能力需要升级时，建议创建新版本，而不是直接覆盖旧版本。

适合创建新版本的情况：

- 修改 MCP 工具入参
- 新增工具
- 删除工具
- 修改核心业务逻辑
- 调整 Skill 输出格式
- 修复影响使用结果的问题

版本说明建议写清楚：

```text
版本：1.1.0

更新内容：
1. 新增 query_refund_status 工具。
2. 优化 query_order_status 的异常提示。
3. 修复订单号为空时返回 500 的问题。

影响范围：
- 旧工具 query_order_status 兼容原有入参。
- 新工具不影响已有调用。
```

## 发布失败排查

| 问题 | 可能原因 | 处理建议 |
| --- | --- | --- |
| 无法发布 | 状态不满足发布条件 | 先完成审核、部署、调试 |
| 测试失败 | MCP 服务不可用 | 查看测试日志 |
| 工具列表为空 | MCP 未注册工具 | 检查 tools/list |
| 工具调用失败 | 入参或代码异常 | 检查测试用例和服务日志 |
| 发布后用户找不到 | 分类、标签或状态异常 | 确认是否已发布成功 |