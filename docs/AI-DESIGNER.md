# AI 美工完整说明

本文档说明 AI 美工（`/ai-designer`）下**全部功能**：图片编辑（局部重绘、局部消除、一键换色）、质量提升（智能扩图、提升质感）、文字修改（文字替换、语言转换）、**风格复刻**、官方示例（7 种修改图片模式）。

**路由**：`/ai-designer`、`/ai-designer/:toolId`。侧边栏分为：图片编辑、质量提升、图像修复、抠图工具、**文字修改**（文字替换、语言转换）、**风格复刻**、官方示例。

---

## UI 布局与广告词（2026-03 统一）

五个功能模块（局部重绘、局部消除、一键换色、智能扩图、提升质感）采用统一排版规范：

| 元素 | 规范 |
|------|------|
| 标题 | `text-2xl font-bold` |
| 副文案 | `text-base text-gray-600` |
| 示例图 | `w-72 h-72`（288px）、`rounded-lg` |
| 主内容卡片 | `max-w-3xl mx-auto p-4` |
| 主操作按钮 | `max-w-xs mx-auto py-2.5 rounded-lg text-sm` |
| 保存按钮 | 紧贴生成结果放置 |

**各模块广告词**：

| 模块 | 第一行 | 第二行 |
|------|--------|--------|
| 提升质感 | 提升质感 | 内置专业材质引擎，一键让你的产品图从「地摊货」变身「奢侈品」。 |
| 智能扩图 | 智能扩图，视界大开。 | 不再受限于快门的瞬间，PicToolAI 自动识别你的构图，智能补全缺失的肩膀、延伸的花海、广阔的星空。 / 每一像素的扩展，都与原图浑然一体。 |
| 一键换色 | 一键换色 | 无论是时装还是产品，一键精准换色，效率提升 10 倍 |
| 局部重绘 | 局部重绘 | 上传图片，涂抹需要改变的区域并输入想要改变的内容，即可重新对该区域进行绘制 |
| 局部消除 | 局部消除 | 上传需要消除的图片，使用画笔涂抹即可实现一键消除 |

---

# 第一部分：局部重绘

上传图片 → 用画笔在画布上涂出要修改的区域（紫色半透明遮罩）→ 填写文字 prompt 描述希望该区域变成什么 → 生成。AI 根据遮罩与 prompt 重绘该区域，保留原图其余部分。

- **文件**：`src/pages/ai-designer/LocalRedraw.jsx`
- **接口**：`POST /api/image-edit`，`mode: 'inpainting'`（遮罩 + prompt）
- **支持从仓库选图**：`GalleryThumb` 认证加载；生成后自动入图库。
- **示例图**：`public/local-redraw-demo-original.png`、`local-redraw-demo-edited.png`、`local-redraw-demo-comparison.png`

---

# 第二部分：局部消除

上传图片 → 用画笔涂出要消除的区域 → 生成。AI 自动修补/消除该区域（如去掉桌面上的杂物、水印等）。

- **文件**：`src/pages/ai-designer/LocalErase.jsx`
- **接口**：`POST /api/image-edit`，`mode: 'add-remove'`（遮罩区域 + 消除类 prompt，移除选中内容）
- **示例图**：`public/local-erase-demo-original.png`、`local-erase-demo-edited.png`

---

# 第三部分：一键换色

用户上传图片，用**文字描述**要换色的物体（如「鼠标」「裙子」「头发」），从色卡或自定义取色中选择 1–9 种颜色，即可批量生成多种配色图。

- **文字描述**：不采用圈图/遮罩，AI 根据语义识别目标并换色。
- **颜色选择**：色卡 24 种预设 + 自定义 hex/取色器；最多 9 种颜色，每种生成一张图。
- **文件**：`src/pages/ai-designer/OneClickRecolor.jsx`
- **接口**：`POST /api/image-edit`，`mode: 'recolor'`，`textDescription`，`targetColor`（hex），`images: [dataUrl]`
- **逻辑**：从输入图推断比例与清晰度；prompt 由 `textDescription` + `targetColor` 构建。
- **示例图**：`public/recolor-demo-original.png`、`recolor-demo-edited.png`

