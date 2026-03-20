# 通用电商生图 · 全品类组图：字段与 AI 传参说明

> 本文档说明「全品类组图」页面（`src/pages/DetailSet.jsx`）中每个用户输入字段，在前端和后端的作用，以及最终如何传给 AI。

---

## 一、输入字段总览

| 前端字段 | 是否必填 | 触发「回到步骤1重新分析」 | 作用阶段 |
|---|---|---|---|
| 产品图 | 是 | 是 | 分析 + 生图 |
| 产品名称 | 是 | 是 | 分析 |
| 卖点（1–5 条） | 否 | 是 | 分析 |
| 目标人群 | 否 | 是 | 分析 |
| 风格 | 否 | 是 | 分析 |
| 其他要求 | 否 | 是 | 分析 |
| 白底主图张数 | 是（默认 1） | 是 | 分析 |
| 场景图张数 | 是（默认 1） | 是 | 分析 |
| 特写图张数 | 是（默认 1） | 是 | 分析 |
| 卖点图张数 | 是（默认 0） | 是 | 分析 |
| 卖点图显示文字 | 否（默认不勾） | 否 | 生图 |
| 交互图张数 | 是（默认 0） | 是 | 分析 |
| 目标语言 | 是（默认英语） | 否 | 生图 |
| 模型 | 是（默认 Nano Banana） | 否 | 生图 |
| 尺寸比例 | 是（默认 3:4 竖版） | 否 | 生图 |
| 清晰度 | 是（默认 2K，Nano Banana 仅 1K） | 否 | 生图 |

> **逻辑约定**：修改上半部分字段（产品信息/产品图/各类型数量）需重新分析；修改下半部分（语言/模型/尺寸/清晰度/是否显示文字）不影响已有规划，可直接「再次生成」。
>
> **验证**：各类型张数之和必须 ≥ 1 才能点击「分析产品」。卖点图最大张数 = 填写的卖点条数（不能超出）。

---

## 二、图片类型说明

| 类型 | type 值 | 说明 | 每次最多 |
|---|---|---|---|
| 白底主图 | `main` | 纯白背景，产品约 85%，无文字/logo | 4 张 |
| 场景图 | `scene` | 生活/使用场景背景，有环境氛围 | 4 张 |
| 特写图 | `closeUp` | 产品细节/材质特写，极近距离微观 | 4 张 |
| 卖点图 | `sellingPoint` | 每张对应一条卖点，可选是否显示文字 | = 卖点条数 |
| 交互图 | `interaction` | 真人使用/手持产品的场景 | 4 张 |

---

## 三、分析阶段（POST /api/detail-set/analyze）

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
| `mainCount` | 白底主图张数 | 0–4 |
| `sceneCount` | 场景图张数 | 0–4 |
| `closeUpCount` | 特写图张数 | 0–4 |
| `sellingPointCount` | 卖点图张数 | 0–卖点条数 |
| `sellingPoints` | 填写的卖点文案数组 | 用于卖点图规划与卖点标签 |
| `sellingPointShowText` | 布尔值 | 是否在卖点图上叠加文字 |
| `interactionCount` | 交互图张数 | 0–4 |

### 后端如何用（`server/index.js`）

后端识别到 `mainCount` 等参数后启用「类型模式」，在 prompt 中按类型指定规划要求：

```
请按以下类型和数量输出图片规划（共 N 条）：
- 白底主图（type: "main"）：N1 张，纯白背景，产品约 85%，无文字无 logo
- 场景图（type: "scene"）：N2 张，生活/使用场景背景
- 特写图（type: "closeUp"）：N3 张，产品细节、材质特写
- 卖点图（type: "sellingPoint"）：N4 张，对应卖点：xxx、yyy
- 交互图（type: "interaction"）：N5 张，真人使用或手持产品的场景
```

每条 `imagePlan` 返回必含 `type` 字段，卖点图额外含 `sellingPointText`。

若前端传旧式 `quantity`（不含各类型数量）则降级为原有逻辑，向后兼容。

### 返回结果

| 字段 | 说明 |
|---|---|
| `designSpecMarkdown` | 整体设计规范（Markdown，用户可编辑） |
| `imagePlan` | 图片规划数组，每条含 `title`、`contentMarkdown`、`type`（以及卖点图的 `sellingPointText`） |

---

## 四、生图阶段（POST /api/detail-set/generate）

### 发给后端的请求体

