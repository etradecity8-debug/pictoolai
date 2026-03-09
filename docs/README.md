# 项目文档归档索引

本目录为 PicAITool 项目文档集中存放处，便于查阅与不丢失记忆。以下按用途分类。

---

## 产品与功能设计

| 文档 | 说明 |
|------|------|
| [AMAZON-LISTING-SPEC.md](./AMAZON-LISTING-SPEC.md) | 亚马逊 Listing 生成功能产品设计方案：输入/输出、类目、AI 流程、**亚马逊规则与合规**（7.1 标题～7.7 A+）、实现细节。 |
| [AMAZON-LISTING-IMAGE-PROMPTS.md](./AMAZON-LISTING-IMAGE-PROMPTS.md) | 亚马逊主图与 A+ 图片的提示词与准则；与官方要求对照及当前实现说明。 |
| [DATA-FLOW.md](./DATA-FLOW.md) | 全品类组图页的字段与 AI 传参说明、数据流。 |

---

## 运维与部署

| 文档 | 说明 |
|------|------|
| [DEPLOY.md](./DEPLOY.md) | 部署到腾讯云香港轻量的完整步骤（环境、上传代码、PM2、Nginx、验证）。 |
| [GEMINI-REGION-ISSUE.md](./GEMINI-REGION-ISSUE.md) | Gemini API 地区限制说明（香港等不支持时的处理思路）。 |

---

## 已知问题与待办

| 文档 | 说明 |
|------|------|
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 已知问题、待办、运营须知（数据隐私、仓库下载、A+ 迭代、积分/支付、部署优先级等）。 |

---

## 项目记忆入口

- 日常会话与约定见 **`.cursor/rules/project-context.mdc`**（关键文件、约定、待办不丢失记忆）。
- 本索引仅做文档归档，具体内容以各文档为准；有更新时请同步改本 README 的说明。