---

# 第四部分：智能扩图

## 官方建议摘要

1. **核心原则**：不要描述已有内容，要描述「缺失」的内容。AI 需要知道边缘之外应该出现什么，并保持与原图的逻辑统一。
2. **1+N 模板**：`[固定前缀] + [视觉反推内容] + [质量控制词]`
3. **内容延续**：主体延伸（如 complete the person's shoulders）、虚化延续（maintain shallow depth of field and bokeh）。
4. **推荐模型**：Nano Banana 2（扩图对全局逻辑、背景补全要求高于微观纹理）。

## 当前实现

- **生图模型**：Nano Banana 2
- **第一步（视觉分析）**：使用 `ANALYSIS_MODEL_ID`（gemini-2.5-flash）分析原图，提取 5–10 个关键词（主体、背景元素、光照风格）
- **第二步（生图）**：将关键词注入 `[CONTENT TO ADD] Extend the following elements: {keywords}.` 模板，调用 Nano Banana 2 生图
- **降级**：若分析失败，自动回退为通用描述，不影响生图

---

# 第五部分：提升质感

## 一、模型选择（Pro vs 2）

| 处理对象 | 建议模型 | 说明 |
|----------|----------|------|
| **精密零件、珠宝、高级家具** | Nano Banana Pro | 能捕捉微小的加工痕迹和复杂的环境反射 |
| **美食、风景、时尚人像** | Nano Banana 2 | 色彩处理更讨喜，光影通透 |
| **只想让模糊的图变清晰** | 先试 Nano Banana 2 | 边缘锐化处理非常干练 |

### 详细对比

| 维度 | Nano Banana 2（速度优先） | Nano Banana Pro（极致细节） |
|------|---------------------------|------------------------------|
| **核心优势** | 快如闪电，生图速度约快 3～5 倍 | 深层推理、材质大师，理解金属折射、织物纤维 |
| **质感表现** | 现代感强，光影明亮生动 | 极度真实，纹理细节深邃且富有层次 |
| **推荐场景** | 批量处理、社交媒体、初步预览 | 商业摄影、工业设计、4K 画质需求 |
| **生成时间** | 约 4～6 秒（1K） | 约 10～20 秒 |

### 快速决策

- 追求质感与真实感 → 选 Pro
- 追求速度与效率 → 选 2
- 金属、珠宝、精密件 → 选 Pro
- 美食、风景、人像 → 选 2

---

## 二、材质预设体系

前端 `ProductRefinement.jsx` 中材质预设 Tab 顺序：**电子 / 塑料 / 纺织 / 木质 / 玻璃 / 工业 / 自然 / 轻奢**。**悬停**预设标签可查看效果说明（hint）。

### 电子

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| CNC 刀痕 | CNC machining marks | 金属外壳极细螺旋痕迹 |
| 喷砂氧化 | Sandblasted matte oxidation | 类似 MacBook 均匀磨砂 |
| 拉丝金属 | Linear brushed metal | 方向性反光不锈钢感 |
| LED 漫反射 | Diffused LED glow | 指示灯光在壳内散开 |
| 精密接缝 | Tight tolerance gaps | 零件间近乎无缝装配 |

### 塑料

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 磨砂哑光类 | Matte Satin-finish Plastic | 耳机、充电宝等消费电子 |
| 半透明树脂类 | Translucent Frosted Resin | 美妆瓶、透明灯具、透明电子产品 |
| 高光钢琴漆类 | High-gloss Polished Acrylic | 汽车内饰、亮面家电 |
| 类皮质涂层 | Soft-touch coating | 高端耳机/鼠标的亲肤、略粗糙触感 |
| 缎面哑光 | Satin matte finish | 介于高光与全磨砂之间 |
| 微观皮纹 | Micro-stipple texture | 工业塑料细微凹凸，防滑防指纹 |
| 透明亚克力 | Clear polished acrylic | 极高透明度与边缘折射 |
| 蜂窝透明塑料 | Translucent Honeycomb Resin | 半透明树脂，内部结构若隐若现 |

