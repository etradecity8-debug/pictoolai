# 项目文档索引

根目录 **README.md** 只做入口（项目简介 + 快速开始 + 本目录链接）。**所有详细文档都在本目录**，下面按用途分类。

---

## 项目与功能

| 文档 | 说明 |
|------|------|
| [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) | 项目结构、技术栈、主要功能一览（组图/修改图片/A+/亚马逊 Listing/仓库）、本地运行要点。 |
| [AMAZON-LISTING-SPEC.md](./AMAZON-LISTING-SPEC.md) | 亚马逊 Listing 生成功能产品设计方案：输入/输出、类目、AI 流程、**亚马逊规则与合规**（7.1 标题～7.7 A+）、实现细节。 |
| [AMAZON-LISTING-IMAGE-PROMPTS.md](./AMAZON-LISTING-IMAGE-PROMPTS.md) | 亚马逊主图与 A+ 图片的提示词与准则；与官方要求对照及当前实现说明。 |
| [AMAZON-APLUS-MODULES.md](./AMAZON-APLUS-MODULES.md) | A+ 模块定义、本系统支持的 17 种模块、推荐套餐与接口约定。 |
| [DATA-FLOW.md](./DATA-FLOW.md) | 全品类组图页的字段与 AI 传参说明、数据流。 |
| [AI-DESIGNER-RECOLOR.md](./AI-DESIGNER-RECOLOR.md) | AI 美工 · 一键换色：文字描述、色卡、自定义取色、批量生图。 |
| [MODEL-SELECTION-GUIDE.md](./MODEL-SELECTION-GUIDE.md) | 提升质感：Pro vs 2 模型选择指南、专家建议与详细对比。 |
| [AI-DESIGNER-TEXTURE-MATERIALS.md](./AI-DESIGNER-TEXTURE-MATERIALS.md) | 提升质感材质预设（4 Tab、23 项）与塑料专项增强（SSS、Soft-touch、Beveled edges）。 |
| [SMART-EXPANSION-PROMPTS.md](./SMART-EXPANSION-PROMPTS.md) | 智能扩图：官方 1+N 模板、内容延续、后续两轮调用优化方向。 |

---

## 运维与部署

| 文档 | 说明 |
|------|------|
| [DEPLOY.md](./DEPLOY.md) | VPS 部署步骤（通用；香港已暂停，下次可能改美国）。 |
| [GEMINI-REGION-ISSUE.md](./GEMINI-REGION-ISSUE.md) | Gemini API 地区限制说明（香港等不支持时的处理思路）。 |

---

## 已知问题与待办

| 文档 | 说明 |
|------|------|
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 已知问题、待办、运营须知（数据隐私、仓库下载、A+ 迭代、积分/支付、部署优先级等）。 |

---

## 打印版（HTML）

- **`docs/print/`**：所有上述 .md 已转为可打印的 HTML。用浏览器打开 **`docs/print/index.html`** 可看到目录，点击任一文档后按 **Ctrl+P**（Mac：⌘+P）打印。重新生成打印版请在项目根目录执行：`npm run docs:print`。

---

## 约定

- **外面**：只有根目录一个 `README.md`（简短入口）。
- **里面**：本目录 `docs/` 放全部详细文档，本文件是总索引。日常会话记忆见 `.cursor/rules/project-context.mdc`。
