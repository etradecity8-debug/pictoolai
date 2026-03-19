# 电商 AI 运营助手完整说明

本文档涵盖「电商 AI 运营助手」全平台内容：**亚马逊**（Listing 生成/优化/竞品/关键词/A+ 图片）、**eBay**（生成/优化）、**速卖通**（生成/优化）、**侵权风险检测**（免费快筛 + 深度查询），以及深度查询服务费用附录。

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
- **导出 CSV / JSON**：实现见 `src/lib/exportListingCsv.js`（统一导出，支持亚马逊/eBay/速卖通）。
- **输出纯文本**：后端 `stripMarkdown` 函数自动清除 AI 返回的 `**粗体**`、`_斜体_` 等 Markdown 格式，确保五点描述和产品描述可直接粘贴到平台后台。

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

---

# 第四部分：优化 Listing

## 功能概述

在「电商AI运营助手 → 亚马逊」模块中，「优化 Listing」功能允许卖家粘贴已有的 Listing 文案，AI 自动诊断问题并生成优化版本。**不扣积分**。

支持**智能粘贴**：用户可在 Listing 页面全选复制后一次性粘贴，AI 自动识别并拆分到标题、五点、描述等字段。

## 输入

| 字段 | 必填 | 说明 |
|------|------|------|
| 现有标题 | 是 | 粘贴当前 Listing 标题 |
| 五点描述 | 是 | 粘贴当前五点，每条一行 |
| 详情描述 | 否 | 粘贴当前 Product Description |
| 后台关键词 | 否 | 粘贴当前 Search Terms |
| 目标市场 | 是 | 美/英/德/法/日/西/意/加/澳/墨 |
| 目标语言 | 是 | 中/英/德/法/日/西（支持跨语言转换） |

## 输出

### 诊断报告（双语）
- **综合评分**（1–10）及一句话总结
- **各项评分**：标题、五点、描述、后台关键词各 1–10 分，附具体问题列表
- **合规自检**：9 大类检测（标题格式、五点格式、描述规则、促销用语、IP/品牌、医疗声明、农药/杀菌、环保声明、其他），每项带三级严重度（error/warning/info）、位置、问题文本和修改建议
- **双语切换**：诊断报告支持「原文语言 / 中文」切换显示

### 优化后版本
- 优化后的标题（≤200 字符）、五点（各 ≤500 字符）、描述（≤2000 字符）、后台关键词（≤250 字节）
- 每个字段均可单独复制，也可一键复制全部

### A/B 文案变体
- 优化完成后可点击「生成 A/B 变体」，生成 2-3 套不同策略角度的文案版本（功能参数型、场景情感型等）
- Tab 切换对比各版本，每版含标题、五点、描述、后台关键词、策略说明
- 不扣积分

## 评估标准

优化基于以下维度：
- **A9**（传统搜索）：标题前 50–80 字符含核心词、关键词分布、Search Terms 不重复
- **Cosmo**（语义搜索）：自然语言描述场景和目标用户
- **Rufus**（AI 购物助手）：每条五点隐含回答买家问题，含具体参数
- **GEO**（结构化内容）：精确数据（尺寸、重量、材质）、市场对应单位
- **合规**：九大类违禁检测与替代建议

## 接口

| 接口 | 说明 |
|------|------|
| `POST /api/ai-assistant/amazon/optimize-listing` | 诊断+优化（不扣积分） |
| `POST /api/ai-assistant/amazon/generate-variants` | A/B 文案变体（不扣积分） |
| `POST /api/ai-assistant/smart-paste` | 智能粘贴识别（不扣积分） |

---

# 第五部分：竞品对比

## 功能概述

粘贴自己的 Listing 和 1-5 个竞品 Listing（Tab 切换输入，可增删），AI 对比关键词覆盖、卖点差异、标题/五点策略，输出行动计划。**不扣积分**。

支持**智能粘贴**：「我的 Listing」和每个竞品块均可使用智能粘贴，一次性粘贴整页内容自动拆分。

## 输出

- **关键词差异**：我的优势词 / 待补充词 / 共有词
- **卖点矩阵**：表格对比各方卖点覆盖情况
- **策略分析**：标题和五点的优势/不足/建议
- **行动计划**：5-8 条优先级排序的具体改进建议

