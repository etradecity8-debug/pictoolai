# 字段与 AI 传参说明

> 本文档说明「全品类组图」页面（`src/pages/DetailSet.jsx`）中每个用户输入字段，在前端和后端的作用，以及最终如何传给 AI。

---

## 一、输入字段总览

| 前端字段 | 是否必填 | 触发「回到步骤1重新分析」 | 作用阶段 |
|---|---|---|---|
| 产品图 | 是 | 是 | 分析 + 生图 |
| 产品名称 | 是 | 是 | 分析 |
| 卖点 | 否 | 是 | 分析 |
| 目标人群 | 否 | 是 | 分析 |
| 风格 | 否 | 是 | 分析 |
| 其他要求 | 否 | 是 | 分析 |
| 生成数量 | 是（默认3） | 是 | 分析 |
| 目标语言 | 是（默认英语） | 否 | 生图 |
| 模型 | 是（默认Pro） | 否 | 生图 |
| 尺寸比例 | 是（默认3:4） | 否 | 生图 |
| 清晰度 | 是（默认2K） | 否 | 生图 |

> **逻辑约定**：修改上半部分字段（产品信息/产品图/数量）需重新分析；修改下半部分（语言/模型/尺寸/清晰度）不影响已有规划，可直接「再次生成」。

---

## 二、分析阶段（POST /api/detail-set/analyze）

### 前端组装逻辑（`runAnalyze`）

五个组图要求输入框在前端拼接成一段结构化文本，再作为 `requirements` 字段发给后端：

```
产品名称：日式抹茶沐浴露
卖点：天然成分、舒缓放松
目标人群：25-40 岁女性
风格：日式极简
其他要求：...
```

只有有内容的字段才会加入，空字段不传。

### 发给后端的请求体

| 字段 | 来源 | 说明 |
|---|---|---|
| `image` | 产品图第一张（压缩后 base64） | 长边 ≤ 1024px，JPEG 0.82 |
| `requirements` | 五个输入框拼接的结构化文本 | 有内容才传，否则 `undefined` |
| `model` | 模型选择 | **后端分析阶段不使用**，固定用 `gemini-2.5-flash` |
| `quantity` | 生成数量 | 转为整数，决定 AI 输出几条图片规划 |

### 后端如何用（`server/index.js`）

```
用户组图要求：${requirements || '（未填写）'}
请输出恰好 ${planCount} 条图片规划，不要多也不要少。
```

- `requirements` → 嵌入分析 prompt 的「用户组图要求」段落
- `quantity` → 决定 AI 返回的 `imagePlan` 数组长度
- `image` → 作为图片 `inlineData` 与 prompt 一起传给 Gemini

### 返回结果

| 字段 | 说明 |
|---|---|
| `designSpecMarkdown` | 整体设计规范（Markdown 格式，前端渲染展示，用户可编辑） |
| `imagePlan` | 图片规划数组，每条含 `title` + `contentMarkdown` |

---

## 三、生图阶段（POST /api/detail-set/generate）

### 发给后端的请求体

| 字段 | 来源 | 说明 |
|---|---|---|
| `designSpecMarkdown` | 分析结果（可被用户编辑） | 整体设计规范 |
| `imagePlan` | 分析结果（可被用户编辑） | 图片规划数组 |
| `model` | 模型选择 | 用于 `getImageModelId()` 确定 Gemini 生图模型 |
| `clarity` | 清晰度选择 | 转为 `imageConfig.imageSize`（如 `2K`） |
| `aspectRatio` | 尺寸比例选择 | 转为 `imageConfig.aspectRatio`（如 `3:4`） |
| `targetLanguage` | 目标语言选择 | 转为语言约束规则注入 prompt |
| `quantity` | `imagePlan.length` | 生图张数（按规划条数） |
| `image` | 产品图第一张（压缩后 base64） | 作为参考图传给生图 AI |

### 后端生图 prompt 结构（每张图独立调用一次）

```
[产品摆放规则]       placementRule   产品必须放在真实支撑面上，禁止悬空
[尺寸规则]           aspectRule      输出必须严格符合 aspectRatioVal
[构图规则]           compositionRule 留白 25-35%，产品区与文字区分离
[排版规则]           textQualityRule 标题仅一行，精致无衬线字体
[文字安全区]         safeAreaRule    标题整句完整在画面内，四边留边距
[语言规则]           langRule        由 targetLanguage 生成的强制语言约束
[整体设计规范]       designSpecMarkdown
[本张图片规划]       imagePlan[i].title + imagePlan[i].contentMarkdown
```

### 模型对应关系

| 前端展示名 | Gemini 模型 ID |
|---|---|
| Nano Banana | `gemini-2.5-flash-image` |
| Nano Banana 2 | `gemini-3.1-flash-image-preview` |
| Nano Banana Pro | `gemini-3-pro-image-preview` |

### 清晰度对应关系

| 前端文案 | API imageSize | 支持模型 |
|---|---|---|
| 0.5K 快速 | `512` | 仅 Nano Banana 2 |
| 1K 标准 | `1K` | 全部 |
| 2K 高清 | `2K` | Nano Banana 2、Pro |
| 4K 超清 | `4K` | Nano Banana 2、Pro |

> 注：Nano Banana（`gemini-2.5-flash-image`）不支持 `imageSize` 参数，只传 `aspectRatio`。

---

## 四、分析模型说明

| 配置项 | 值 |
|---|---|
| 默认模型 | `gemini-2.5-flash` |
| 环境变量覆盖 | `GEMINI_ANALYSIS_MODEL` |
| 503 备用模型 | `gemini-2.5-flash`（当前主备相同，实际不切换） |
| 环境变量覆盖备用 | `GEMINI_ANALYSIS_MODEL_FALLBACK` |

---

## 五、图片压缩策略

前端在发请求前统一压缩产品图（`fileToCompressedDataUrl`）：

- 长边压缩至 ≤ 1024px，保持原始比例
- 输出格式：JPEG，质量 0.82
- 目的：防止大图导致代理连接关闭或请求超时
