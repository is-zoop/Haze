---
title: MCP 接入规范
description: 说明 MCP Server 的连接方式、mcp.json 配置、HTTP / STDIO 接入、工具定义、测试用例和安全要求。
updatedAt: 2026-07-01
readingTime: 12 分钟
order: 4
downloadLabel: 下载 MCP 示例包
downloadUrl: /templates/mcp-demo.zip
actionLabel: 创建 MCP Server
actionMenu: dev
checklist:
  - id: 1
    title: 选择连接方式
    desc: 根据部署方式选择 HTTP 或 STDIO。
    icon: Database
  - id: 2
    title: 编写 mcp.json
    desc: 在 ZIP 包中提供 mcp.json，声明 transport、serverUrl、command、args 等配置。
    icon: FileJson
  - id: 3
    title: 定义工具
    desc: 工具名称、描述和 inputSchema 要清晰，便于模型正确调用。
    icon: Terminal
  - id: 4
    title: 准备测试用例
    desc: 为核心工具提供可验证的输入和预期输出。
    icon: ShieldCheck
faqs:
  - q: HTTP 和 STDIO 应该怎么选？
    a: 如果服务已经部署成 HTTP 接口，选择 HTTP；如果服务需要通过命令启动进程，选择 STDIO。
  - q: MCP Server 一定要有 mcp.json 吗？
    a: 建议必须提供。平台可以从 mcp.json 中解析连接方式、服务地址、启动命令和启动参数。
  - q: Token 可以写在 mcp.json 里吗？
    a: 不可以。Token、AppSecret、Cookie 等敏感信息不应该写进 ZIP 包，应使用平台提供的凭证配置或环境变量注入。
---

## MCP Server 是什么

MCP Server 是一种可执行能力，适合把企业内部系统、数据服务、自动化脚本包装成模型可调用的工具。

MCP Server 适合处理：

- 查询订单状态
- 查询商品信息
- 调用内部 API
- 读取受控文件
- 执行数据清洗
- 触发自动化任务
- 查询知识库或业务系统

## 连接方式

当前建议优先支持两种方式：

| 连接方式 | 适用场景                        |
| --- |-----------------------------|
| HTTP | MCP Server 以 HTTP 服务形式运行    |
| STDIO | MCP Server 需要由Agent通过命令启动进程 |

## HTTP 接入方式

HTTP 适合服务化的 MCP Server。

### ZIP 包结构示例

```text
order-query-http-mcp.zip
├── mcp.json         // mcp 说明
├── mcp.yaml         // http模式部署文件
├── package.json/requirements.txt     // 安装依赖
├── mcp-test.json   // mcp 测试文件
└── examples/
    └── tools-call.json
```

### mcp.json 示例

```json
{
  "transport": "http"
}
```

### mcp.yaml 示例
```text
runtime: python      // 启动方式
start_command: python server.py  // 入口文件
port: 8000                      //端口(非必要不修改)
mcp_endpoint: /mcp              //服务尾缀(非必要不修改)
health_check:
  path: /health             
  timeout_seconds: 5            //超时时间
```

### mcp-test.json 示例
```text
{
  "testCases": [
    {
      "tool": "list_departments",         //测试tool 名称
      "arguments": {}                     //测试参数
    },
    {
      "tool": "list_employees",
      "arguments": { "department": "工程部", "limit": 3 }
    },
    {
      "tool": "get_employee",
      "arguments": { "employee_id": "EMP-001" }
    }
  ]
}

```

## STDIO 接入方式

STDIO 适合通过命令启动的 MCP Server，例如 Node.js 或 Python 服务。

### ZIP 包结构示例

Node.js 示例：

```text
order-query-stdio-mcp.zip
├── mcp.json           // mcp 说明
├── package.json     // 安装依赖
├── mcp-test.json   // mcp 测试文件
└── src/
    └── server.ts
```

Python 示例：

```text
order-query-stdio-mcp.zip
├── mcp.json            // mcp 说明
├── requirements.txt     // 安装依赖
└── server.py           // mcp 测试文件
```

### Node.js mcp.json 示例

```json
{
  "transport": "stdio",
  "command": "node",
  "args": ["dist/server.js"]
}
```

### Python mcp.json 示例

```json
{
  "transport": "stdio",
  "command": "python",
  "args": ["server.py"]
}
```

### mcp-test.json 示例
```text
{
  "testCases": [
    {
      "tool": "list_departments",         //测试tool 名称
      "arguments": {}                     //测试参数
    },
    {
      "tool": "list_employees",
      "arguments": { "department": "工程部", "limit": 3 }
    },
    {
      "tool": "get_employee",
      "arguments": { "employee_id": "EMP-001" }
    }
  ]
}
```

## 工具定义规范

工具名称要稳定、清晰、可读。

推荐命名：

```text
query_order_status
search_product_info
generate_refund_summary
validate_after_sales_policy
```

不推荐命名：

```text
test
run
do_task
api1
tool_demo
```

## 工具描述规范

工具描述会影响模型是否能正确选择工具。

推荐写法：

```text
根据订单号查询订单当前状态，包括支付状态、发货状态、物流单号和售后状态。仅支持查询当前用户有权限访问的订单。
```

不推荐写法：

```text
查询订单
```

## 鉴权要求

不要在代码、README、mcp.json 中写入：

- 明文账号
- 明文密码
- Token
- AppSecret
- Cookie
- 数据库连接串
- 个人访问凭证
- http链接模式可以把隐藏信息放到.env中

## 安全边界

MCP Server 必须自己做参数校验，不要完全依赖模型。

建议：

- 所有输入参数都做类型校验。
- 查询类工具默认只读。
- 写操作必须明确说明风险。
- 不允许执行任意 SQL。
- 不允许拼接用户输入执行命令。
- 不允许读取未授权路径。
- 不允许返回敏感字段。

SQL 查询类工具必须限制：

```ts
const sql = String(args?.sql || "").trim();

if (!sql.toLowerCase().startsWith("select")) {
  throw new Error("仅允许执行 SELECT 查询");
}

if (/delete|update|insert|drop|alter|truncate/i.test(sql)) {
  throw new Error("禁止执行写入或结构变更语句");
}
```