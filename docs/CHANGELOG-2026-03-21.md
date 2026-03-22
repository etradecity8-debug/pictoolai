# 2026-03-21 工作摘要

## 一、今日工作：Daji 1688 关键词搜索调试

### 1. 问题排查与修复

| 问题 | 原因 | 处理 |
|------|------|------|
| `No message available` 错误 | 仅打印 `err.message`，Daji 返回结构不同 | 增强错误日志，解析 `json.detail` |
| HTTP 404 | 接口路径错误 | 将 `/alibaba/product/search` 改为 `/alibaba/product/keywordQuery` |
| HTTP 400 | 签名或参数问题 | 按 doc-4543198 调整：移除 sign、仅排除 null、UTF-8 编码 |
| 400 详情不可见 | 未打印响应 body | 4xx 时打印完整响应 |
| 「请创建应用，再联系平台进行激活」 | Daji AppKey 未激活 | 文档补充激活说明 |

### 2. 代码改动（server/daji.js）

- 关键词搜索路径：`/alibaba/product/keywordQuery`
- 签名：`delete copy.sign`、仅排除 `null`、`update(str, 'utf8')`
- 错误处理：解析 `json.detail`，4xx 时输出完整 body

### 3. 当前状态

- 路径与签名已修正，等待 Daji AppKey 激活后再联调

---

## 二、文档与代码一致性检查

### 1. 1688-SUPPLIER-MATCHING.md

- 补充 Daji 激活说明（微信 openapi2019、WhatsApp）
- 明确实现：关键词搜索已实现，以图搜图待扩展（表格主图为亚马逊 CDN，Daji 以图搜图仅支持 1688 域名）
- 流程说明：③b 改为「当前仅用关键词通道」

### 2. 受影响文档同步更新

| 文档 | 更新内容 |
|------|----------|
| **KNOWN_ISSUES.md** | 新增 1.3 配置与依赖（Daji 激活）、1688 文档索引、DAJI 环境变量、历史摘要 |
| **DEPLOY.md** | DAJI 配置处增加激活说明 |
| **server/.env.example** | DAJI 配置处增加激活说明 |
| **PRODUCT-INTRO.md** | 新增第 4 模块「AI 电商工具箱」、智能选品简介、积分用量 |
| **project-context.mdc** | 加入 AiToolbox、SupplierMatching、daji.js、supplier-matching.js、supplier_matching_reports、DAJI 配置、近期大改说明 |

### 3. 打印版

- 已执行 `npm run docs:print`，全部文档重新生成

---

## 三、复查（用户激活 AppKey 期间）

- **前端 recalcProfit**：切换 Top 3 匹配时，FBA 回退逻辑与后端一致，改为 `r.profit?.fbaUsd ?? r.fba ?? (r.weightKg ? r.weightKg * 4.5 : 5)`
- **PRICING-COST.md**：补充智能选品 1 积分/条、成本与利润分析
- **fetch 代理**：index.js 启动时 `setGlobalDispatcher(EnvHttpProxyAgent)`，daji.js 的 fetch 会自动走 HTTPS_PROXY

## 四、文档与代码一致性（第二轮复查）

| 文档 | 修正 |
|------|------|
| **PROJECT-OVERVIEW** | 补全 docs/1688-SUPPLIER-MATCHING.md、src AiToolbox/ai-toolbox、server daji.js/supplier-matching.js、外部服务 DajiAPI、相关文档、API save/DELETE reports |
| **1688-SUPPLIER-MATCHING** | 商品主图用途改为「AI 匹配打分（以图搜图待扩展）」；广告费/退货率「界面待补充」；费用估算以图搜图 0 次、合计 ¥2.1 |
| **DEPLOY** | 删除用户补全 supplier_matching_reports；5.2 手动 SQL 补一条；5.3 改为 8 条 |
| **server/index.js** | 删除用户时增加 `DELETE FROM supplier_matching_reports` |
| **project-context** | 删除用户说明补 supplier_matching_reports |

## 五、下一步

1. 联系 Daji 激活 1688 接口（微信 openapi2019 或 WhatsApp +8618820777181）
2. 激活后重启后端，重新测试智能选品流程
