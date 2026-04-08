# 前台暂时隐藏的功能（与代码对齐）

> **当前状态**：以下能力**仍保留后端接口与页面实现**，但**网站顶栏无入口**，用户直接访问原路径会**重定向首页**。恢复展示时只需改一处配置。

**代码唯一开关**：`src/lib/siteFeatures.js` 中的 `SITE_NAV_HIDDEN`（各字段为 `true` 表示隐藏）。

| 开关字段 | 前台表现 | 原路径 | 专项文档 |
|----------|----------|--------|----------|
| `ipRisk` | 不显示「侵权风险检测」 | `/ip-risk` | [IP-RISK.md](./IP-RISK.md) |
| `aiToolboxSupplier` | 不显示「AI 电商工具箱」 | `/ai-toolbox`、`/ai-toolbox/supplier-matching` | [1688-SUPPLIER-MATCHING.md](./1688-SUPPLIER-MATCHING.md) |
| `amazonAplus` | 不显示「A+ 页面」；亚马逊「生成 Listing」**不展示第 4 步** | `/amazon-aplus` | [ECOMMERCE-AI-ASSISTANT.md](./ECOMMERCE-AI-ASSISTANT.md)（A+ 模块）、独立页 `AmazonAPlus.jsx` |

**说明**：

- **定价页**：隐藏侵权入口时，积分表中不再列出「侵权风险检测」行；套餐文案中的「全功能」描述与「哪些功能免费」FAQ 与当前开放能力一致。
- **Listing 历史**：若用户曾在开放期间保存过含 A+ 字段的快照，详情页仍可展示（只读），与是否隐藏入口无关。
- **其他已删除能力**（如服装组图、一键智能产品精修等）不在本表：相关路由与页面已从仓库移除，仅保留本表三项的「隐藏」策略。

**运维**：SerpApi、Daji、A+ 相关环境变量与部署说明仍见 [DEPLOY.md](./DEPLOY.md)；功能隐藏不等于停用服务端逻辑。
