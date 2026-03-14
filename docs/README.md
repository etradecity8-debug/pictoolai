# PicToolAI 文档中心

**入口**：根目录 `README.md` 只有快速开始；所有详细说明都在本目录。

---

## 快速找文档

| 我想… | 看这个 |
|-------|--------|
| 了解项目整体、怎么跑起来 | [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) |
| 做电商组图、理解数据流 | [ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) |
| 做亚马逊 Listing、合规与生图 | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) |
| 用 AI 美工（局部重绘/消除/换色/扩图/提升质感） | [AI-DESIGNER.md](./AI-DESIGNER.md) |
| 用风格复刻（参考图+产品图→高转化详情图） | AI美工 → 风格复刻，路由 `/ai-designer/style-clone`，见 PROJECT-OVERVIEW |
| 部署到服务器、查地区限制 | [DEPLOY.md](./DEPLOY.md) |
| 查已知问题、待办 | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |

---

## 一、项目总览

| 文档 | 说明 |
|------|------|
| [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) | 技术栈、目录结构、主要功能一览、本地运行要点 |

---

## 二、电商生图

| 文档 | 说明 |
|------|------|
| [ECOMMERCE-GENERAL-CREATE-PICTURES.md](./ECOMMERCE-GENERAL-CREATE-PICTURES.md) | 电商生图（全品类组图）：字段、AI 传参、数据流 |

---

## 三、电商 AI 运营助手（亚马逊 · eBay · 速卖通）

| 文档 | 说明 |
|------|------|
| [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md) | 亚马逊 Listing 生成流程、合规规则、生图提示词、A+ 模块定义 |
| [ECOMMERCE-AI-ASSISTANT-EBAY.md](./ECOMMERCE-AI-ASSISTANT-EBAY.md) | eBay 模块：Cassini 搜索优化、标题 80 字符、Item Specifics |
| [ECOMMERCE-AI-ASSISTANT-ALIEXPRESS.md](./ECOMMERCE-AI-ASSISTANT-ALIEXPRESS.md) | 速卖通模块：标题 128 字符、产品属性、移动端描述 |

---

## 四、AI 美工

| 文档 | 说明 |
|------|------|
| [AI-DESIGNER.md](./AI-DESIGNER.md) | 局部重绘、局部消除、一键换色、智能扩图、提升质感、风格复刻、官方示例 9 种 |

---

## 五、运维与部署

| 文档 | 说明 |
|------|------|
| [DEPLOY.md](./DEPLOY.md) | VPS 部署步骤（含附录：Gemini 地区限制） |

---

## 六、已知问题与待办

| 文档 | 说明 |
|------|------|
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 已知问题、待办、运营须知 |

---

## 打印版

- **`docs/print/`**：上述 .md 已转为 HTML，打开 `docs/print/index.html` 可浏览并打印。
- 重新生成：项目根目录执行 `npm run docs:print`。
