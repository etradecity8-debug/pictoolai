# PicToolAI

专为跨境电商卖家打造的 AI 视觉与运营一体化平台。依托 Google Gemini Nano Banana 系列模型，提供全品类组图、AI 美工、Listing 生成/优化、侵权风险检测等能力。

**品牌**：PicToolAI  
**网址**：https://pictoolai.studio

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **通用电商生图** | 上传产品图 + 填写要求 → AI 分析规划 → 批量生成白底主图、场景图、特写图、卖点图、交互图 |
| **AI 美工** | 局部重绘/消除/换色、智能扩图、提升质感、服装 3D/平铺/调整身材、生成场景、添加人/物、文字修改、风格变迁、水印 |
| **电商 AI 运营助手** | 亚马逊/eBay/速卖通：生成 Listing、优化 Listing、竞品对比、关键词研究、A/B 变体、智能粘贴 |
| **侵权风险检测** | 免费快筛（Gemini）+ 深度查询（Google Lens、Patents、商标、专利汇，20 积分/次） |

---

## 快速开始

### 环境要求

- Node.js 20+
- Gemini API Key（[Google AI Studio](https://aistudio.google.com/) 申请）

### 启动方式

**两个终端分别运行前端和后端**（后端必须在 `server` 目录下运行以正确加载配置）：

```bash
# 终端一：前端（项目根目录）
npm install && npm run dev

# 终端二：后端（务必 cd 到 server）
cd server
cp .env.example .env    # 首次需配置
npm install && npm start
```

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>

### 端口被占用时

若启动时报 `EADDRINUSE: address already in use :::3001`（或 5173），说明该端口已被占用，可先结束占用的进程：

```bash
# 查看占用端口的进程
lsof -i :3001

# 结束该进程（替换 PID 为实际进程号）
kill -9 <PID>

# 或一行命令直接结束
lsof -ti :3001 | xargs kill -9
```

前端端口 5173 同理：`lsof -ti :5173 | xargs kill -9`。

### 首次配置

在 `server/.env` 中至少配置：

```
GEMINI_API_KEY=你的API_Key
ADMIN_EMAIL=管理员邮箱
ADMIN_PASSWORD=管理员密码
```

- 需代理访问 Gemini 时：添加 `HTTPS_PROXY=http://127.0.0.1:7890`
- 开放侵权深度查询：添加 `SERPAPI_KEY=你的SerpApi密钥`（见 [DEPLOY.md](docs/DEPLOY.md) 第三节）
- 专利汇中国专利检索：添加 `PATENTHUB_TOKEN=你的TOKEN`（可选）

---

## 文档

| 类别 | 文档 |
|------|------|
| **总索引** | [docs/README.md](docs/README.md) — 按「我想做什么」查文档 |
| **项目概览** | [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) — 技术栈、目录结构、功能一览 |
| **产品设计** | [ECOMMERCE-GENERAL-CREATE-PICTURES](docs/ECOMMERCE-GENERAL-CREATE-PICTURES.md)、[ECOMMERCE-AI-ASSISTANT](docs/ECOMMERCE-AI-ASSISTANT.md)、[AI-DESIGNER](docs/AI-DESIGNER.md) |
| **运维部署** | [DEPLOY](docs/DEPLOY.md) |
| **已知问题** | [KNOWN_ISSUES](docs/KNOWN_ISSUES.md) |
| **打印版** | 浏览器打开 `docs/print/index.html` 可打印；重新生成：`npm run docs:print` |
