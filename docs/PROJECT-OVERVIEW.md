# PicToolAI 项目概览

> 技术栈、目录结构、功能一览、数据与配置。详细设计见各专项文档。

---

## 一、项目简介

**PicToolAI** 是专为跨境电商卖家打造的 AI 视觉与运营平台，覆盖产品图生成、图片精修、Listing 创作、侵权风险检测等全流程。核心能力基于 Google Gemini 多模态模型（Nano Banana / Nano Banana 2 / Nano Banana Pro）。

**技术架构**：前后端分离，React 18 + Vite 前端，Express 后端，SQLite 数据库，JWT 认证。

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18、Vite、React Router 6、Tailwind CSS | SPA，打包输出至 `dist/` |
| 后端 | Node.js、Express | 单体 API 服务 |
| 认证 | JWT、bcrypt | 登录态存 localStorage，密钥可配 `JWT_SECRET` |
| 数据库 | SQLite（better-sqlite3） | `server/pictoolai.db`，单文件 |
| AI | Google Gemini | 分析：`gemini-2.5-flash`；生图：Nano Banana / 2 / Pro |
| 外部服务 | SerpApi、专利汇、DajiAPI | 侵权深度查询、智能选品 1688 搜索（可选） |

---

## 三、目录结构

```
项目根/
├── docs/                     # 全部文档，入口 docs/README.md
│   ├── README.md             # 文档总索引
│   ├── PROJECT-OVERVIEW.md   # 本文件
│   ├── ECOMMERCE-GENERAL-CREATE-PICTURES.md
│   ├── ECOMMERCE-AI-ASSISTANT.md
│   ├── AI-DESIGNER.md
│   ├── BROWSER-EXTENSION.md
│   ├── IP-RISK.md
│   ├── 1688-SUPPLIER-MATCHING.md
│   ├── DEPLOY.md
│   ├── KNOWN_ISSUES.md
│   ├── TEMPORARILY-HIDDEN-FEATURES.md
│   ├── PRICING-COST.md
│   ├── PRODUCT-INTRO.md
│   ├── USER-MANUAL.md
│   ├── images/               # 文档配图（如 user-manual 截图）
│   └── print/                # 打印版 HTML，npm run docs:print 生成
├── browser-extension/        # Chromium MV3 扩展源码
├── public/                   # 静态资源（demo 图、logo、扩展 zip 等）
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── pages/                # 页面组件
│   │   ├── DetailSet.jsx     # 通用电商生图（全品类组图）
│   │   ├── AiDesigner.jsx    # AI 美工入口
│   │   ├── ai-designer/      # AI 美工各子页（LocalRedraw、SmartExpansion 等）
│   │   ├── ImageEdit.jsx     # 修改图片（10 种模式）
│   │   ├── AiAssistant.jsx   # 电商 AI 运营助手
│   │   ├── AmazonAPlus.jsx   # 亚马逊 A+ 页面生成（独立流程）
│   │   ├── IpRisk.jsx        # 侵权风险检测
│   │   ├── AiToolbox.jsx     # AI 电商工具箱入口
│   │   ├── ai-toolbox/       # 智能选品（SupplierMatching）
│   │   ├── StyleClone.jsx    # 风格复刻
│   │   ├── Admin.jsx         # 管理后台
│   │   └── dashboard/        # Gallery、ListingHistory
│   ├── components/
│   │   ├── layout/           # Header、DashboardLayout 等
│   │   ├── OutputSettings.jsx # 输出设置（模型/比例/清晰度）
│   │   ├── GalleryThumb.jsx  # 从作品库选择缩略图
│   │   └── ...
│   ├── lib/
│   │   ├── siteFeatures.js       # SITE_NAV_HIDDEN（前台隐藏开关）
│   │   ├── pointsConfig.js       # POINTS_MAP、SUBSCRIPTION_PLANS（前端唯一定义）
│   │   ├── pointsEstimate.js     # 积分预估（引用 pointsConfig）
│   │   ├── loadGalleryImage.js   # 从仓库 URL 加载图片
│   │   ├── clarityByModel.js     # 模型与清晰度
│   │   ├── aspectByModel.js      # 模型与比例
│   │   └── exportListingCsv.js   # 导出 CSV/JSON
│   └── context/AuthContext.jsx
├── server/
│   ├── index.js              # 主入口：注册/登录、分析、生图、仓库、image-edit、ai-assistant、ip-risk、supplier-matching、admin
│   ├── daji.js               # DajiAPI：上传图片、以图搜图
│   ├── supplier-matching.js  # 智能选品：解析 Excel、以图搜图、利润核算（无关键词兜底）
│   ├── db.js                 # SQLite 表结构与初始化
│   ├── points.js             # 积分规则、getBalance、grantPoints、grantSignupBonus
│   ├── gemini-models.js      # 生图模型 ID、分析模型 ID
│   ├── gallery/              # 图片文件存储（未配 COS 时）
│   ├── .env                  # 环境变量（从 .env.example 复制）
│   └── pictoolai.db          # SQLite 数据库（首次运行自动创建）
├── scripts/md-to-print-html.js
├── package.json
└── README.md
```

