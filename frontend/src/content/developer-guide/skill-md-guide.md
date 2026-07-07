---
title: Skill 接入规范
description: 说明 Skill 能力包的目录结构、SKILL.md 编写方式、README 要求、示例文件和提交检查项。
updatedAt: 2026-07-01
readingTime: 10 分钟
order: 3
downloadLabel: 下载 SKILL.md 模板
downloadUrl: /templates/SKILL-template.md
actionLabel: 创建 Skill
actionMenu: dev
checklist:
  - id: 1
    title: 准备 SKILL.md
    desc: 用 SKILL.md 描述能力用途、输入、输出、步骤和边界。
    icon: FileText
  - id: 2
    title: 补充 README
    desc: README 面向开发者和审核人，说明能力包结构与维护方式。
    icon: BookOpen
  - id: 3
    title: 提供示例
    desc: 至少提供一个输入示例和一个输出示例。
    icon: Sparkles
  - id: 4
    title: 打包上传
    desc: 将 SKILL.md、README、examples 等内容打包为 ZIP。
    icon: Upload
faqs:
  - q: Skill 一定要写代码吗？
    a: 不一定。Skill 可以只包含 SKILL.md、README 和示例文件，适合提示词、流程规范、分析模板等轻量能力。
  - q: SKILL.md 和 README.md 有什么区别？
    a: SKILL.md 面向模型执行和使用约束，README.md 面向开发者、审核人和维护者阅读。
  - q: Skill 里可以放示例数据吗？
    a: 可以，但必须使用脱敏数据，不要上传真实手机号、身份证、客户姓名、订单号、Token 等敏感信息。
---

## Skill 是什么

Skill 是一种轻量能力，适合沉淀：

- 提示词模板
- 标准操作流程
- 业务分析方法
- 文档生成规范
- 客服话术
- 数据分析口径
- 周报、日报、复盘模板

Skill 不强调服务部署，它更像一份可以被模型理解和执行的“能力说明书”。

## 适用场景

适合使用 Skill 的场景：

| 场景 | 示例 |
| --- | --- |
| 文案生成 | 商品标题优化、客服回复、活动文案 |
| 分析模板 | 销售日报、周报复盘、经营分析 |
| 流程规范 | 审核流程、客服 SOP、运营检查清单 |
| 知识沉淀 | 产品知识、业务规则、常见问题 |
| 格式转换 | 将原始文本整理成 Markdown、JSON、表格 |

不适合使用 Skill 的场景：

| 场景 | 建议 |
| --- | --- |
| 需要实时查询数据库 | 使用 MCP Server |
| 需要调用内部系统 API | 使用 MCP Server |
| 需要读取或写入文件 | 使用 MCP Server |
| 需要执行代码逻辑 | 使用 MCP Server |

## ZIP 包结构

推荐结构：

```text
sales-report-skill.zip
├── SKILL.md
├── examples/
│   ├── input-example.md
│   └── output-example.md
└── assets/
    └── report-template.png
```

最小结构：

```text
sales-report-skill.zip
└── SKILL.md
```

## 文档ZIP 结构包
```text
instruction.zip
├── README.md
└── quick_start.md
```

建议至少包含：

| 文件 | 是否必需 | 说明                 |
| --- | --- |--------------------|
| SKILL.md | 必需 | 描述 Skill 的核心执行方式   |
| README.md | 推荐 | 说明能力包用途、目录结构、维护方式  |
| quick_start.md | 推荐 | 快速使用方式和调用方式说明      |
| examples/ | 推荐 | 保存输入输出示例           |
| assets/ | 可选 | 保存图片、流程图、模板截图等辅助材料 |

## SKILL.md 推荐结构

建议使用以下结构：

```markdown
# 销售日报分析 Skill

## 适用场景

说明这个 Skill 适合什么业务场景。

## 输入要求

说明用户需要提供哪些信息。

## 执行步骤

说明模型应该怎么处理任务。

## 输出格式

说明最终输出应该是什么样。

## 示例

提供输入示例和输出示例。

## 边界与限制

说明不能做什么、遇到不确定信息怎么处理。
```

## SKILL.md 完整示例

```markdown
# 销售日报分析 Skill

## 适用场景

适用于电商运营团队根据每日销售数据生成销售日报。

适合处理以下任务：

- 汇总 GMV、订单数、访客数、转化率等核心指标
- 识别同比、目标达成、异常波动
- 输出适合管理层阅读的日报结论
- 根据异常情况给出后续跟进建议

不适合处理以下任务：

- 预测未来长期销售趋势
- 直接修改数据库数据
- 直接决定活动预算
- 在缺少数据来源时编造结论

## 输入要求

用户应提供以下信息：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| 日期范围 | 是 | 本次分析对应的日期 |
| 销售数据 | 是 | GMV、订单数、访客数等 |
| 对比数据 | 否 | 同比、目标、历史均值 |
| 业务背景 | 否 | 活动、缺货、投放变化等说明 |

输入示例：

```json
{
  "dateRange": "2026-06-01 至 2026-06-18",
  "category": "耳机",
  "metrics": {
    "gmv": 866044.28,
    "orders": 3260,
    "visitors": 128900,
    "conversionRate": "2.53%"
  },
  "background": "新品 Air1S 首发期，站内搜索权重较低。"
}
```

## 执行步骤

请严格按以下步骤分析：

1. 先确认数据范围和分析对象。
2. 再汇总核心指标。
3. 对比目标、同期或历史数据。
4. 找出主要变化点。
5. 将异常情况和业务背景关联。
6. 输出结论和建议。

如果用户没有提供足够数据，应先说明缺少哪些字段，不要编造数据。

## 输出格式

请使用 Markdown 输出，结构如下：

```markdown
# 销售日报分析

## 1. 核心结论

用 2-3 句话说明整体表现。

## 2. 指标概览

| 指标 | 数值 | 说明 |
| --- | ---: | --- |
| GMV | xxx | xxx |
| 订单数 | xxx | xxx |

## 3. 主要变化

1. xxx
2. xxx
3. xxx

## 4. 风险与建议

| 问题 | 影响 | 建议 |
| --- | --- | --- |
| xxx | xxx | xxx |
```

## 边界与限制

- 不允许编造未提供的数据。
- 不允许把猜测写成确定结论。
- 不允许输出与企业内部数据无关的外部渠道结论。
- 如果数据明显异常，应提示用户复核数据源。
- 如果业务背景不足，应将结论标记为“基于当前数据初步判断”。
```

## README.md 示例

```markdown
# 销售日报分析 Skill

## 能力说明

该 Skill 用于帮助电商运营团队生成销售日报和异常分析。

## 目录结构

```text
.
├── SKILL.md
├── README.md
└── examples/
    ├── input-example.md
    └── output-example.md
```

## 使用方式

在能力市场中搜索“销售日报分析”，输入销售数据和业务背景后即可生成分析报告。

## 维护人

- 负责人：张三
- 部门：电商运营部
- 更新频率：按业务分析口径变化更新
```

## 提交检查项

上传前请确认：

- ZIP 包根目录存在 `SKILL.md`
- `SKILL.md` 不为空
- 输入要求和输出格式清晰
- 示例数据已脱敏
- 没有账号、密码、Token、Cookie
- 没有真实客户隐私数据
- 能力描述和 ZIP 内容一致