# 浏览器扩展（PicToolAI 修图）

## 作用

在任意网页对 `<img>` 右键：**PicToolAI → 子菜单**，抓取图片、压缩后写入扩展存储，新开 `pictoolai.studio` 对应页面并带图进入：
- **AI 美工**各功能（语言转换、局部重绘等）→ `/ai-designer/:toolId?ext=1`
- **通用电商生图**（白底主图 / 特写图 / 卖点图 / 场景图 / 交互图）→ `/detail-set?ext=1`

生成结果可 **替换原网页图片**（仅本机 DOM，不改对方服务器）。

---

## 客户试用说明（运营向）

发给客户前，请自行确认：**网站已部署含扩展握手的新代码**、`browser-extension/background.js` 中 `SITE_ORIGIN` 为 **`https://pictoolai.studio`**（本地调试才用 `http://localhost:5173`）。打包给客户时：将 **`browser-extension` 文件夹**打成 zip，**解压后第一层可见 `manifest.json`**（不要多包一层空目录）。

### 发给客户（可直接复制）

**PicToolAI 浏览器扩展（试用）**

1. **浏览器**：请使用 **Google Chrome**，或使用 **Microsoft Edge**（Chromium 新版）。
2. **解压**：将收到的 zip 解压到电脑里**固定文件夹**（例如「文档」下的一个目录）。**不要删除该文件夹**，否则扩展会失效。
3. **安装扩展**  
   - 地址栏输入 `chrome://extensions` 并回车（Edge 用户可试 `edge://extensions`）。  
   - 打开右上角 **「开发者模式」**。  
   - 点击 **「加载已解压的扩展程序」**。  
   - 选择解压后的 **`browser-extension`** 文件夹（文件夹内应有 `manifest.json`）。
4. **登录网站**：新开标签页打开 **https://pictoolai.studio** ，使用 PicToolAI 账号**登录**（扩展会打开本站；未登录无法正常使用生图与扣费）。
5. **使用**：在任意网页的**图片上**单击右键 → 点 **「PicToolAI」** → 再点**下面某一子项**（如「语言转换」「局部重绘」，或「通用电商生图 → 白底主图」等）。**不要只点父菜单「PicToolAI」**，必须再选一级子菜单。  
   - **AI 美工类**功能（语言转换、局部重绘等）：图片自动带入，直接操作即可。  
   - **通用电商生图类**（白底主图 / 特写图 / 卖点图 / 场景图 / 交互图）：图片自动带入，还需**填写产品名称**（特写图、卖点图、场景图、交互图还需填写对应描述），填完后点「分析产品」，最终在步骤 5 可下载或替换原页图片。
6. 处理完成后，若需要可将结果 **替换原网页上的那张图**（仅影响当前浏览器标签页显示；电商平台后台上架需自行上传新图）。

### 常见问题（指导客户时对照）

| 现象 | 处理 |
|------|------|
| 右键没有 PicToolAI | 打开扩展页确认扩展已**启用**；点扩展卡片上的 **重新加载** 后重试。 |
| 点了没反应 | 是否只点了父级「PicToolAI」或「通用电商生图」？必须点到**最终子项**（如「一键换色」「白底主图」）。 |
| 打开页面没有图 | 请先在本站 **https://pictoolai.studio** 登录后再从别的网页右键试。 |
| 通用电商生图页面图片区空白 | 图片载入需要 1~2 秒；若仍为空，可点「上传图片」手动上传。 |
| 通用电商生图无法点「分析产品」 | 白底主图只需填产品名称；特写图 / 卖点图 / 场景图 / 交互图还需在对应描述框填写内容后才能分析。 |
| 个别网站图抓不了 | 仅支持普通 `<img>`；防盗链、懒加载或特殊结构可能导致失败，换一张图或另存为本地再上传至站内亦可。 |

### 正式发行（可选）

长期可提交 **Chrome 网上应用店**，客户无需开启开发者模式；权限与隐私说明见 `browser-extension/README.md` 中「打包上架」。

---

## 架构要点

