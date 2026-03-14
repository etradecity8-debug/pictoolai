# 电商 AI 运营助手 · eBay 模块

## 概述

eBay 模块位于「电商 AI 运营助手」侧栏，路由 `/ai-assistant?platform=ebay`。流程与亚马逊模块一致：分析 → 生成 Listing → 生成产品图，但输出内容和规则针对 eBay 平台定制。

## 与亚马逊模块的差异

| 维度 | 亚马逊 | eBay |
|------|--------|------|
| 标题长度 | ≤200 字符 | **≤80 字符** |
| 结构化属性 | 五点描述（Bullet Points） | **Item Specifics**（键值对） |
| 后台关键词 | Search Terms（≤250 bytes） | 无 |
| 描述 | Product Description（≤2000 字符） | 产品描述（500-2000 字符） |
| A+ 内容 | 支持 | 无 |
| 搜索算法 | A9 / Cosmo / Rufus / GEO | **Cassini** |

## 流程

### Step 1 — 分析产品

- 前端上传产品图 + 填写类目、品牌、卖点、市场、语言
- 后端 `POST /api/ai-assistant/ebay/analyze` 调用 Gemini 分析模型
- 返回 `productName`、`productSummary`、`keyAttributes`

### Step 2 — 生成标题 · Item Specifics · 描述

- 后端 `POST /api/ai-assistant/ebay/generate-listing`
- AI prompt 遵循 eBay 规则：
  - 标题 ≤80 字符，前置品牌 + 核心词 + 关键属性
  - Item Specifics 10-20 对键值（Brand, MPN, Type, Material, Color, Size 等）
  - 描述 500-2000 字符，无 HTML
- 不扣积分

### Step 3 — 生成产品图

- 后端 `POST /api/ai-assistant/ebay/generate-product-images`
- 支持 5 种图片类型：白底主图、场景图、特写图、卖点图、**交互图**（真人使用/手持产品）
- 每种 0～4 张（卖点图最多为卖点数）
- 扣积分，图片自动存仓库
- 生成中有加载蒙版（张数 + 预估时间 + 进度条动画）

## 数据存储

- 表 `ebay_listing_snapshots`
- 字段：`title`、`item_specifics`（JSON）、`description`、`analyze_result`、`main_image_id`、`product_image_ids`

## CRUD API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai-assistant/ebay/save-listing` | 保存 Listing |
| GET | `/api/ai-assistant/ebay/listings` | 列表 |
| GET | `/api/ai-assistant/ebay/listings/:id` | 详情 |
| DELETE | `/api/ai-assistant/ebay/listings/:id` | 删除 |

## Listing 历史

`/dashboard/listings?platform=ebay` 查看，支持「导出 CSV」和「导出 JSON」。CSV 列头：`Title, Description, C:Brand, C:Type, ...`（Item Specifics 展开为独立列）。
