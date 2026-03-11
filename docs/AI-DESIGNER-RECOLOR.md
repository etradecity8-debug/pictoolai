# AI 美工 · 一键换色

## 功能说明

用户上传图片，用**文字描述**要换色的物体（如“鼠标”“裙子”“头发”），从色卡或自定义取色中选择 1–9 种颜色，即可批量生成多种配色图。

## 交互方式

- **文字描述**：不采用圈图/遮罩，改为用户输入要换色的物体名称。AI 根据语义识别目标并换色，更有利于保留物体形状与结构。
- **颜色选择**：
  - 色卡：24 种预设颜色
  - 自定义：支持 hex 输入 + 系统取色器，可添加任意颜色
  - 最多 9 种颜色，每种生成一张图

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/pages/ai-designer/OneClickRecolor.jsx` | 一键换色页面 |
| `src/pages/AiDesigner.jsx` | AI 美工主框架，路由 `/ai-designer/:toolId` |
| `server/index.js` | `/api/image-edit` 的 `mode: 'recolor'` |
| `public/recolor-demo-original.png` | 示例原图（米色连衣裙） |
| `public/recolor-demo-edited.png` | 示例换色后（绿色连衣裙） |

## 后端 API

- **接口**：`POST /api/image-edit`
- **参数**：`mode: 'recolor'`，`textDescription`（要换色的物体），`targetColor`（hex），`colorName`（可选），`images: [dataUrl]`
- **逻辑**：与局部重绘/消除相同，从输入图推断比例与清晰度；prompt 由 `textDescription` + `targetColor` 构建。
- **积分**：按单张生成扣积分，与 `getPointsPerImage` 一致。

## 示例图

- 原图：`/recolor-demo-original.png`（米色连衣裙）
- 换色后：`/recolor-demo-edited.png`（绿色连衣裙）