## 接口

`POST /api/ai-assistant/amazon/competitor-compare`（需登录，不扣积分）

---

# 第六部分：关键词研究

## 功能概述

输入产品名称，AI 生成系统化关键词策略。**不扣积分**。

## 输出

- **核心搜索词**（1-3 个）：最高搜索量的通用词
- **长尾关键词**（15-20 个）：按 5 类分组（功能/场景/受众/问题/对比），点击可复制
- **后台关键词建议**（10-15 个）：不与标题/五点重复，可直接粘贴到 Search Terms
- **标题排布建议**：前 80 字符优先词 + 推荐结构模板
- **趋势分析**：季节性/时间性提示
- **差异分析**（可选）：若填写已有关键词，AI 对比分析缺失/冗余/覆盖良好

## 接口

`POST /api/ai-assistant/amazon/keyword-research`（需登录，不扣积分）

---

# 第七部分：eBay 模块

路由 `/ai-assistant?platform=ebay`。流程：分析 → 生成 Listing → 生成产品图，输出规则针对 eBay 定制。

## 平台规格对比（亚马逊 vs eBay）

| 维度 | 亚马逊 | eBay |
|------|--------|------|
| 标题长度 | ≤200 字符 | **≤80 字符** |
| 结构化属性 | 五点描述（Bullet Points） | **Item Specifics**（键值对） |
| 后台关键词 | Search Terms（≤250 bytes） | 无 |
| 描述长度 | ≤2000 字符 | 500–2000 字符 |
| A+ 内容 | 支持 | 无 |
| 搜索算法 | A9 / Cosmo / Rufus / GEO | **Cassini** |

## 流程

**Step 1 — 分析产品**：上传产品图 + 填写类目、品牌、卖点、市场、语言 → `POST /api/ai-assistant/ebay/analyze` → 返回 `productName`、`productSummary`、`keyAttributes`（含深度产品智能：关键词提取、买家问题、买家画像）。

**Step 2 — 生成标题 · Item Specifics · 描述**：`POST /api/ai-assistant/ebay/generate-listing`。AI 生成：
- 标题 ≤80 字符，前置品牌 + 核心词 + 关键属性
- Item Specifics 10–20 对键值（Brand、MPN、Type、Material、Color、Size 等）
- 描述 500–2000 字符，无 HTML
- 不扣积分

**Step 3 — 生成产品图**：`POST /api/ai-assistant/ebay/generate-product-images`。5 种类型：白底主图、场景图、特写图、卖点图、交互图（真人使用/手持）。每种 0～4 张，扣积分，自动入仓库。

## 优化 Listing

粘贴现有 Listing（支持**智能粘贴**），`POST /api/ai-assistant/ebay/optimize-listing`，Cassini 搜索算法诊断，合规自检（三级），双语诊断报告（原文/中文切换），优化后版本。不扣积分。

## 数据存储与接口

