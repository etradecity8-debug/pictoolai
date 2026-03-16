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
├── docs/              # 全部详细文档，入口为 docs/README.md
├── src/
│   ├── App.jsx
│   ├── pages/         # DetailSet（组图）、ImageEdit（修改图片）、AmazonAPlus、AiAssistant（亚马逊 Listing）等
│   └── components/
├── server/
│   ├── index.js       # 注册/登录、分析、生图、仓库、image-edit、amazon-aplus、ai-assistant/amazon
│   ├── db.js          # SQLite、gallery、users、user_points、amazon_listing_snapshots 等
│   └── .env           # GEMINI_API_KEY、HTTPS_PROXY 等（从 .env.example 复制）
└── README.md          # 入口：快速开始 + 指向 docs
```

---

## 主要功能

| 功能 | 路由/入口 | 说明 |
|------|-----------|------|
| 全品类组图 | 电商生图 | 上传图 + 组图要求 → 分析 → 确认规划 → 生图，详见 `ECOMMERCE-GENERAL-CREATE-PICTURES.md` |
| 修改图片 | 修改图片 | 9 种模式（添加/移除、局部重绘、风格迁移、多图合成、高保真、草图生动、角色一致、文字替换/语言转换），`POST /api/image-edit` |
| AI 美工 | 导航「AI美工」 | 局部重绘、局部消除、一键换色、智能扩图、提升质感、**风格复刻**、官方示例；详见 `AI-DESIGNER.md` |
| 风格复刻 | AI美工 → 风格复刻 | 上传参考设计图（最多 14 张）+ 产品素材图 → 两阶段（分析风格 → 生图），`POST /api/style-clone`，路由 `/ai-designer/style-clone` |
| 亚马逊 A+ | A+ 页面 | 4 步：填写信息 → 确认文案 → 生成 4 张图 → 查看结果，`/api/amazon-aplus/analyze`、`/api/amazon-aplus/generate` |
| 亚马逊 Listing | 电商AI运营助手 → 亚马逊 | Step1 分析 → Step2 标题/五点/描述/关键词 → Step3 主图 → Step4 A+ 文案与图，详见 `ECOMMERCE-AI-ASSISTANT.md` |
| 仓库 | 侧栏「仓库」 | 生图成功即**自动入仓**；图片旁仅「保存到本地」便于快速存图（全站一致）。按日期分组，多选、批量保存到本地、批量删除；SQLite + `server/gallery/` |

---

## 本地运行要点

- 前端在**项目根**：`npm run dev`；后端在 **`server`**：`cd server && npm start`。
- 后端需 `.env` 中 `GEMINI_API_KEY`；需代理时设 `HTTPS_PROXY`。
- 数据库：首次使用自动创建 `server/pictoolai.db`；备份复制 `pictoolai.db` 与 `server/gallery/` 即可。

更多：部署见 `DEPLOY.md`，已知问题见 `KNOWN_ISSUES.md`。
