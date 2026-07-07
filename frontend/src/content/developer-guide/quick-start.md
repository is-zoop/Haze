---
title: 快速开始
description: 快速了解如何在 Haze 平台创建、审核、部署、调试并发布一项企业内部 Skill 或 MCP 能力。
updatedAt: 2026-07-01
readingTime: 5 分钟
order: 1
actionLabel: 前往开发者中心
actionMenu: dev
checklist:
  - id: 1
    title: 选择能力类型
    desc: 根据业务场景选择 Skill 或 MCP Server。
    icon: Sparkles
  - id: 2
    title: 填写基础信息
    desc: 完成名称、Slug、分类、简介、标签等基础信息。
    icon: FileText
  - id: 3
    title: 上传能力包
    desc: 上传符合规范的 ZIP 包，平台会解析文件结构和配置。
    icon: Upload
  - id: 4
    title: 提交审核发布
    desc: 审核通过后完成部署、调试，最终发布到能力市场。
    icon: ShieldCheck
faqs:
  - q: Skill 和 MCP Server 应该怎么选？
    a: 如果能力主要是提示词、流程说明、分析方法、知识文档，优先选择 Skill；如果能力需要调用接口、数据库、文件系统或自动化工具，选择 MCP Server。
  - q: 创建能力时一定要上传 ZIP 包吗？
    a: 是。ZIP 包是能力交付物，Skill 用于保存 SKILL.md、README、示例文件等内容，MCP Server 用于保存服务代码、mcp.json、依赖文件和测试说明。
  - q: 审核通过后是否会自动发布？
    a: 不建议自动发布。审核通过后还需要部署和调试，调试通过后再发布到能力市场。
---

## 开发者快速开始

Haze 是企业内部的 Skill / MCP 能力广场，用于沉淀、审核、部署和共享企业内部可复用能力。

当前主要支持两类能力：

| 能力类型 | 适合内容 | 典型场景 |
| --- | --- | --- |
| Skill | 提示词、流程说明、知识文档、操作规范 | 周报分析、客服话术、运营复盘、数据分析模板 |
| MCP Server | 可调用工具、接口服务、自动化任务 | 查询数据库、调用内部 API、处理文件、执行自动化流程 |

## 基本流程

发布一项能力通常需要经过以下步骤：

1. 进入「开发者中心」
2. 点击「创建能力」
3. 选择能力类型：Skill 或 MCP Server
4. 填写基础信息
5. 上传 ZIP 能力包
6. 保存草稿
7. 提交审核
8. 审核通过后发起部署
9. 执行连接测试或工具调用测试
10. 调试通过后发布到能力市场

## 最短路径示例

如果你只是要上传一个 Skill，可以按下面方式准备：

```text
sales-report-skill.zip
├── SKILL.md
└── examples/
    └── input-example.md
```

如果你要上传一个 MCP Server，可以按下面方式准备：

```text
order-query-mcp.zip
├── mcp.json
├── package.json
└── src/
    └── server.ts
```

添加说明文档
```text
instruction.zip
├── README.md
└── quick_start.md
```

## 发布后效果

能力发布后，企业内部用户可以在「能力市场」中搜索、查看和使用该能力。

建议发布前确认：

- 能力名称清晰，不使用 Demo、Test、临时能力等名称。
- 简介能说明能力解决什么问题。
- 标签便于搜索。
- ZIP 包中没有账号、密码、Token、Cookie 等敏感信息。
- Skill 有完整的 `SKILL.md`。
- MCP Server 有完整的 `mcp.json` 和测试用例说明。