### 纺织

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 细致经纬线 | Detailed warp and weft | 横竖交织线头可见 |
| 表面浮绒 | Surface micro-fibers | 边缘极细小逆光短绒毛 |
| 粗捻线感 | Coarse slub texture | 亚麻/粗布不规则粗细 |
| 粗粝亚麻 | Rough Organic Linen | 明显纤维交织，自然淳朴 |
| 丝绸虹彩 | Silk iridescence | 随角度变化的金属般光泽 |
| 重磅悬垂 | Heavy drape folds | 高克重深邃厚重褶皱 |
| 华夫格纹 | Waffle weave pattern | 立体方格凹凸针织 |
| 吸光天鹅绒 | Light-absorbing velvet | 极黑极深，几乎不反射光 |
| 重磅真丝 | Heavy Mulberry Silk | 极度顺滑高光，优雅垂坠感 |

### 木质

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 开放漆纹理 | Open-pore grain | 木材导管深度的原始质感 |
| 浮雕木纹 | Raised grain texture | 纹理明显凹凸起伏 |
| 丝绒漆面 | Velvet lacquer finish | 薄而温润的半哑光保护层 |
| 碳化处理 | Charred Yakisugi finish | 轻微烧灼后黑亮鳞片质感 |
| 抛光蜡感 | Wax-polished sheen | 深层油脂光泽 |
| 琥珀色光泽 | Amber depth | 光线穿透漆面照到纤维 |

### 玻璃

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 高折射率 | High IOR reflections | 更厚重、类水晶 |
| 色散彩虹边缘 | Chromatic aberration caustics | 光线穿透形成彩色焦散 |
| 磨砂酸洗 | Acid-etched frosting | 极细均匀雾面 |
| 钢化波纹 | Tempered glass ripples | 侧光下应力纹 |
| 真空镀膜 | Vacuum-deposited coating | 镜片紫红或蓝色反光 |
| 磨砂彩色玻 | Frosted Dichroic Glass | 半透明，随角度变化的幻彩折射 |

### 工业

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 精密拉丝钢 | Brushed Precision Steel | 细腻金属线条，高端机械感 |
| 阳极氧化铝 | Anodized Matte Aluminum | 哑光高级质感，类似苹果外壳 |
| 生锈铸铁 | Weathered Rusty Cast Iron | 颗粒感强，红褐色锈迹 |
| 锻造碳纤维 | Forged Carbon Fiber | 黑色不规则纹理，现代科技 |
| 液态水银 | Liquid Shimmering Mercury | 流动金属液体，超现实反光 |
| 发光光纤 | Glowing Fiber Optic Bundle | 细碎导光点，科幻氛围 |

### 自然

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 苔藓岩石 | Moss-covered Ancient Rock | 湿润绿色苔藓与粗糙石材对比 |
| 抛光黑曜石 | Polished Black Obsidian | 纯黑深邃，极高反射率 |
| 蜂窝几何 | Hexagonal Bionic Structure | 蜂巢状自然几何美感 |
| 冰裂纹陶瓷 | Cracked Celadon Glaze | 细腻釉面，交错冰裂缝隙 |
| 极光欧泊 | Iridescent Aurora Opal | 内部斑斓火彩 |

### 轻奢

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 抛光大理石 | Polished Italian Marble | 镜面反射，天然温润石纹 |
| 24K 喷砂金 | Sandblasted 24K Gold | 柔和金黄色泽，细腻颗粒感 |
| 乌木雕刻 | Carved Dark Ebony Wood | 深色木纹，油润光泽 |
| 顶级全粒面皮 | Full-grain Nappa Leather | 细小毛孔纹理，柔软皮革折痕 |
| 亮面漆皮 | High-gloss Patent Leather | 强烈镜面反光，时尚先锋感 |

