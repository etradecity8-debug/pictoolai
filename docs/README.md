# PicToolAI 文档中心

> 所有详细说明都在本目录（`docs/`）。根目录 `README.md` 只做快速开始入口。

---

## 快速找文档（按「我想做什么」查）

### 项目与功能

| 我想… | 看这里 |
|-------|--------|
| 了解项目整体结构、技术栈、怎么本地跑起来 | [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) |
| 做电商组图（全品类），理解字段与 AI 传参 | [ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) |
| 做亚马逊 Listing（生成/优化/竞品/关键词）、合规规则（A+ 暂不实现） | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) — 第一至六部分 |
| 做 eBay Listing（80字符标题、Item Specifics、Cassini） | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) — 第七部分 |
| 做速卖通 Listing（128字符标题、产品属性、移动端描述） | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) — 第八部分 |
| 了解侵权风险检测（功能/费用/漏检分析/外部数据源可行性） | [IP-RISK.md](./IP-RISK.md) |
| 用 AI 美工（局部重绘/消除/换色/扩图/提升质感/添加人物/风格复刻） | [AI-DESIGNER.md](./AI-DESIGNER.md) |

### 运维与部署

| 我想… | 看这里 |
|-------|--------|
| **首次**把项目部署到服务器（VPS 安装/克隆/配置/启动） | [DEPLOY.md](./DEPLOY.md) — 第一节 |
| **每次**发版更新线上（git push → 服务器 pull/build/restart） | [DEPLOY.md](./DEPLOY.md) — 第二节 |
| 配置 SerpApi，开放侵权风险深度查询 | [DEPLOY.md](./DEPLOY.md) — 第三节 |
| 配置腾讯云 COS 加速仓库图片（国内访问快） | [DEPLOY.md](./DEPLOY.md) — 第四节 |
| 删除用户及用户数据（管理后台 / 服务器 SQL） | [DEPLOY.md](./DEPLOY.md) — 第五节 |
| 查看用户列表、sqlite3 卡住出不去 | [DEPLOY.md](./DEPLOY.md) — 第五节 5.4、5.2 |

### 其他

| 我想… | 看这里 |
|-------|--------|
| 查已知问题、功能待办、数据隐私说明 | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| 了解积分规则、API 成本、盈利分析（内部） | [PRICING-COST.md](./PRICING-COST.md) |
| 对外介绍网站功能（发给客户/推广文案） | [PRODUCT-INTRO.md](./PRODUCT-INTRO.md) |

---

## 文档目录（按类型）

| 类型 | 文件 | 内容 |
|------|------|------|
| 概览 | [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) | 技术栈、目录结构、主要功能一览、本地运行要点 |
| 功能 | [ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) | 全品类组图：5 个输入字段、AI 传参、分析→确认→生图数据流 |
| 功能 | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) | AI 运营助手：亚马逊（第1-6部分）+ eBay（第7部分）+ 速卖通（第8部分） |
| 功能 | [IP-RISK.md](./IP-RISK.md) | 侵权风险检测：功能、费用、漏检分析、外部数据源集成可行性（含专利汇/美国版权局） |
| 功能 | [AI-DESIGNER.md](./AI-DESIGNER.md) | AI 美工：局部重绘/消除/换色/扩图/提升质感/添加人物/服装3D/生成场景/风格复刻/文字修改/官方示例 |
| 运维 | [DEPLOY.md](./DEPLOY.md) | 运维手册：首次部署 + 每次更新 + SerpApi + COS + 用户管理（删除/查询/SQL） + Gemini 地区限制 |
| 参考 | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 已知问题、功能待办、数据隐私说明 |
| 参考 | [PRICING-COST.md](./PRICING-COST.md) | 积分规则、API 成本核算、固定成本、盈利分析（内部参考） |
| 对外 | [PRODUCT-INTRO.md](./PRODUCT-INTRO.md) | 网站功能介绍（对外宣传，可直接发给客户） |
| — | [README.md](./README.md)（本文件） | 文档总索引 |