---

## 四、功能与路由

### 4.1 主导航

**当前前台展示**（始终可见）：通用电商生图、AI 美工、电商 AI 运营助手、订阅、联系我们。浏览器扩展：**用户**在顶栏下载 `pictoolai-browser-extension.zip`（`public/` 静态文件），无需运营单独发送。

**暂时隐藏**（顶栏无入口，访问路径重定向首页；实现与文档仍保留）：侵权风险检测、AI 电商工具箱（智能选品）、A+ 页面；亚马逊「生成 Listing」同步不展示第 4 步。详见 [TEMPORARILY-HIDDEN-FEATURES.md](./TEMPORARILY-HIDDEN-FEATURES.md)，开关为 `src/lib/siteFeatures.js` 的 `SITE_NAV_HIDDEN`。

| 功能 | 路由 | 说明 |
|------|------|------|
| 通用电商生图 | `/detail-set` | 全品类组图：5 种图片类型分别选张数，分析→确认→生图 |
| AI 美工 | `/ai-designer`、`/ai-designer/:toolId` | 局部重绘/消除/换色、智能扩图、提升质感、服装 3D/平铺/调整身材、生成场景、添加人/物、文字修改、风格变迁、水印、官方示例 |
| 电商 AI 运营助手 | `/ai-assistant` | 亚马逊/eBay/速卖通：生成 Listing、优化 Listing、竞品对比、关键词研究；**Step 4 A+ 随 `SITE_NAV_HIDDEN.amazonAplus` 关闭** |
| A+ 页面 | `/amazon-aplus` | 独立 A+ 流程（隐藏时重定向 `/`） |
| AI 电商工具箱 | `/ai-toolbox`、`/ai-toolbox/supplier-matching` | 智能选品（隐藏时重定向 `/`） |
| 侵权风险检测 | `/ip-risk` | 快筛 + 深度查询（隐藏时重定向 `/`） |
| 订阅 | `/pricing` | 定价与套餐 |
| 联系我们 | `/contact` | 微信联系方式 |

### 4.2 侧栏 / 工作台

| 功能 | 路由 | 说明 |
|------|------|------|
| 仓库 | `/dashboard/gallery` | 生图自动入仓，多选批量保存/删除，每张可「用AI编辑」跳转 |
| Listing 历史 | `/dashboard/listings` | 已保存 Listing，支持查看/删除/导出 CSV |

### 4.3 管理后台

| 功能 | 路由 | 权限 |
|------|------|------|
| 管理后台 | `/admin` | 仅 admin 角色 |

### 4.4 功能明细

| 模块 | 子功能 | 说明 |
|------|--------|------|
| **通用电商生图** | 5 种图片类型 | 白底主图、场景图、特写图、卖点图、交互图，各 0～4 张（卖点图最多 5 张） |
| **AI 美工** | 图片编辑 | 局部重绘、局部消除、一键换色、服装 3D、服装平铺、调整身材、生成场景、添加人/物 |
| | 质量提升 | 智能扩图、提升质感 |
| | 文字修改 | 文字替换、语言转换、文字去除 |
| | 风格变迁 | 风格复刻、风格改变 |
| | 水印 | 添加水印、去除水印（`/ai-designer/watermark-remove`） |
| | 官方示例 | 7 种修改图片模式（去除水印归「水印」分类） |
| **亚马逊** | 生成 Listing | Step 1 分析 → Step 2 文案 → Step 3 产品图 → Step 4 A+（随前台隐藏配置关闭时不展示） |
| | 优化 Listing | 诊断 + 优化，A9/Cosmo/Rufus/GEO，合规自检 9 类 |
| | 竞品对比 | 1～5 个竞品，关键词/卖点/策略分析 |
| | 关键词研究 | 核心词、长尾词、后台关键词、标题排布 |
| | A/B 变体 | 2～3 套不同策略文案 |
| **eBay / 速卖通** | 生成/优化 | 平台专属算法与规则 |
| **侵权检测** | 快筛 / 深度 | 接口保留；前台隐藏时无导航入口，见 [TEMPORARILY-HIDDEN-FEATURES.md](./TEMPORARILY-HIDDEN-FEATURES.md) |
| **AI 电商工具箱** | 智能选品 | 接口保留；**匹配效果局限**见 [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) 1.1 |
| **A+** | 独立页 + Listing Step 4 | 接口保留；与 `SITE_NAV_HIDDEN.amazonAplus` 联动 |

