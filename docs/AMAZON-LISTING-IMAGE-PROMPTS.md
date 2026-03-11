# 亚马逊 Listing 生图提示词与准则

本文档记录「生成 Listing」流程中 **Step 3 产品图** 与 **Step 4 A+ 图片** 发给 AI 的提示词（prompt），便于你了解生图遵循的准则。

---

## 一、通用规则（所有生图均遵守）

- **禁止图中出现任何文字**：不渲染英文、中文、日文、韩文、数字、标签、品牌名、产品名。产品名与品牌仅作为「上下文」帮助 AI 理解产品，不得以可见文字形式出现在画面中。
- **纯商业摄影**：无文字、无水印、无 logo。

代码中的通用规则文案（noTextRule）：

```
CRITICAL: This must be a pure product PHOTO with absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks. Product name and brand below are CONTEXT ONLY — do NOT render them in the image. Pure clean commercial photography, zero text.
```

（A+ 接口中使用更长版本，含多语言说明，含义一致。）

---

## 二、Step 3 产品图（白底主图 / 场景图 / 特写图 / 卖点图）

用户可分别选择四类图片的数量：
- **白底主图**：符合亚马逊主图规范的图片，纯白底、产品约 85%、居中（0～4 张）。
- **场景图**：产品在使用场景或生活化环境中（0～4 张）。
- **特写图**：产品细节、材质、工艺的特写/微距镜头（0～4 张）。
- **卖点图**：每张对应用户填写的一条卖点，视觉化展示该卖点（0～卖点数，最多等于用户填写的卖点条数）。

**三种图的 prompt**：

1. **白底主图**：`noTextRule` + `--- Amazon main image: Pure white background only (RGB 255,255,255, #FFFFFF). Product: {productName}. Brand context: {brand}. Product must fill approximately 85% of the frame, centered. Professional product photography, high resolution, clean studio lighting. Single product only, no props or text.`

2. **场景图**：`noTextRule` + `--- Amazon scene/lifestyle image: Same product in a realistic use case or lifestyle setting. Product on a clean surface or in a natural environment (e.g. desk, kitchen, living room). Show product in context. Professional product photography, high resolution. No text, no logos. Product: {productName}. Brand context: {brand}.`

3. **特写图**：`noTextRule` + `--- Amazon detail/close-up image: ...` + **参考图仅作产品外形**：不复制参考图的背景、桌子、房间等无关元素；纯白或柔和渐变影棚背景。**产品干净**：产品表面必须干燥，禁止水滴、水珠、水渍。**摆放合理**：凳子、椅子等座具禁止放在桌上，特写时可展示产品局部细节（如连接处、材质）配纯白背景。

4. **卖点图**：每张对应一条用户填写的卖点，视觉化展示。可选：**是否在图上显示文字**（`sellingPointShowText`）。
   - **不显示文字**：遵守 `noTextRule`，纯白或柔和渐变背景，无文字。
   - **显示文字**：必须在图上展示该卖点文案，语言按用户设置的 `lang`（zh/en/de/fr/ja/es），若卖点原文为其他语言则翻译后展示。文字须留安全边距、可读。

**输入**：首张产品图（data URL）+ 上述文本。卖点图需传入 `sellingPoints`、`sellingPointCount`；可选 `sellingPointShowText`、`lang`。

---

## 三、Step 4 A+ 图片（4 张）

- **用途**：Hero 横幅（16:9）+ 3 张特点图（1:1）。
- **准则**：同上「通用规则」；风格由用户选择的 style 决定（minimal / lifestyle / luxury），对应不同背景与光线描述。

**Hero 横幅**：

- 通用规则 + `--- Amazon A+ hero banner. Product context (do not render as text): {product} by {brand}. Visual style: {styleDesc}. Wide elegant product shot, high resolution, professional commercial photography.`

**特点图 1～3**（每张对应一个卖点/特点标题）：

- 通用规则 + `--- Amazon A+ feature image. Product context (do not render as text): {product} by {brand}. Feature to visualize: {f0/f1/f2}. Visual style: {styleDesc}. Square format, clean centered composition.`

**风格描述（styleDesc）**：

- minimal：clean white studio background, minimalist professional product photography, bright even lighting
- lifestyle：warm natural lifestyle setting, cozy home environment, natural soft window lighting
- luxury：dark moody premium background, dramatic side lighting, gold and matte black accents, high-end editorial aesthetic

**生成顺序**：后端按顺序生成 4 张（Hero → 特点图1 → 特点图2 → 特点图3），避免并发触发限速。

---

## 四、与亚马逊规则的对应

- 主图：纯白底、产品占比、无文字 → 对应 `AMAZON-LISTING-SPEC.md` 第七章 7.5 主图要求。
- A+ 图：无文字、商业摄影 → 符合 A+ 内容政策，避免品牌名/产品名被错误渲染到图上。A+ **文案**的合规（禁止竞品、best seller、质保、外链等）见规范 7.7，已在 `api/amazon-aplus/analyze` 的 prompt 中约束。

---

## 五、亚马逊官方要求对照与当前实现（资料核查）

以下依据亚马逊 Seller Central 图片政策及 2024–2026 年卖家指南（如 ListingForge、Seller Labs、Jungle Scout 等）整理，并对照本项目的 prompt 与输出。

| 要求项 | 亚马逊官方 | 当前实现 | 说明 |
|--------|------------|----------|------|
| 背景色 | 纯白 RGB(255,255,255)，偏色即可能被拒 | ✅ prompt 中明确写 Pure white / RGB 255,255,255 / #FFFFFF | 内容层面符合；实际像素是否绝对 255 取决于模型输出 |
| 产品占比 | 主图产品占画面 ≥85%，完整可见、居中 | ✅ prompt 要求 product fill approximately 85%, centered | 符合 |
| 文字/logo/水印 | 主图禁止任何文字、logo、水印、徽章、边框 | ✅ noTextRule 强制禁止，且强调品牌/产品名仅作上下文不渲染 | 符合 |
| 主图数量与构图 | 单张、单角度、无拼图/多图/内嵌小图 | ✅ Single product only, no props or text | 符合 |
| 比例 | 主图建议 1:1 | ✅ 后端生图配置 aspectRatio: '1:1' | 符合 |
| 分辨率 | 长边 ≥1000px 启用缩放，建议 1600+ | ⚠️ 未在 prompt 中指定像素；当前模型输出多为 1K 等，长边可能不足 1600 | 用户若需「启用缩放」或高分辨率展示，可自行用工具放大或换更高分辨率生图 |
| 格式与大小 | JPEG/PNG/TIFF/GIF，≤10MB | ✅ 后端输出为 base64 图，前端/存图多为 JPEG 或 PNG，尺寸由模型决定 | 符合 |
| 实际拍摄 vs AI | 政策要求主图为实际产品照片 | ⚠️ 本工具输出为 AI 生成图 | 严格解读下主图宜用实拍；生成图建议作参考或附加图，或由用户按类目/站点自判 |

**结论**：在「白底、占比、无文字、单产品、1:1」等**内容与构图**上，当前 prompt 与输出与亚马逊主图要求一致；**分辨率**需用户留意（建议长边 1600+ 时可在后处理中放大）；**AI 生成**在政策上可能不被视作「实际拍摄」，建议在界面或说明中提示用户将主图用于参考或附加图，或自行确认类目要求。
