# 电商 AI 运营助手 · 亚马逊 Listing 完整说明

本文档合并了「电商 AI 运营助手 → 亚马逊」相关的全部内容：Listing 生成流程、合规规则、生图提示词、A+ 模块定义。

---

# 第一部分：Listing 生成产品设计

**版本**：v0.2 已确认  
**日期**：2026-03-08  
**状态**：已确认，开发中

**合规承诺**：本模块的生成/优化功能严格遵守亚马逊平台规则，并智能符合 A9（传统搜索）、Cosmo（语义搜索）、Rufus（AI 购物助手）、GEO（AI 搜索引擎优化）等原则。

---

## 一、功能概述

在「电商AI运营助手 → 亚马逊」模块中新增「生成 Listing」功能。  
用户填写产品信息后，AI 分多步自动生成符合亚马逊规则的完整 Listing，包括标题、后台关键词、五点描述、产品描述，并可进一步生成 A+ 页面文案和产品图。

---

## 二、输入设计

### 必填项（缺少任一项不允许提交）

| 序号 | 字段 | 说明 |
|------|------|------|
| 1 | 产品图片（至少 1 张） | 随手拍、供应商图均可；AI 从图中提取产品信息，上传数量建议 1–5 张 |
| 2 | 产品类别（二级联动下拉） | 一级约 15 个大类，二级联动子类；决定 Listing 格式与优化方向 |
| 3 | 品牌名 | 亚马逊店铺品牌名；无品牌填 Generic |
| 4 | 核心卖点（至少 2 条） | 用户最了解自己产品的差异化点；每条一行填写 |
| 5 | 目标市场 | 美国、英国、德国、法国、日本、加拿大、澳大利亚、墨西哥等 |

### 可选项（填写后 AI 输出质量更高）

| 字段 | 说明 |
|------|------|
| 货源链接 | 1688 / 速卖通 / Alibaba 等供应商页面链接；后端自动读取页面内容并补充产品信息 |
| 参考关键词 | 用户自己做过关键词研究的可以填入，AI 会优先覆盖这些词 |
| 特殊认证 / 备注 | 如 CE、FCC、BPA-free、专利、特别要强调的功能点等 |

---

## 三、产品类别设计（二级联动下拉）

**设计决策**：不抓取亚马逊完整类目树。原因：类目层级过深（叶子节点达数千个）、维护成本高，且对 Listing 文案生成而言，一二级大类已足够指导 AI 的写作风格和关键词策略。

### 一级 → 二级示例

| 一级 | 二级示例 |
|------|---------|
| 家居厨房 | 厨具、收纳整理、家纺、灯具、清洁用品、浴室用品 |
| 运动户外 | 户外装备、健身器材、自行车、游泳用品、球类运动 |
| 电子数码 | 手机配件、电脑配件、音频设备、摄影器材、智能家居 |
| 美容个护 | 护肤、彩妆、发型护理、香水、健康护理 |
| 宠物用品 | 犬用、猫用、小动物、水族 |
| 婴儿用品 | 喂养、婴儿衣物、婴儿玩具、婴儿安全 |
| 服装鞋包 | 男装、女装、鞋类、箱包配件 |
| 玩具游戏 | 益智玩具、遥控玩具、户外玩具、桌游 |
| 汽车用品 | 内饰配件、外饰改装、工具、电子设备 |
| 工具五金 | 电动工具、手工具、建材五金 |
| 园艺 | 园林工具、种植用品、户外家具 |
| 健康医疗 | 维生素/保健品、医疗器具、急救用品 |
| 办公文具 | 文具耗材、打印耗材、办公家具 |
| 其他 | 用户手动补充描述 |

---

## 四、输出设计

### 4.1 输出内容与字符限制

| 序号 | 输出项 | 亚马逊字符限制 | 备注 |
|------|--------|----------------|------|
| 1 | 标题（Title） | ≤200 字符 | 含品牌名、核心搜索词、主要卖点 |
| 2 | 后台搜索关键词（Search Terms） | ≤250 bytes | 不与标题中已有的词重复 |
| 3 | 五点描述（Bullet Points） | 每条 ≤500 字符，共 5 条 | 按 Rufus 问答逻辑组织 |
| 4 | 产品描述（Product Description） | ≤2000 字符 | 适合尚未注册品牌的卖家 |
| 5 | A+ 文案（Enhanced Brand Content） | 多模块，约 3–5 个 | 本模块内新建 A+ 子流程 |
| 6 | 产品图 | 1～9 张（客户可选） | 第 1 张为主图（白底），第 2～9 张为附加图 |

### 4.2 四大优化维度

