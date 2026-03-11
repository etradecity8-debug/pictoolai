# 智能扩图：提示词与改进说明

本文档记录智能扩图（smart-expansion）的 prompt 设计依据与后续优化方向。

---

## 一、官方建议摘要

1. **核心原则**：不要描述已有内容，要描述「缺失」的内容。AI 需要知道边缘之外应该出现什么，并保持与原图的逻辑统一。

2. **1+N 模板**：`[固定前缀] + [视觉反推内容] + [质量控制词]`
   - 固定前缀：Outpaint and extend the boundaries of the image.
   - 视觉反推：通过 Gemini 识别原图内容（如 woman, flowers, garden）
   - 质量控制：Seamless transition, consistent lighting, matching textures, high resolution

3. **内容延续**：
   - 主体延伸：若主体被裁切（如肩膀），prompt 需包含 "complete the person's shoulders and clothing"
   - 虚化延续：若原图背景虚化，需加 "maintain the shallow depth of field and bokeh"

4. **推荐模型**：Nano Banana 2（扩图对全局逻辑、背景补全要求高于微观纹理，NB2 生成快且稳健）

---

## 二、当前实现（已实现两轮调用）

- **生图模型**：Nano Banana 2
- **第一步（视觉分析）**：使用 `ANALYSIS_MODEL_ID`（gemini-2.5-flash）分析原图，提取 5–10 个关键词（主体、背景元素、光照风格）
- **第二步（生图）**：将关键词注入 `[CONTENT TO ADD] Extend the following elements: {keywords}.` 模板，调用 Nano Banana 2 生图
- **降级**：若分析失败，自动回退为通用 [CONTENT TO ADD] 描述，不影响生图
