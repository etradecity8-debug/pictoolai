# 浏览器扩展（PicToolAI 修图）

## 作用

在任意网页对 `<img>` 右键：**PicToolAI → 子菜单**，抓取图片、压缩后写入扩展存储，新开 `pictoolai.studio` 对应 AI 美工路由并带图进入；生成结果可 **替换原网页图片**（仅本机 DOM，不改对方服务器）。

## 架构要点

| 环节 | 说明 |
|------|------|
| `background.js` | 右键菜单、抓取 URL、`fetch` 转 data URL、多档压缩、`chrome.storage`、打开站点、`setupPicToolTab` 注入 `bridge.js` + MAIN 世界 `postMessage` / `CustomEvent` |
| `bridge.js` | 读 `pictoolai_pending`、向页面发 `PICTOOLAI_IMPORT`、处理 ACK 清存储、转发「替换原页」到 background |
| `AiDesigner.jsx`（`?ext=1`） | 模块级 `extensionImportPayloadCache`（应对 Strict Mode + ACK 清空 storage）、`lastAppliedExtImportKey` 去重（避免 MAIN 与 `message` 双投递重复 setState）、`extensionForTool` 与各子页 props |
| 大图备选 | 登录后 `POST/GET /api/extension/prep-image`，见 `server/index.js` |

本地开发将 `browser-extension/background.js` 顶部 `SITE_ORIGIN` 改为 `http://localhost:5173`；**默认仓库值为线上** `https://pictoolai.studio`。

## 右键菜单与路由（toolId）

当前子菜单与 `/ai-designer/:toolId` 对应关系：

| 子菜单 | toolId |
|--------|--------|
| 语言转换 | `text-translate`（`ImageEdit`） |
| 文字替换 | `text-replace` |
| 文字去除 | `text-remove`（`LocalErase` variant） |
| 一键换色 | `one-click-recolor` |
| 局部重绘 | `local-redraw` |
| 局部消除 | `local-erase` |
| 智能扩图 | `smart-expansion` |

## AI 美工：哪些适合扩展、哪些需额外改造

**已接入扩展带图 + 结果区「替换原网页」**（或 `ImageEdit` 内统一按钮）：上表工具 + 修改图片各模式（`IMAGE_EDIT_MODE_IDS`）。

**可带图、界面本身有上传/选库**：多数「图片编辑」「质量提升」子页；扩展写入后与「上传/作品库」等价。

**暂未接入扩展菜单、可后续加**（需在各页补 `initialExtensionImage` / `extensionMeta` 与 `ExtensionReplaceButton`，与 `LocalRedraw` 同模式）：`product-refinement`、`scene-generation`、`add-person-object`、`clothing-3d`、`clothing-flatlay`、`body-shape`、`style-change`、`watermark-add`、`watermark-remove`（侧栏「水印」分类）等。

**需较大改造或不适合一键右键**：

- **风格复刻**（`StyleClone`）：独立全页流程，无与其它页一致的「单图上传槽」；若要支持需单独设计入口与状态。

## 调试

见 `browser-extension/README.md`（Service Worker 网络记录、须点子菜单、MAIN 世界注入、`origin` 勿误拦扩展消息等）。
