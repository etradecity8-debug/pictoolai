# AI 美工 · 提升质感：材质预设与塑料增强

本文档说明「提升质感」功能的材质预设体系及塑料材质的专项增强逻辑。

---

## 一、材质预设体系

前端 `ProductRefinement.jsx` 中材质预设分为 **4 个 Tab**，共 **23 项**：

### 1. 工业

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 精密拉丝钢 | Brushed Precision Steel | 细腻金属线条，高端机械感 |
| 阳极氧化铝 | Anodized Matte Aluminum | 哑光高级质感，类似苹果外壳 |
| 生锈铸铁 | Weathered Rusty Cast Iron | 颗粒感强，红褐色锈迹 |
| 锻造碳纤维 | Forged Carbon Fiber | 黑色不规则纹理，现代科技 |

### 2. 自然

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 苔藓岩石 | Moss-covered Ancient Rock | 湿润绿色苔藓与粗糙石材对比 |
| 抛光黑曜石 | Polished Black Obsidian | 纯黑深邃，极高反射率 |
| 蜂窝几何 | Hexagonal Bionic Structure | 蜂巢状自然几何美感 |
| 冰裂纹陶瓷 | Cracked Celadon Glaze | 细腻釉面，交错冰裂缝隙 |
| 液态水银 | Liquid Shimmering Mercury | 流动金属液体，超现实反光 |
| 极光欧泊 | Iridescent Aurora Opal | 内部斑斓火彩 |
| 发光光纤 | Glowing Fiber Optic Bundle | 细碎导光点，科幻氛围 |
| 蜂窝透明塑料 | Translucent Honeycomb Resin | 半透明树脂，内部结构若隐若现 |

### 3. 轻奢

| 预设 | 英文 Prompt | 说明 |
|------|-------------|------|
| 抛光大理石 | Polished Italian Marble | 镜面反射，天然温润石纹 |
| 24K 喷砂金 | Sandblasted 24K Gold | 柔和金黄色泽，细腻颗粒感 |
| 乌木雕刻 | Carved Dark Ebony Wood | 深色木纹，油润光泽 |
| 磨砂彩色玻 | Frosted Dichroic Glass | 半透明，随角度变化的幻彩折射 |
| 顶级全粒面皮 | Full-grain Nappa Leather | 细小毛孔纹理，柔软皮革折痕 |
| 重磅真丝 | Heavy Mulberry Silk | 极度顺滑高光，优雅垂坠感 |
| 粗粝亚麻 | Rough Organic Linen | 明显纤维交织，自然淳朴 |
| 亮面漆皮 | High-gloss Patent Leather | 强烈镜面反光，时尚先锋感 |

### 4. 塑料（专项 Tab）

针对塑料类材质单独设 Tab，因塑料在电商摄影中易显廉价，需专门提示词增强质感：

| 预设 | 英文 Prompt | 适用场景 |
|------|-------------|----------|
| 磨砂哑光类 | Matte Satin-finish Plastic | 耳机、充电宝等消费电子，高级感、科技感 |
| 半透明树脂类 | Translucent Frosted Resin | 美妆瓶、透明灯具、透明电子产品，深邃感 |
| 高光钢琴漆类 | High-gloss Polished Acrylic | 汽车内饰、亮面家电，镜面感、硬度感 |

---

## 二、塑料「黑科技」强制增强

当用户选择或输入的材质中包含塑料相关词汇时，后端会**自动追加**以下 3 个关键提示词，以提升塑料的真实感：

| 提示词 | 作用 |
|--------|------|
| **Subsurface Scattering (SSS)** | 模拟光线进入物体内部并散射，让塑料告别「死板」实色感 |
| **Soft-touch / Tactile Texture** | 强调触感，生成高级亲肤涂层的细腻表面 |
| **Beveled Edges** | 强调边缘倒角，使光线在边缘形成漂亮的高光（Specular Highlight） |

### 触发条件

后端（`server/index.js`，product-refinement 分支）通过正则检测 `materialPrompt` 是否包含以下任一词汇（不区分大小写）：

- `plastic`
- `resin`
- `acrylic`
- `matte satin`
- `translucent frosted`
- `high-gloss polished`

命中时追加：`CRITICAL for plastic realism: emphasize Subsurface Scattering (SSS), Soft-touch tactile texture, and Beveled edges.`

---

## 三、数据流

1. **前端**：用户点击预设标签或自定义输入 → 将英文 prompt 写入 `materialPrompt` → 随请求体 `materialPrompt` 发送给后端。
2. **后端**：收到非空 `materialPrompt` 时，生成 `The subject is made of {materialPrompt}.`；若检测到塑料 → 追加塑料增强句；最后追加 `Apply macro-photography style and material-appropriate lighting. Ensure the texture enhancement matches this specific material seamlessly.`
