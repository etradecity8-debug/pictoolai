# 项目概览（结构 + 功能）

根目录 README 只做入口；这里是项目结构与主要功能的简要说明。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite、React Router 6、Tailwind CSS |
| 后端 | Node.js、Express、JWT、bcrypt、SQLite（`server/db.js` + `pictoolai.db`） |
| AI | Google Gemini（分析：文+图→文；生图：Nano Banana / 2 / Pro） |

---

## 关键目录与文件

```
项目根/
├── docs/                  # 全部详细文档，入口为 docs/README.md
├── src/
│   ├── App.jsx
│   ├── pages/             # DetailSet（组图）、AiDesigner（AI美工）、AiAssistant（运营助手）、Admin（管理后台）等
│   ├── pages/ai-designer/ # 各 AI 美工子页面（局部重绘/消除/换色/扩图/场景/添加人物 等）
│   └── components/
├── server/
│   ├── index.js           # 注册/登录、分析、生图、仓库、image-edit、ai-assistant（Amazon/eBay/AliExpress/侵权）、管理员接口
│   ├── db.js              # SQLite：users、gallery、user_points、points_transactions、各平台 listing_snapshots
│   ├── points.js          # 积分规则、grantPoints、getBalance、grantSignupBonus
│   ├── gemini-models.js   # 生图模型 ID、分析模型 ID
│   └── .env               # GEMINI_API_KEY、SERPAPI_KEY（深度查询）、COS_*（可选）、ADMIN_EMAIL/PASSWORD
└── README.md              # 入口：快速开始 + 指向 docs
```

---

## 主要功能

| 功能 | 路由/入口 | 说明 |
|------|-----------|------|
| 全品类组图 | 通用电商生图 `/detail-set` | 上传图 + 5 个要求字段 + **5 种图片类型分别选张数**（白底主图/场景图/特写图/卖点图/交互图）→ 分析（按类型生成规划）→ 确认规划 → 按类型差异化生图，详见 `ECOMMERCE-GENERAL-CREATE-PICTURES.md` |
| 亚马逊 Listing | 电商AI运营助手 → 亚马逊 | 生成/优化/竞品/关键词；Step1 分析 → Step2 文案 → Step3 主图，详见 `ECOMMERCE-AI-ASSISTANT.md` |
| eBay Listing | 电商AI运营助手 → eBay | 生成/优化；Cassini、80 字符标题、Item Specifics，详见 `ECOMMERCE-AI-ASSISTANT.md` 第七部分 |
| 速卖通 Listing | 电商AI运营助手 → 速卖通 | 生成/优化；128 字符标题、产品属性，详见 `ECOMMERCE-AI-ASSISTANT.md` 第八部分 |
| 侵权风险检测 | 导航「侵权风险检测」`/ip-risk` | 免费快筛（Gemini）/ 深度查询（SerpApi：Lens+Patents+商标+IP角色版权，20 积分）；`POST /api/ai-assistant/ip-risk-check` |
| AI 美工 | 导航「AI美工」`/ai-designer` | 局部重绘、局部消除、一键换色、智能扩图、提升质感、添加人/物、**生成场景（多场景批量，最多6个）**、风格复刻、文字修改（替换/语言转换/去除）、水印、官方示例 |
| 官方示例 | AI美工 → 官方示例 | 7 种模式（添加/移除、局部重绘、风格迁移、多图合成、高保真、草图生动、角色一致），`POST /api/image-edit`；文字替换、语言转换、文字去除在「文字修改」下 |
| 风格复刻 | AI美工 → 风格复刻 | 参考图（最多 14 张）+ 产品图 → 两阶段（分析风格 → 生图），`POST /api/style-clone` |
| 亚马逊 A+ | **暂不实现**（`/amazon-aplus` 路由与页面存在，导航已隐藏） | 4 步：填写信息 → 确认文案 → 生成 4 张图 → 查看结果 |
| 仓库 | 侧栏「仓库」`/dashboard/gallery` | 生图成功即**自动入仓**；多选、批量保存/删除；每张图可「用AI编辑」跳转 AI 美工并自动带图 |
| Listing 历史 | 侧栏「Listing 历史」`/dashboard/listings` | 已保存的 Listing 快照，支持查看/删除 |
| 管理后台 | `/admin`（仅 admin 角色） | 用户列表、充值积分、查流水、编辑备注、删除用户（含图片与所有数据），详见 `DEPLOY.md` 第五节 |

---

## 本地运行要点

- 前端在**项目根**：`npm run dev`；后端在 **`server`**：`cd server && npm start`。
- 后端需 `.env` 中 `GEMINI_API_KEY`；需代理时设 `HTTPS_PROXY`；开放深度查询需 `SERPAPI_KEY`。
- 数据库：首次使用自动创建 `server/pictoolai.db`；备份只需复制 `server/pictoolai.db` 与 `server/gallery/` 即可。
- 管理员账号：在 `server/.env` 中配置 `ADMIN_EMAIL` + `ADMIN_PASSWORD`，启动时自动创建/提升为 admin。

更多：部署与每次更新上线见 [DEPLOY.md](./DEPLOY.md)；已知问题见 [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)。