| 环节 | 说明 |
|------|------|
| `background.js` | 右键菜单、抓取 URL、`fetch` 转 data URL、多档压缩、`chrome.storage`、打开站点、`setupPicToolTab` 注入 `bridge.js` + MAIN 世界 `postMessage` / `CustomEvent` |
| `bridge.js` | 读 `pictoolai_pending`、向页面发 `PICTOOLAI_IMPORT`、处理 ACK 清存储、转发「替换原页」到 background |
| `AiDesigner.jsx`（`?ext=1`） | 模块级 `extensionImportPayloadCache`（应对 Strict Mode + ACK 清空 storage）、`lastAppliedExtImportKey` 去重（避免 MAIN 与 `message` 双投递重复 setState）、`extensionForTool` 与各子页 props |
| `DetailSet.jsx`（`?ext=1`） | 模块级 `detailSetExtImportCache` + 两段 useEffect（Step 1 同步握手写 `extImport` state；Step 2 带 `cancelled` 的 async 转图，按 toolId 预设对应类型张数）；`extensionMeta` 供步骤 5「替换原网页图片」 |
| 大图备选 | 登录后 `POST/GET /api/extension/prep-image`，见 `server/index.js` |

本地开发将 `browser-extension/background.js` 顶部 `SITE_ORIGIN` 改为 `http://localhost:5173`；**默认仓库值为线上** `https://pictoolai.studio`。

## 右键菜单与路由（toolId）

当前子菜单对应关系（`PicToolAI >` 父菜单下）：

| 子菜单 | 打开路由 | 说明 |
|--------|---------|------|
| 语言转换 | `/ai-designer/text-translate?ext=1` | `ImageEdit` |
| 文字替换 | `/ai-designer/text-replace?ext=1` | `ImageEdit` |
| 文字去除 | `/ai-designer/text-remove?ext=1` | `LocalErase` variant |
| 一键换色 | `/ai-designer/one-click-recolor?ext=1` | `OneClickRecolor` |
| 局部重绘 | `/ai-designer/local-redraw?ext=1` | `LocalRedraw` |
| 局部消除 | `/ai-designer/local-erase?ext=1` | `LocalErase` |
| 智能扩图 | `/ai-designer/smart-expansion?ext=1` | `SmartExpansion` |
| **通用电商生图 ▶**（子菜单组） | — | 以下 5 项均打开 `/detail-set?ext=1`，带入产品图并预设对应类型 × 1；需填产品名称（+ 描述）后点分析 |
| └ 白底主图 | `/detail-set?ext=1` toolId=`detail-set-main` | 无需额外描述，填产品名即可分析 |
| └ 特写图 | `/detail-set?ext=1` toolId=`detail-set-closeup` | 需填 1 条特写细节描述 |
| └ 卖点图 | `/detail-set?ext=1` toolId=`detail-set-sellingpoint` | 需填 1 条卖点描述 |
| └ 场景图 | `/detail-set?ext=1` toolId=`detail-set-scene` | 需填 1 条场景描述 |
| └ 交互图 | `/detail-set?ext=1` toolId=`detail-set-interaction` | 需填 1 条交互描述 |

步骤 5 生成结果：若从扩展进入，每张图旁除「保存到本地」外还显示绿色**「替换原网页图片」**按钮，点击后在来源标签页替换被右键的那张图（仅本机 DOM）。

## AI 美工：哪些适合扩展、哪些需额外改造

**已接入扩展带图 + 结果区「替换原网页」**（或 `ImageEdit` 内统一按钮）：上表工具 + 修改图片各模式（`IMAGE_EDIT_MODE_IDS`）。

**可带图、界面本身有上传/选库**：多数「图片编辑」「质量提升」子页；扩展写入后与「上传/作品库」等价。

**暂未接入扩展菜单、可后续加**（需在各页补 `initialExtensionImage` / `extensionMeta` 与 `ExtensionReplaceButton`，与 `LocalRedraw` 同模式）：`product-refinement`、`scene-generation`、`add-person-object`、`clothing-3d`、`clothing-flatlay`、`body-shape`、`style-change`、`watermark-add`、`watermark-remove`（侧栏「水印」分类）等。

**需较大改造或不适合一键右键**：

- **风格复刻**（`StyleClone`）：独立全页流程，无与其它页一致的「单图上传槽」；若要支持需单独设计入口与状态。

## 调试

见 `browser-extension/README.md`（Service Worker 网络记录、须点子菜单、MAIN 世界注入、`origin` 勿误拦扩展消息等）。
