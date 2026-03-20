# PicToolAI

对 PicSet AI 官网的前端复刻，品牌名 **PicToolAI**。React + Tailwind + Express，含登录/注册、电商生图（全品类组图）、修改图片、**电商AI运营助手 → 亚马逊 Listing 生成**、AI 美工、侵权风险检测等（亚马逊 A+ 暂不实现）。

---

## 快速开始

**两个终端**：前端 + 后端（后端必须在 `server` 目录下跑）。

```bash
# 终端一：前端（项目根目录）
npm install && npm run dev

# 终端二：后端（务必 cd 到 server）
cd server && npm install && npm start
```

- 前端默认 <http://localhost:5173>，后端 <http://localhost:3001>
- 在 `server` 下复制 `.env.example` 为 `.env`，填入 `GEMINI_API_KEY`；需代理时设 `HTTPS_PROXY`

---

## 详细文档（都在 docs 里）

| 类别     | 文档 |
|----------|------|
| **总索引** | [docs/README.md](docs/README.md) — 所有文档的目录，按「项目概览 / 产品设计 / 运维 / 已知问题 / 打印版」分类 |
| 项目与功能 | [PROJECT-OVERVIEW](docs/PROJECT-OVERVIEW.md)（结构、技术栈、组图/修改图片/A+/Listing/仓库） |
| 产品设计 | [ECOMMERCE-GENERAL-CREATE-PICTURES](docs/ECOMMERCE-GENERAL-CREATE-PICTURES.md)（电商组图）、[ECOMMERCE-AI-ASSISTANT](docs/ECOMMERCE-AI-ASSISTANT.md)（亚马逊）、[AI-DESIGNER](docs/AI-DESIGNER.md)（AI 美工） |
| 运维部署 | [DEPLOY](docs/DEPLOY.md)（含 Gemini 地区限制） |
| 已知问题 | [KNOWN_ISSUES](docs/KNOWN_ISSUES.md) |
| **打印** | 用浏览器打开 **`docs/print/index.html`**，可打印或另存 PDF；重新生成：`npm run docs:print` |

根目录只保留「项目是什么 + 怎么跑 + 文档在哪」；具体功能说明、项目结构、数据库、修改图片/A+ 细节等都在 **`docs/`** 里，由 [docs/README.md](docs/README.md) 统一索引。