| 维度 | 说明 | 写法要点 |
|------|------|---------|
| **A9**（传统搜索算法） | 关键词相关性、点击率、转化率 | 标题前 80 字符含高搜索量核心词；五点自然分布长尾词 |
| **Cosmo**（语义搜索） | 理解语义和使用场景 | 每个 bullet 用自然语言描述：谁在用、什么场景、解决什么问题 |
| **Rufus**（AI 购物助手） | 直接读取 Listing 回答买家问题 | 每个 bullet 隐含回答一个买家常见问题 |
| **GEO**（AI 搜索引擎优化） | 内容结构化、事实性强 | 包含精确数据：尺寸、重量、材质、认证、测试结论等 |

---

## 五、AI 调用流程（多步生成）

| 步骤 | 内容 | 输入 | 预估输出量 |
|------|------|------|-----------|
| Step 1 | **产品分析** | 图片 + 货源链接（可选） | 结构化 JSON：品类、材质、特点、潜在关键词 |
| Step 2 | **标题 + 后台关键词 + 五点描述** | Step1 结果 + 用户输入 | 约 1–1.5K tokens |
| Step 3 | **产品描述** | Step1 结果 + Step2 结果 | 约 1K tokens |
| Step 4 | **A+ 文案**（可选） | 以上全部结果 | 约 2–3K tokens，多模块 |
| Step 5 | **产品图**（可选） | 本模块内生成 | 走图像生成流程 |

---

## 六、亚马逊规则与合规约束

### 6.1 标题（Title）

- **长度**：多数类目 ≤200 字符；部分类目更短（如 80/50）。
- **禁止**：全大写、堆砌无关关键词、竞品/他人品牌名；**同一单词不得重复超过 2 次**；**禁止使用** `! $ ? _ { } ^ ¬ ¦` 等符号。
- **建议结构**：`品牌 + 核心产品词 + 关键属性（材质/尺寸/数量等）+ 主要卖点`；**前 80 字符含核心搜索词**。

### 6.2 五点描述（Bullet Points）

- **长度**：每条 ≤500 字符，共 5 条，须全部使用且内容不重复。
- **禁止**：价格、促销、站外链接；夸大/绝对化/医疗未证宣称；**特殊符号**（™ ® €）与 **emoji**；**跨条重复**；ASIN、「N/A」「TBD」；公司信息、联系方式、网址；退款/质保承诺用语；类目禁用营销用语。
- **建议**：每条对应一个卖点或一个买家常见问题；信息具体、可验证。

### 6.3 产品描述（Product Description）

- **长度**：通常 ≤2000 字符。
- **禁止**：与五点逐句重复堆砌、站外链接、联系方式、违禁词；**不得出现竞品对比、「best seller」「top-rated」等宣称**。

### 6.4 后台关键词（Search Terms）

- 总长 ≤250 bytes（多字节语言占更多 bytes）。
- 禁止：重复标题/五点中已有的词、竞品品牌、无关词堆砌。

### 6.5 图片（主图要求）

- **主图**：纯白底 **RGB(255,255,255)**；产品占画面 **≥85%**、完整可见、居中；**无文字/logo/水印/边框/多角度拼图**；**长边 ≥1000px**；比例建议 1:1。
- **注意**：亚马逊政策要求主图为「实际拍摄」照片；AI 生成图在严格解读下可能不符合主图要求，建议用户将本工具生成图用作参考或附加图。

### 6.6 A+ 内容（Enhanced Brand Content）

- **禁止**：提及竞品名称；使用「best seller」「top-rated」「Amazon's Choice」；保证/质保类表述；外部链接、社媒、二维码；联系方式或配送细节；医疗或未经支持的宣称；特殊符号（™ ® €）或 emoji。

---

## 七、实现细节（开发记录）

### 前端

- **文件**：`src/pages/AiAssistant.jsx`。
- **流程**：提交 → Step 1 分析 → Step 2 标题·关键词·五点·描述 → 展示结果；结果页内可继续 Step 3 产品图、Step 4 A+ 文案与图片。
- **保存与历史**：表 `amazon_listing_snapshots`；侧栏「Listing 历史」入口（`/dashboard/listings`）。
- **导出 CSV**：实现见 `src/lib/exportAmazonListingCsv.js`。

### 后端接口

- **Step 1**：`POST /api/ai-assistant/amazon/analyze` — 分析，不扣积分。
- **Step 2**：`POST /api/ai-assistant/amazon/generate-listing` — 文案，不扣积分。
- **Step 3**：`POST /api/ai-assistant/amazon/generate-product-images` — 产品图，扣积分。
- **Step 4 A+**：复用 `POST /api/amazon-aplus/analyze`（文案）、`POST /api/amazon-aplus/generate`（4 张 A+ 图，扣积分）。

---

# 第二部分：生图提示词与准则

## 一、通用规则（所有生图均遵守）

- **禁止图中出现任何文字**：不渲染英文、中文、日文、韩文、数字、标签、品牌名、产品名。
- **纯商业摄影**：无文字、无水印、无 logo。

代码中的通用规则文案（noTextRule）：

