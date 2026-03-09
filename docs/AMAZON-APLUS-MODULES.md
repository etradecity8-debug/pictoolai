# 亚马逊 A+ 模块定义与本项目支持

亚马逊标准 A+ 有 **17 种模块**，每个 listing 最多约 5 个模块。**无强制必选**，由卖家自由组合。本系统**全部支持 17 种**，客户在 Step 4 可先选「推荐套餐」或**自定义从 17 种中勾选**（最多 5 个），按所选模块生成文案与图片。

---

## 17 种模块 ID 与规格

| 序号 | 模块 ID | 中文名 | 图片 | 文案 | 说明 |
|-----|--------|--------|------|------|------|
| 1 | `header` | 图片页头 | 1 张 16:9 | 标题 ≤50 + 正文 300–500 字 | 顶部大图横幅 |
| 2 | `single_highlights` | 单图+亮点 | 1 张 1:1 | 标题 ≤50 + 4 条亮点 ≤80 字 | 单图+要点列举 |
| 3 | `image_dark_overlay` | 深色文字叠加图 | 1 张 16:9 | 标题+正文（叠在深色区） | 图上深色区叠字 |
| 4 | `image_white_overlay` | 浅色文字叠加图 | 1 张 16:9 | 标题+正文（叠在浅色区） | 图上浅色区叠字 |
| 5 | `comparison_chart` | 对比表格 | 无 | 多行 feature/value1/value2 | 多产品对比（纯文案） |
| 6 | `multiple_images` | 多图模块 | 4 张 1:1 | 4 块 title+desc | 4 张图+说明 |
| 7 | `product_description` | 产品描述长文 | 无 | ≤2000 字 | 纯文字 |
| 8 | `company_logo` | 品牌 Logo | 1 张 16:9 | 可选 logoCaption | 品牌/Logo 图 |
| 9 | `single_image_sidebar` | 单图+侧栏 | 1 张 1:1 | 标题 ≤50 + 正文 ≤400 | 1 图+侧边文案 |
| 10 | `standard_text` | 纯文字 | 无 | ≤500 字 | 纯文字 |
| 11 | `quad_images` | 四图+文字 | 4 张 1:1 | 4 块 ≤100 字 | 四功能点图文 |
| 12 | `tech_specs` | 技术规格 | 无 | 最多 10 行 name+value | 规格表 |
| 13 | `single_right_image` | 右图左文 | 1 张 1:1 | 标题 ≤50 + 正文 ≤160 | 图在右 |
| 14 | `three_images` | 三图+文字 | 3 张 1:1 | 3 块 标题+正文 | 三功能点图文 |
| 15 | `single_left_image` | 左图右文 | 1 张 1:1 | 标题 ≤50 + 正文 ≤450 | 图在左 |
| 16 | `single_image_specs` | 单图+规格 | 1 张 1:1 | 标题+要点列表(≤5条) | 1 图+规格要点 |
| 17 | `brand_story` | 品牌故事 | 无 | 标题 ≤8 字 + 正文 60–80 字 | 品牌段落 |

生图比例：页头/叠加/Logo 用 16:9，其余用 1:1；导出到 Seller Central 时用户可按亚马逊要求裁剪。

---

## 推荐套餐（前端预设）

| 套餐 | 模块组合 | 图片张数 |
|------|----------|----------|
| 基础 | header + three_images + tech_specs | 4 |
| 标准 | header + single_highlights + three_images + tech_specs + brand_story | 5 |
| 精品 | header + single_highlights + quad_images + tech_specs + brand_story | 6 |

**自定义**：从上述 17 种中勾选，最多 5 个，按选择顺序生成。

---

## 接口约定

- **analyze**：请求体 `modules: string[]`（如 `['header','three_images','tech_specs']`）。返回的 `copy` 按模块拆分各字段；`_modules` 为本次所选模块列表。
- **generate**：请求体 `modules: string[]` 与 analyze 一致。按模块顺序生图，返回 `moduleImages: { header?, single_highlights?, three_images?, quad_images?, image_dark_overlay?, ... }`，纯文字模块无图。

详见实现代码与 `AMAZON-LISTING-SPEC.md`。