---

## 五、数据库

**SQLite**，文件 `server/pictoolai.db`。表结构由 `server/db.js` 启动时自动创建/迁移。

| 表 | 说明 |
|------|------|
| users | 用户账号（email、password_hash、role、admin_notes） |
| gallery | 仓库图片元数据（id、user_email、file_path、points_used 等） |
| user_points | 积分余额、到期时间 |
| points_transactions | 积分流水 |
| amazon_listing_snapshots | 亚马逊 Listing 快照 |
| ebay_listing_snapshots | eBay Listing 快照 |
| aliexpress_listing_snapshots | 速卖通 Listing 快照 |
| supplier_matching_reports | 智能选品报告历史 |

图片文件：未配 COS 时存 `server/gallery/`；配置 COS 后新图上传腾讯云，数据库存 `cos_key`。

---

## 六、环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| GEMINI_API_KEY | ✅ | Gemini API 密钥 |
| ADMIN_EMAIL | ✅ | 管理员邮箱，启动时自动提升 |
| ADMIN_PASSWORD | ✅ | 管理员密码 |
| JWT_SECRET | 建议 | 生产环境设随机长字符串 |
| HTTPS_PROXY | 可选 | 代理访问 Gemini（如 `http://127.0.0.1:7890`） |
| SERPAPI_KEY | 深度查询 | 侵权深度查询必需 |
| PATENTHUB_TOKEN | 可选 | 专利汇中国+全球专利检索 |
| COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION | 可选 | 腾讯云 COS 仓库加速 |
| DAJI_APP_KEY / DAJI_APP_SECRET | 智能选品 | DajiAPI 1688 搜索，未配置则智能选品不可用 |
| GEMINI_ANALYSIS_MODEL | 可选 | 覆盖分析模型（默认 gemini-2.5-flash） |

---

## 七、主要 API

| 分类 | 路径 | 说明 |
|------|------|------|
| 认证 | POST /api/register, /api/login | 注册、登录 |
| 组图 | POST /api/detail-set/analyze, /api/detail-set/generate | 分析、生图 |
| 图片编辑 | POST /api/image-edit | 修改图片（mode: inpainting/add-remove/recolor 等） |
| 风格复刻 | POST /api/style-clone | 两阶段生图 |
| 仓库 | GET/POST/DELETE /api/gallery/* | 列表、上传、删除、下载 |
| 亚马逊 | POST /api/ai-assistant/amazon/* | analyze、generate-listing、optimize-listing、competitor-compare、keyword-research、generate-variants |
| eBay | POST /api/ai-assistant/ebay/* | analyze、generate-listing、optimize-listing |
| 速卖通 | POST /api/ai-assistant/aliexpress/* | 同上 |
| 侵权 | POST /api/ai-assistant/ip-risk-check | 快筛/深度查询 |
| 智能选品 | POST /api/supplier-matching/parse, /start, /save | 解析 Excel、启动分析、保存报告 |
| | GET /api/supplier-matching/task/:id, /reports, /reports/:id | 任务进度、历史报告 |
| | DELETE /api/supplier-matching/reports/:id | 删除报告 |
| 智能粘贴 | POST /api/ai-assistant/smart-paste | 从粘贴文本提取 Listing 字段 |
| 管理员 | GET/POST/DELETE/PATCH /api/admin/users/* | 用户列表、充值、删除、备注、冻结/解冻 |

---

## 八、本地运行

```bash
# 终端一：前端
npm install && npm run dev

# 终端二：后端
cd server
cp .env.example .env   # 配置 GEMINI_API_KEY 等
npm install && npm start
```

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>

**首次使用**：数据库自动创建；新用户注册送 150 积分（30 天）；配置 `ADMIN_EMAIL` 后该账号自动为管理员。

---

## 九、部署与运维

- **首次部署**：见 [DEPLOY.md](./DEPLOY.md) 第一节（VPS 环境、克隆、配置、Nginx、PM2）
- **每次更新**：见 [DEPLOY.md](./DEPLOY.md) 第二节（git pull、build、restart）
- **当前线上**：美国硅谷，域名 pictoolai.studio，HTTPS 已启用

---

## 十、相关文档

见 [docs/README.md 文档总索引](./README.md)。