---

## 三、塑料「黑科技」强制增强

当用户选择或输入的材质中包含塑料相关词汇时，后端会**自动追加**以下 3 个关键提示词：

| 提示词 | 作用 |
|--------|------|
| **Subsurface Scattering (SSS)** | 模拟光线进入物体内部并散射，让塑料告别「死板」实色感 |
| **Soft-touch / Tactile Texture** | 强调触感，生成高级亲肤涂层的细腻表面 |
| **Beveled Edges** | 强调边缘倒角，使光线在边缘形成漂亮的高光 |

### 触发条件

后端通过正则检测 `materialPrompt` 是否包含：`plastic`、`resin`、`acrylic`、`matte satin`、`translucent frosted`、`high-gloss polished`（不区分大小写）。

命中时追加：`CRITICAL for plastic realism: emphasize Subsurface Scattering (SSS), Soft-touch tactile texture, and Beveled edges.`

---

## 五、数据流

1. **前端**：用户点击预设标签或自定义输入 → 将英文 prompt 写入 `materialPrompt` → 随请求体发送给后端。
2. **后端**：收到非空 `materialPrompt` 时，生成 `The subject is made of {materialPrompt}.`；若检测到塑料 → 追加塑料增强句；最后追加 `Apply macro-photography style and material-appropriate lighting.`

---

# 第六部分：文字修改

侧边栏「文字修改」位于「抠图工具」与「官方示例」之间，提供 2 种模式，与主导航「修改图片」功能相同，均调用 `POST /api/image-edit`。

| 模式 ID | 中文名 | 说明 |
|---------|--------|------|
| `text-replace` | 文字替换 | 替换图中的文字内容 |
| `text-translate` | 语言转换 | 将图中文字翻译为另一语言 |

**页面排版**：从 ai-designer 进入时，采用与其它模块统一的布局——标题居中、副文案 text-base、主内容 max-w-3xl 白底卡片；上传区文案「上传图片」「从作品库选择」。

---

# 第七部分：风格复刻

侧边栏「风格复刻」位于「文字修改」与「官方示例」之间。上传参考设计图（最多 14 张）与产品素材图（最多 6 张），AI 两阶段生成：① 分析参考图风格；② 按产品图 + 风格描述生图。

- **路由**：`/ai-designer/style-clone`
- **文件**：`src/pages/StyleClone.jsx`
- **接口**：`POST /api/style-clone`（需登录）
- **提示**：参考图「最好只上传一种风格」；产品图「只上传一个产品」。
- 详见 `docs/KNOWN_ISSUES.md` 风格复刻功能说明。

---

# 第八部分：官方示例（7 种修改图片模式）

AI 美工侧边栏「官方示例」下提供 7 种修改图片模式（与风格复刻同级），与主导航「修改图片」功能相同，均调用 `POST /api/image-edit`。每种模式有真实 before→after 示例（`ModeDemo` 组件）。

| 模式 ID | 中文名 | 说明 |
|---------|--------|------|
| `add-remove` | 添加/移除元素 | 在图中添加或移除指定物体 |
| `inpainting` | 局部重绘（语义遮盖） | 根据遮罩区域与 prompt 重绘 |
| `style-transfer` | 风格迁移 | 将图片迁移到指定视觉风格 |
| `composition` | 高级合成：多图组合 | 多张参考图组合成新图 |
| `hi-fidelity` | 高保真细节保留 | 保留原图细节的同时优化 |
| `bring-to-life` | 让草图变生动 | 将线稿/草图转为写实图 |
| `character-360` | 角色一致性：360° 全景 | 保持角色外观一致的多角度 |

- **后端**：`server/index.js` 的 `/api/image-edit` 根据 `mode` 参数分支处理；含重试逻辑（Pro/Nano2 最多 3 次）。
- **支持从仓库选图**：`GalleryThumb` 组件认证加载；生成后自动入图库，显示积分消耗。
- **演示图**：`public/demo-*.png`（各模式 before/after，共 14 张）
