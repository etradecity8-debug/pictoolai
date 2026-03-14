# 电商 AI 运营助手 · 速卖通（AliExpress）模块

## 概述

速卖通模块位于「电商 AI 运营助手」侧栏，路由 `/ai-assistant?platform=aliexpress`。流程与亚马逊/eBay 模块一致：分析 → 生成 Listing → 生成产品图，输出内容针对速卖通平台定制。

## 平台规则对比

| 维度 | 亚马逊 | eBay | 速卖通 |
|------|--------|------|--------|
| 标题长度 | ≤200 字符 | ≤80 字符 | **≤128 字符** |
| 结构化属性 | 五点描述 | Item Specifics | **产品属性**（键值对） |
| 后台关键词 | Search Terms | 无 | 无 |
| 描述长度 | ≤2000 字符 | 500-2000 字符 | **500-3000 字符** |
| A+ 内容 | 支持 | 无 | 无 |
| 搜索算法 | A9/Cosmo/Rufus/GEO | Cassini | 速卖通搜索 |

## 速卖通特有规则

### 标题（≤128 字符）
- 比 eBay 长但比亚马逊短，充分利用空间放入搜索关键词
- 格式：[品牌] + [核心产品词] + [关键属性/功能]
- 不全大写（品牌缩写除外），避免过多标点

### 产品属性（10-25 对）
- 速卖通搜索和类目筛选的关键因素
- 包括：Brand、Material、Type、Color、Size、Weight、Origin、适用场景、适用季节、目标人群等
- 使用速卖通标准属性名称

### 描述（500-3000 字符）
- 速卖通描述主要在移动端浏览，需短段落结构
- 包含：产品亮点、规格参数、包装内容、使用场景
- 纯文本 + 换行，无 HTML
- 不含竞品提及、外部链接、联系方式

## 目标市场

支持 10 个市场：全球、美国、俄罗斯、巴西、法国、西班牙、德国、英国、韩国、日本。

## 输出语言

支持 9 种语言：English、中文、Русский、Português、Español、Français、Deutsch、한국어、日本語。

## 流程

### Step 1 — 分析产品

- 前端上传产品图 + 填写类目、品牌、卖点、市场、语言
- 后端 `POST /api/ai-assistant/aliexpress/analyze`
- 返回 `productName`、`productSummary`、`keyAttributes`

### Step 2 — 生成标题 · 产品属性 · 描述

- 后端 `POST /api/ai-assistant/aliexpress/generate-listing`
- 不扣积分

### Step 3 — 生成产品图

- 后端 `POST /api/ai-assistant/aliexpress/generate-product-images`
- 支持 5 种图片类型：白底主图、场景图、特写图、卖点图、**交互图**（真人使用/手持产品）
- 每种 0～4 张（卖点图最多为卖点数）
- 扣积分，图片自动存仓库
- 生成中有加载蒙版（张数 + 预估时间 + 进度条动画）

## 数据存储

- 表 `aliexpress_listing_snapshots`
- 字段：`title`、`product_attributes`（JSON）、`description`、`analyze_result`、`main_image_id`、`product_image_ids`

## CRUD API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai-assistant/aliexpress/save-listing` | 保存 Listing |
| GET | `/api/ai-assistant/aliexpress/listings` | 列表 |
| GET | `/api/ai-assistant/aliexpress/listings/:id` | 详情 |
| DELETE | `/api/ai-assistant/aliexpress/listings/:id` | 删除 |

## Listing 历史

`/dashboard/listings?platform=aliexpress` 查看，支持「导出 CSV」和「导出 JSON」。CSV 列头：`Title, Description, 属性名1, 属性名2, ...`（产品属性展开为独立列）。