表 `ebay_listing_snapshots`，字段：`title`、`item_specifics`（JSON）、`description`、`analyze_result`、`main_image_id`、`product_image_ids`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai-assistant/ebay/analyze` | 产品分析 |
| POST | `/api/ai-assistant/ebay/generate-listing` | 生成 Listing（不扣积分） |
| POST | `/api/ai-assistant/ebay/generate-product-images` | 生成产品图（扣积分） |
| POST | `/api/ai-assistant/ebay/optimize-listing` | 优化 Listing（不扣积分） |
| POST | `/api/ai-assistant/ebay/save-listing` | 保存 Listing |
| GET | `/api/ai-assistant/ebay/listings` | 列表 |
| GET | `/api/ai-assistant/ebay/listings/:id` | 详情 |
| DELETE | `/api/ai-assistant/ebay/listings/:id` | 删除 |

Listing 历史：`/dashboard/listings?platform=ebay`，支持导出 CSV / JSON。

---

# 第八部分：速卖通（AliExpress）模块

路由 `/ai-assistant?platform=aliexpress`。流程与 eBay 一致，输出针对速卖通定制。

## 平台规格对比（三平台）

| 维度 | 亚马逊 | eBay | 速卖通 |
|------|--------|------|--------|
| 标题长度 | ≤200 字符 | ≤80 字符 | **≤128 字符** |
| 结构化属性 | 五点描述 | Item Specifics | **产品属性**（键值对） |
| 后台关键词 | Search Terms | 无 | 无 |
| 描述长度 | ≤2000 字符 | 500–2000 字符 | **500–3000 字符** |
| A+ 内容 | 支持 | 无 | 无 |
| 搜索算法 | A9/Cosmo/Rufus/GEO | Cassini | 速卖通搜索 |

## 速卖通特有规则

**标题（≤128 字符）**：格式 `[品牌] + [核心产品词] + [关键属性/功能]`；不全大写（品牌缩写除外），避免过多标点。

**产品属性（10–25 对）**：速卖通搜索和类目筛选的关键。包括 Brand、Material、Type、Color、Size、Weight、Origin、适用场景、适用季节、目标人群等；使用速卖通标准属性名称。

**描述（500–3000 字符）**：主要在移动端浏览，需短段落；包含产品亮点、规格参数、包装内容、使用场景；纯文本 + 换行，无 HTML；不含竞品、外部链接、联系方式。

**目标市场**：全球、美国、俄罗斯、巴西、法国、西班牙、德国、英国、韩国、日本（10 个）。

**输出语言**：English、中文、Русский、Português、Español、Français、Deutsch、한국어、日本語（9 种）。

## 流程

与 eBay 模块相同节奏：Step1 分析 → Step2 生成标题/属性/描述（不扣积分）→ Step3 生成产品图（扣积分，自动入仓）。

## 数据存储与接口

表 `aliexpress_listing_snapshots`，字段：`title`、`product_attributes`（JSON）、`description`、`analyze_result`、`main_image_id`、`product_image_ids`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai-assistant/aliexpress/analyze` | 产品分析 |
| POST | `/api/ai-assistant/aliexpress/generate-listing` | 生成 Listing（不扣积分） |
| POST | `/api/ai-assistant/aliexpress/generate-product-images` | 生成产品图（扣积分） |
| POST | `/api/ai-assistant/aliexpress/optimize-listing` | 优化 Listing（不扣积分） |
| POST | `/api/ai-assistant/aliexpress/save-listing` | 保存 Listing |
| GET | `/api/ai-assistant/aliexpress/listings` | 列表 |
| GET | `/api/ai-assistant/aliexpress/listings/:id` | 详情 |
| DELETE | `/api/ai-assistant/aliexpress/listings/:id` | 删除 |

Listing 历史：`/dashboard/listings?platform=aliexpress`，支持导出 CSV / JSON。

---

# 附录：侵权风险检测 — 服务构成与费用（客户沟通用）

> 本附录整理深度查询所用服务、费用及客户沟通话术。

---

## SerpApi 与 Google 是什么关系？

SerpApi 是一个**第三方付费服务**，它帮你去抓 Google 的搜索结果，整理成干净的 JSON 数据返回。

> 简单比喻：**Google 是图书馆，SerpApi 是帮你去图书馆查资料、把结果整理好抄回来的「跑腿服务」。**

**为什么不直接用 Google？**

| 问题 | 说明 |
|------|------|
| Google 没有免费开放的「搜索 API」 | 官方 Custom Search API 每天仅免费 100 次，功能有限 |
| Google Lens 完全没有公开 API | 想以图搜图，没有官方接口可调 |
| Google Patents 也没有直接 API | 专利搜索同样没有公开接口 |
| 直接爬 Google 违反服务条款 | 自己写爬虫会被封 IP |

SerpApi 的价值：**合法地把 Google Lens / Google Patents / Google 搜索的结果以 API 形式提供给开发者。**

---

## 深度查询：调用了哪些服务？

每次深度查询固定调用前 2 项，后 2 项按情况触发：

