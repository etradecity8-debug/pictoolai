# PicToolAI 文档中心

> 所有详细说明都在本目录（`docs/`）。根目录 `README.md` 仅做项目入口与快速开始。

---

## 快速找文档（按「我想做什么」查）

### 了解项目

| 我想… | 看这里 |
|-------|--------|
| 了解项目整体结构、技术栈、目录、功能一览、数据库、API | [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) |
| 快速本地跑起来 | 根目录 [README.md](../README.md) — 快速开始 |

### 使用功能

| 我想… | 看这里 |
|-------|--------|
| 做全品类电商组图，理解 5 个输入字段、5 种图片类型、AI 传参 | [ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) |
| 做亚马逊 Listing（生成/优化/竞品/关键词）、合规规则 | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) — 一、亚马逊 |
| 做 eBay Listing（80 字符标题、Item Specifics、Cassini） | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) — 二、eBay |
| 做速卖通 Listing（128 字符标题、产品属性） | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) — 三、速卖通 |
| 用 AI 美工（局部重绘/消除/换色/扩图/提升质感/添加人物/生成场景/风格复刻/文字修改） | [AI-DESIGNER.md](./AI-DESIGNER.md) |
| 浏览器扩展（右键带图、替换原网页） | [BROWSER-EXTENSION.md](./BROWSER-EXTENSION.md) |
| 了解侵权风险检测（功能/实现原理/费用/漏检/外部数据源） | [IP-RISK.md](./IP-RISK.md) |
| 了解 1688 智能选品匹配方案（卖家精灵→自动匹配供应商→利润核算） | [1688-SUPPLIER-MATCHING.md](./1688-SUPPLIER-MATCHING.md) |

### 运维与部署

| 我想… | 看这里 |
|-------|--------|
| **首次**把项目部署到服务器 | [DEPLOY.md](./DEPLOY.md) — 第一节 |
| **每次**发版更新线上 | [DEPLOY.md](./DEPLOY.md) — 第二节 |
| 配置 SerpApi，开放侵权深度查询 | [DEPLOY.md](./DEPLOY.md) — 第三节 |
| 配置腾讯云 COS 加速仓库图片 | [DEPLOY.md](./DEPLOY.md) — 第四节 |
| 删除用户及用户数据、查看用户列表、sqlite3 操作 | [DEPLOY.md](./DEPLOY.md) — 第五节 |

### 参考与对外

| 我想… | 看这里 |
|-------|--------|
| 查已知问题、功能待办、数据隐私说明 | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| 了解积分规则、API 成本、盈利分析（内部） | [PRICING-COST.md](./PRICING-COST.md) |
| 对外介绍网站功能（发给客户/推广） | [PRODUCT-INTRO.md](./PRODUCT-INTRO.md) |

---

## 文档目录（按类型）

| 类型 | 文件 | 内容 |
|------|------|------|
| 概览 | [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) | 技术栈、目录结构、功能与路由、数据库、API、环境变量 |
| 功能 | [ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) | 全品类组图：5 个输入字段、AI 传参、分析→确认→生图 |
| 功能 | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) | 电商 AI 助手：亚马逊（一）、eBay（二）、速卖通（三） |
| 功能 | [AI-DESIGNER.md](./AI-DESIGNER.md) | AI 美工：图片编辑、质量提升、文字修改、风格变迁、水印、官方示例 |
| 功能 | [BROWSER-EXTENSION.md](./BROWSER-EXTENSION.md) | Chromium 扩展：右键带图、路由、与站内模块对应关系 |
| 功能 | [IP-RISK.md](./IP-RISK.md) | 侵权风险检测：功能、实现原理、费用、漏检分析、外部数据源 |
| 方案 | [1688-SUPPLIER-MATCHING.md](./1688-SUPPLIER-MATCHING.md) | 1688 智能选品匹配：卖家精灵表格→自动匹配供应商→利润核算 |
| 运维 | [DEPLOY.md](./DEPLOY.md) | 首次部署、每次更新、SerpApi、COS、用户管理、Gemini 地区限制 |
| 参考 | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 已知问题、待办改进、运营须知（数据隐私） |
| 参考 | [PRICING-COST.md](./PRICING-COST.md) | 积分规则、API 成本、固定成本、盈利分析 |
| 对外 | [PRODUCT-INTRO.md](./PRODUCT-INTRO.md) | 网站功能介绍（可直接发给客户） |
| — | [README.md](./README.md)（本文件） | 文档总索引 |

---

## 打印版

- **位置**：`docs/print/` 目录
- **入口**：浏览器打开 `docs/print/index.html` 可浏览、打印或另存 PDF
- **重新生成**：项目根目录执行 `npm run docs:print`（会遍历 `docs/*.md` 生成对应 HTML）

---

## 文档约定

- **根目录 README**：只做项目入口、快速开始、文档索引，不写长说明
- **详细文档均在 docs/**：产品设计、运维、已知问题等一律在 `docs/*.md`
- **新增文档**：在 `docs/README.md` 对应分类下补充索引
