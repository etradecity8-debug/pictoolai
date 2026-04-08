# 已知问题与待办

> **用途**：汇总能力边界、环境依赖、**待办**、**运营/隐私沟通**与运维快查。各功能深度说明见 [文档总索引](./README.md)。  
> **谁看哪块**：产品/商务 → §一 §三；排期 → §二；运维 → §四。

---

## 目录

- [一、已知问题](#一已知问题)
- [二、待办改进](#二待办改进)
- [三、运营须知：数据隐私与客户沟通](#三运营须知数据隐私与客户沟通)
- [四、快速参考](#四快速参考)
- [附录：历史变更摘要](#附录历史变更摘要)

---

## 一、已知问题

> 含：前台与能力边界（§1.1）、第三方与环境（§1.2）、已落实项备查（§1.3）。

### 1.1 前台入口与能力边界

**入口**：侵权检测、智能选品、A+（含亚马逊 Listing 第 4 步）默认**不在顶栏**；恢复方式见 [TEMPORARILY-HIDDEN-FEATURES.md](./TEMPORARILY-HIDDEN-FEATURES.md)（`src/lib/siteFeatures.js` · `SITE_NAV_HIDDEN`）。

| 项目 | 说明 |
|------|------|
| **智能选品（1688）** | **局限**：Daji 以图搜图对多数**亚马逊主图**在 1688 上常 **0 条或极少匹配**（货源非同款）。见 [1688-SUPPLIER-MATCHING.md](./1688-SUPPLIER-MATCHING.md)。须 `DAJI_APP_KEY` / `DAJI_APP_SECRET`；**生产已激活**。 |
| **侵权风险检测** | **局限**：公开检索 + AI 抽词，**大量产品/风险无法检出**，仅上架前粗筛；**非 FTO**。深度约 **20 积分/次**。机理见 [IP-RISK.md](./IP-RISK.md)。 |
| **A+** | **局限**：**当前形态与输出不符合客户实际需求**，宜按真实上架场景重做或弱化。独立页与 Listing **Step 4** 同开关；品牌/类目差异大。 |

### 1.2 环境与第三方服务

| 项目 | 说明 |
|------|------|
| **Daji** | **生产已激活**。新环境在 `server/.env` 配 `DAJI_APP_KEY`、`DAJI_APP_SECRET`；换钥后若提示「请创建应用…再激活」→ 联系 Daji（微信 openapi2019 / WhatsApp +8618820777181）。 |
| **其余密钥** | 与 **§4.3** 同表。部署步骤见 [DEPLOY.md](./DEPLOY.md)。 |

### 1.3 已落实能力（备查）

| 项目 | 说明 |
|------|------|
| 仓库 COS | 配 `COS_*` 后新图可走 COS → [DEPLOY.md](./DEPLOY.md) 第四节 |
| 选图代理 | 统一 `/api/gallery/image/:id`，避免 COS 跨域 |

---

## 二、待办改进

> 优先级与排期以业务为准。**「积分到期提醒」依赖「注册信息校验」**（须已验证邮箱/手机方可触达）。

### 2.1 功能类

| 优先级 | 项目 | 说明 |
|--------|------|------|
| 中 | 注册信息校验 | 邮箱：验证码或激活链接。手机（若做）：短信验证码。需邮件/短信通道、频控、过期、防刷。 |
| 低 | 支付接入 | 微信 / 支付宝自助下单 |
| 低 | 积分到期提醒 | 到期前 **3～7 天** **邮件或短信**；**以前项注册校验已完善为前提**。 |

### 2.2 体验与算法类

| 项目 | 说明 |
|------|------|
| **组图文字大小/字体** | 客户需求存在；现由 AI 按规范决定，未单独开放参数。 |
| **侵权检测 · 专利命名漏检** | 外观专利标题用词刁钻时仍可能漏检。**2026-04 已改进**（检索扩展、多路 Patents、报告结构等），见 [IP-RISK.md](./IP-RISK.md) 第十节。**根本局限**：关键词无法穷举所有专利表述。 |

---

## 三、运营须知：数据隐私与客户沟通

### 3.1 管理员可见数据

| 数据 | 可见 | 说明 |
|------|:----:|------|
| 账号邮箱 | ✅ | `users` |
| 密码 | ❌ | bcrypt |
| 积分与流水 | ✅ | `user_points` / `points_transactions` |
| 仓库生成图 | ✅ | 本地或 COS |
| 上传产品图（分析） | ❌ | 通常不落盘 |
| 用户输入文案 | ❌ | 不当次落库 |

### 3.2 建议话术

> 「平台方技术上可访问您账号下生成图与账户信息，但不会无故查看；与常见 SaaS 一致，信任靠约定与合规使用。」

### 3.3 高敏感场景

未上市款、核心外观、高保密设计 → **建议用毕后在仓库手动删图**。

---

## 四、快速参考

### 4.1 文档索引

[docs/README.md](./README.md)

### 4.2 常用运维

| 操作 | 链接 |
|------|------|
| 发版更新 | [DEPLOY.md §2](./DEPLOY.md) |
| 删用户与数据 | [DEPLOY.md §5](./DEPLOY.md) |
| SerpApi（侵权深度） | [DEPLOY.md §3](./DEPLOY.md) |
| 专利汇 | [DEPLOY.md](./DEPLOY.md) 相关小节 |

### 4.3 关键环境变量

| 变量 | 用途 |
|------|------|
| `GEMINI_API_KEY` | 必需 |
| `SERPAPI_KEY` | 侵权深度 |
| `PATENTHUB_TOKEN` | 专利汇（可选） |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 管理员 |
| `DAJI_APP_KEY` / `DAJI_APP_SECRET` | 1688 选品（生产已激活；异常再联系 Daji） |
| `COS_*` | 仓库 COS（可选） |

---

## 附录：历史变更摘要

> 一句话归档；实现细节见代码与各专项 md。

| 模块 | 摘要 |
|------|------|
| 侵权检测 | `/ip-risk`；快筛 + 深度 20 积分；入口默认隐藏 → [IP-RISK.md](./IP-RISK.md)、[TEMPORARILY-HIDDEN-FEATURES.md](./TEMPORARILY-HIDDEN-FEATURES.md) |
| 1688 选品 | 工具箱默认隐藏；匹配局限 §1.1 → [1688-SUPPLIER-MATCHING.md](./1688-SUPPLIER-MATCHING.md) |
| 电商助手 | 亚马逊 / eBay / 速卖通 Listing；A+ 随 `amazonAplus` → [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) |
| AI 美工 | [AI-DESIGNER.md](./AI-DESIGNER.md) |
| 仓库 | 生图入库、批量、「用AI编辑」带图；COS 可选 |
| 积分 | [PRICING-COST.md](./PRICING-COST.md)；`POINTS_MAP` 前后端两处同步（`server/points.js` + `src/lib/pointsConfig.js`；前端 `pointsEstimate.js` 引用 `pointsConfig.js`） |
| 管理后台 · 选图 · 组图（2026-03～24） | `Admin.jsx`、`loadGalleryImage.js`、[ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) |
| 其他 | 注册赠 150 积分（30 天）；删用户可再注册；打印 `npm run docs:print` |

---

*打印版：`npm run docs:print`（输出 `docs/print/`）。*