```
CRITICAL: This must be a pure product PHOTO with absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks. Product name and brand below are CONTEXT ONLY — do NOT render them in the image. Pure clean commercial photography, zero text.
```

---

## 二、Step 3 产品图（白底主图 / 场景图 / 特写图 / 卖点图）

- **白底主图**：`noTextRule` + `--- Amazon main image: Pure white background only (RGB 255,255,255). Product: {productName}. Brand context: {brand}. Product must fill approximately 85% of the frame, centered.`
- **场景图**：`noTextRule` + `--- Amazon scene/lifestyle image: Same product in a realistic use case or lifestyle setting.`
- **特写图**：`noTextRule` + `--- Amazon detail/close-up image: ...` 参考图仅作产品外形，纯白或柔和渐变影棚背景。
- **卖点图**：每张对应一条用户填写的卖点，视觉化展示；可选是否在图上显示文字。

---

## 三、Step 4 A+ 图片（4 张）

- **用途**：Hero 横幅（16:9）+ 3 张特点图（1:1）。
- **Hero**：`--- Amazon A+ hero banner. Product context: {product} by {brand}. Visual style: {styleDesc}.`
- **特点图**：`--- Amazon A+ feature image. Feature to visualize: {f0/f1/f2}.`
- **风格**：minimal / lifestyle / luxury 对应不同背景与光线描述。
- **生成顺序**：后端按顺序生成 4 张，避免并发限速。

---

## 四、与亚马逊官方要求对照

| 要求项 | 当前实现 |
|--------|----------|
| 背景色 纯白 RGB(255,255,255) | ✅ prompt 中明确写 Pure white / RGB 255,255,255 |
| 产品占比 ≥85% | ✅ product fill approximately 85%, centered |
| 文字/logo/水印 禁止 | ✅ noTextRule 强制禁止 |
| 主图 1:1 | ✅ 后端 aspectRatio: '1:1' |
| 分辨率 长边 ≥1000px | ⚠️ 模型输出多为 1K，用户可自行放大 |
| AI 生成 vs 实际拍摄 | ⚠️ 严格解读下主图宜用实拍；生成图建议作参考或附加图 |

---

# 第三部分：A+ 模块定义

亚马逊标准 A+ 有 **17 种模块**，每个 listing 最多约 5 个模块。本系统**全部支持 17 种**。

## 17 种模块 ID 与规格

| 序号 | 模块 ID | 中文名 | 图片 | 文案 |
|-----|--------|--------|------|------|
| 1 | `header` | 图片页头 | 1 张 16:9 | 标题 ≤50 + 正文 300–500 字 |
| 2 | `single_highlights` | 单图+亮点 | 1 张 1:1 | 标题 ≤50 + 4 条亮点 ≤80 字 |
| 3 | `image_dark_overlay` | 深色文字叠加图 | 1 张 16:9 | 标题+正文（叠在深色区） |
| 4 | `image_white_overlay` | 浅色文字叠加图 | 1 张 16:9 | 标题+正文（叠在浅色区） |
| 5 | `comparison_chart` | 对比表格 | 无 | 多行 feature/value1/value2 |
| 6 | `multiple_images` | 多图模块 | 4 张 1:1 | 4 块 title+desc |
| 7 | `product_description` | 产品描述长文 | 无 | ≤2000 字 |
| 8 | `company_logo` | 品牌 Logo | 1 张 16:9 | 可选 logoCaption |
| 9 | `single_image_sidebar` | 单图+侧栏 | 1 张 1:1 | 标题 ≤50 + 正文 ≤400 |
| 10 | `standard_text` | 纯文字 | 无 | ≤500 字 |
| 11 | `quad_images` | 四图+文字 | 4 张 1:1 | 4 块 ≤100 字 |
| 12 | `tech_specs` | 技术规格 | 无 | 最多 10 行 name+value |
| 13 | `single_right_image` | 右图左文 | 1 张 1:1 | 标题 ≤50 + 正文 ≤160 |
| 14 | `three_images` | 三图+文字 | 3 张 1:1 | 3 块 标题+正文 |
| 15 | `single_left_image` | 左图右文 | 1 张 1:1 | 标题 ≤50 + 正文 ≤450 |
| 16 | `single_image_specs` | 单图+规格 | 1 张 1:1 | 标题+要点列表(≤5条) |
| 17 | `brand_story` | 品牌故事 | 无 | 标题 ≤8 字 + 正文 60–80 字 |

## 推荐套餐

| 套餐 | 模块组合 | 图片张数 |
|------|----------|----------|
| 基础 | header + three_images + tech_specs | 4 |
| 标准 | header + single_highlights + three_images + tech_specs + brand_story | 5 |
| 精品 | header + single_highlights + quad_images + tech_specs + brand_story | 6 |

**自定义**：从 17 种中勾选，最多 5 个，按选择顺序生成。