| # | 服务 | 输入 | 得到什么 | 判断什么 | 是否必然触发 |
|---|------|------|---------|---------|------------|
| 1 | **Google Lens**（以图搜图 + 来源溯源） | 首张产品图 | 整网外观相似图片/商品，以及图片主要来源网站 | 外观设计侵权风险、图片版权溯源 | 每次都有 |
| 2 | **Google Patents**（专利检索） | AI 提取的英文关键词 | 主要美国专利库中相关外观/设计专利 | 专利侵权风险 | 每次都有 |
| 3 | **Google 搜索**（商标检索） | AI 提取的品牌词，组成「USPTO trademark xxx」 | 商标相关网页（以美国为主） | 商标/Logo 侵权风险 | 图中有可疑品牌词时触发 |
| 4 | **Google 搜索**（IP 角色版权检索） | AI 识别到的 IP 角色/图案英文名 | 该 IP 的版权归属方与知识产权持有人信息 | IP 形象版权风险 | 图中有疑似 IP 角色时触发 |
| — | **Gemini**（AI 综合分析） | 上述全部结果 + 初步视觉分析 | 分组报告（商标/外观/IP 形象/图片溯源/平台合规/综合等级/建议/免责） | 汇总输出 | 每次都有 |

**SerpApi 实际调用次数：最少 2 次（Lens + Patents），通常 3～4 次（加商标/IP 角色检索）。**

产品内「本次深度查询使用的检索方式」表格与上表实时对应，只展示本次实际执行的项目。

---

## 费用汇总

### 当前方案

| 项目 | 费用 |
|------|------|
| SerpApi Developer 套餐 | $75/月（约 ¥540/月） |
| Gemini API | 已有，不另计 |
| **合计** | **约 ¥540/月** |

**可支撑量**：SerpApi 每月 5,000 次；每次深度查询消耗 2～4 次（平均约 3 次），约可支撑 **1,200～2,500 次深度查询/月**。向用户每次收取 20 积分，覆盖成本并留有盈利空间。

### 可选升级

在当前方案基础上接入专业商标数据库（如 IPRScan，约 €249/年 ≈ €21/月），可明确告知客户「Logo 与哪些已注册商标在视觉/语音/概念上相似（含评分）」。合计约 $96/月（约 ¥690/月）。

---

## 待开放的检测维度

以下功能在技术上可实现，但目前暂未集成，后续可按需开放：

| 功能 | 工具 | 费用 | 说明 |
|------|------|------|------|
| 美国版权局登记查询 | copyright.gov | 免费 | 可查询 1978 年后在美国主动登记的版权作品。注意：版权无需登记即自动产生，未找到记录不代表无版权保护。 |
| 专业图片版权溯源 | TinEye API | 约 ¥2,200/年（5,000 次） | 专注图片版权来源追踪，比 Google Lens 更擅长找到图片最早出现的页面，适合核查产品图是否来自有版权摄影师/图库。 |
| WIPO 全球版权/商标数据库 | WIPO IP Portal | 免费（接口较复杂） | 全球商标、外观设计、版权数据库，覆盖范围比 USPTO 更广，可补充非美国市场检索。 |
| 专业商标相似度比对 | IPRScan | 约 €249/年 | USPTO + EUIPO，含视觉/语音/概念相似度评分，比 Google 搜索更精准。 |

---

## 建议分步策略

1. **已完成**：免费快筛（Gemini AI 图像分析）+ 深度查询（SerpApi：Lens + Patents + 商标 + IP 角色版权）。
2. **下一步可选**：接入 IPRScan（€249/年），向需要专业商标比对的客户提供更精准的商标相似度报告。
3. **按需开放**：TinEye 专业图片溯源（¥2,200/年）、WIPO 全球数据库、美国版权局查询，视客户需求决定是否集成。

---

## 向客户解释时可以说

> 「深度查询会做 3～4 项检索：① 以图搜图（Google Lens）——看您的产品在全网和谁长得像，同时追踪图片来源；② 专利检索（Google Patents）——主要查美国专利库，辅助判断是否有类似专利；③ 商标检索——以美国商标信息为主，辅助判断 Logo/品牌词侵权风险；④ 若图中检测到疑似 IP 角色/图案，还会自动查该 IP 的版权归属方。最后由 AI 综合出分组报告。报告仅供参考，不构成法律意见，高风险项建议咨询专业知识产权律师。」