| 字段 | 来源 | 说明 |
|---|---|---|
| `designSpecMarkdown` | 分析结果（可被用户编辑） | 整体设计规范 |
| `imagePlan` | 分析结果（可被用户编辑，含 `type`） | 图片规划数组 |
| `model` | 模型选择 | 用于 `getImageModelId()` 确定 Gemini 生图模型 |
| `clarity` | 清晰度选择 | 转为 `imageConfig.imageSize`（如 `2K`） |
| `aspectRatio` | 尺寸比例选择 | 转为 `imageConfig.aspectRatio`（如 `3:4`） |
| `targetLanguage` | 目标语言选择 | 转为语言约束规则注入 prompt |
| `sellingPointShowText` | 是否卖点图显文字 | 影响卖点图 prompt 是否含文字叠加要求 |
| `quantity` | `imagePlan.length` | 生图总张数（按规划条数） |
| `image` | 产品图第一张（压缩后 base64） | 作为参考图传给生图 AI |

### 后端生图 prompt 结构（每张图独立调用，按 type 差异化）

**白底主图（type: "main"）**：
```
[类型声明]  纯白背景，产品约 85%，无文字/logo，影棚质量
[尺寸规则]  aspectRule
[语言规则]  langRule（此类型通常无文字，但保留约束）
[整体设计规范] designSpecMarkdown
[本张图片规划] imagePlan[i]
[最终提醒]  纯白背景，禁止文字/logo/道具
```

**场景图 / 特写图 / 交互图（type: "scene" / "closeUp" / "interaction"）**：
```
[类型声明]  类型特定要求（场景氛围 / 极近特写 / 真人互动）
[摆放规则]  placementRule（物理正确摆放）
[尺寸规则]  aspectRule
[构图规则]  compositionRule（留白 25-35%，产品区与文字区分离）
[排版规则]  textQualityRule（标题仅一行，精致无衬线字体）
[色彩和谐] colorHarmonyRule
[文字安全区] safeAreaRule（整句完整在画面内）
[语言规则]  langRule
[整体设计规范] designSpecMarkdown
[本张图片规划] imagePlan[i]
```

**卖点图（type: "sellingPoint"）**：
- 在场景图 prompt 基础上，额外声明需视觉化表达的具体卖点文案
- 若 `sellingPointShowText=true`：要求将卖点文字作为标题叠加在图上
- 若 `sellingPointShowText=false`：只通过视觉构图表达卖点，不含文字

### 返回结果

| 字段 | 说明 |
|---|---|
| `images` | 生成图片数组，每项含 `id`、`title`、`type`、`url`（base64 data URL）或 `error` |

前端收到后按 `type` 分组展示（白底主图一组、场景图一组……），每组显示类型标签和图片网格，每张图有独立「保存到本地」按钮。

### 步骤3图片规划 UI

- 每条规划显示彩色类型标签（白底主图灰色 / 场景图蓝色 / 特写图紫色 / 卖点图橙色 / 交互图绿色）
- 卖点图规划额外显示「卖点：xxx」
- 用户仍可点击铅笔编辑标题和描述，`type` 字段在编辑时保留不变

---

## 五、模型对应关系

| 前端展示名 | Gemini 模型 ID |
|---|---|
| Nano Banana | `gemini-2.5-flash-image` |
| Nano Banana 2 | `gemini-3.1-flash-image-preview` |
| Nano Banana Pro | `gemini-3-pro-image-preview` |

## 六、清晰度对应关系

| 前端文案 | API imageSize | 支持模型 |
|---|---|---|
| 0.5K 快速 | `512` | 仅 Nano Banana 2 |
| 1K 标准 | `1K` | 全部 |
| 2K 高清 | `2K` | Nano Banana 2、Pro |
| 4K 超清 | `4K` | Nano Banana 2、Pro |

> 注：Nano Banana（`gemini-2.5-flash-image`）不支持 `imageSize` 参数，只传 `aspectRatio`。

---

## 七、分析模型说明

| 配置项 | 值 |
|---|---|
| 默认模型 | `gemini-2.5-flash` |
| 环境变量覆盖 | `GEMINI_ANALYSIS_MODEL` |
| 503 备用模型 | `gemini-2.5-flash`（当前主备相同，实际不切换） |
| 环境变量覆盖备用 | `GEMINI_ANALYSIS_MODEL_FALLBACK` |

---

## 八、图片压缩策略

前端在发请求前统一压缩产品图（`fileToCompressedDataUrl`）：

- 长边压缩至 ≤ 1024px，保持原始比例
- 输出格式：JPEG，质量 0.82
- 目的：防止大图导致代理连接关闭或请求超时
