# 浏览器扩展（PicToolAI 修图）

## 作用

在任意网页对 `<img>` 右键：**PicToolAI → 子菜单**，抓取图片、压缩后写入扩展存储，新开 `pictoolai.studio` 对应页面并带图进入：
- **AI 美工**各功能（语言转换、局部重绘等）→ `/ai-designer/:toolId?ext=1`
- **通用电商生图**（白底主图 / 特写图 / 卖点图 / 场景图 / 交互图）→ `/detail-set?ext=1`

生成结果请在 PicToolAI 内 **保存到本地**（或从仓库下载），再上传到电商平台 / ERP（如店小秘）；**不会**自动写回对方后台。

---

## 分发方式与用户安装说明

**当前约定**：扩展 **zip 由用户在官网自行下载**（登录后顶栏 **浏览器扩展** 链接，静态文件 `public/pictoolai-browser-extension.zip`），运营一般**不再单独发送**压缩包。下文「用户安装步骤」可复制到帮助中心、客服话术或邮件。

### 上线 / 更新 zip 前（开发运维自检）

发布或替换线上 zip 前请确认：**站点已部署含扩展握手的代码**；打包进 `public/` 的 zip 来自仓库 **`browser-extension/`** 目录，且 **`background.js` 中 `SITE_ORIGIN` 为 `https://pictoolai.studio`**（仅本地调试改为 `http://localhost:5173`）。打 zip 时：**解压后第一层须直接可见 `manifest.json`**（勿多包一层空目录）。更新源码后重新打包并覆盖 `public/pictoolai-browser-extension.zip`，与 `Header` 下载链接一致。

### 用户安装步骤（可直接复制）

**PicToolAI 浏览器扩展**

1. **下载**：登录 **https://pictoolai.studio**，在顶栏点击 **浏览器扩展**（或同等入口），下载 zip 文件。
2. **浏览器**：请使用 **Google Chrome**，或使用 **Microsoft Edge**（Chromium 新版）。
3. **解压**：将**下载的** zip 解压到电脑里**固定文件夹**（例如「文档」下的一个目录）。**不要删除该文件夹**，否则扩展会失效。
4. **安装扩展**  
   - 地址栏输入 `chrome://extensions` 并回车（Edge 用户可试 `edge://extensions`）。  
   - 打开右上角 **「开发者模式」**。  
   - 点击 **「加载已解压的扩展程序」**。  
   - 选择解压后的文件夹（**解压后若最外层是 `browser-extension` 且其内含 `manifest.json`，则选该文件夹**；若 zip 解压后根目录直接是 `manifest.json` 等文件，则选这一层目录）。
5. **登录网站**：新开标签页打开 **https://pictoolai.studio** ，使用 PicToolAI 账号**登录**（扩展会打开本站；未登录无法正常使用生图与扣费）。
6. **使用**：在任意网页的**图片上**单击右键 → 点 **「PicToolAI」** → 再点**下面某一子项**（如「语言转换」「局部重绘」，或「通用电商生图 → 白底主图」等）。**不要只点父菜单「PicToolAI」**，必须再选一级子菜单。  
   - **AI 美工类**功能（语言转换、局部重绘等）：图片自动带入，直接操作即可。  
   - **通用电商生图类**（白底主图 / 特写图 / 卖点图 / 场景图 / 交互图）：图片自动带入，还需**填写产品名称**（特写图、卖点图、场景图、交互图还需填写对应描述），填完后点「分析产品」，步骤 5 可 **保存到本地** 后自行上传至 ERP / 平台后台。
7. 上架用图请以各平台 / ERP **后台实际上传的文件**为准；扩展仅缩短「网页上的图 → 带进 PicToolAI」的路径。

### 常见问题（客服 / 用户对照）

| 现象 | 处理 |
|------|------|
| 不知道去哪下载 zip | 使用电脑浏览器登录 **https://pictoolai.studio**，在顶栏找到 **浏览器扩展** 并下载；需登录账号。 |
| 右键没有 PicToolAI | 打开扩展页确认扩展已**启用**；点扩展卡片上的 **重新加载** 后重试。 |
| 点了没反应 | 是否只点了父级「PicToolAI」或「通用电商生图」？必须点到**最终子项**（如「一键换色」「白底主图」）。 |
| 打开页面没有图 | 请先在本站 **https://pictoolai.studio** 登录后再从别的网页右键试。 |
| 通用电商生图页面图片区空白 | 图片载入需要 1~2 秒；若仍为空，可点「上传图片」手动上传。 |
| 通用电商生图无法点「分析产品」 | 白底主图只需填产品名称；特写图 / 卖点图 / 场景图 / 交互图还需在对应描述框填写内容后才能分析。 |
| 个别网站图抓不了 | 仅支持普通 `<img>`；防盗链、懒加载或特殊结构可能导致失败，换一张图或另存为本地再上传至站内亦可。 |

### 正式发行（可选）

长期可提交 **Chrome 网上应用店**，用户无需开启「加载已解压」；权限与隐私说明见 `browser-extension/README.md` 中「打包上架」。

---

## 架构要点

| 环节 | 说明 |
|------|------|
| `background.js` | 右键菜单、抓取 URL、`fetch` 转 data URL、多档压缩、`chrome.storage`、打开站点、`setupPicToolTab` 注入 `bridge.js` + MAIN 世界 `postMessage` / `CustomEvent` |
| `bridge.js` | 读 `pictoolai_pending`、向页面发 `PICTOOLAI_IMPORT`、处理 ACK 清存储 |
| `AiDesigner.jsx`（`?ext=1`） | 模块级 `extensionImportPayloadCache`（应对 Strict Mode + ACK 清空 storage）、`lastAppliedExtImportKey` 去重（避免 MAIN 与 `message` 双投递重复 setState）、`extensionForTool` 与各子页 props |
| `DetailSet.jsx`（`?ext=1`） | 模块级 `detailSetExtImportCache` + 两段 useEffect（Step 1 同步握手写 `extImport` state；Step 2 带 `cancelled` 的 async 转图，按 toolId 预设对应类型张数） |
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

步骤 5 生成结果：每张图旁 **保存到本地**；上架请在 ERP / 平台后台上传该文件。

## AI 美工：哪些适合扩展、哪些需额外改造

**已接入扩展菜单带图**：上表 7 项工具 + 修改图片各模式（`IMAGE_EDIT_MODE_IDS`，通过 `ImageEdit` 进入）。

**可带图、界面本身有上传/选库**：多数「图片编辑」「质量提升」子页；扩展写入后与「上传/作品库」等价。

**暂未接入扩展菜单、可后续加**（需在各页补 `initialExtensionImage`，与 `LocalRedraw` 同模式）：`product-refinement`、`scene-generation`、`add-person-object`、`clothing-3d`、`clothing-flatlay`、`body-shape`、`style-change`、`watermark-add`、`watermark-remove`（侧栏「水印」分类）等。

**需较大改造或不适合一键右键**：

- **风格复刻**（`StyleClone`）：独立全页流程，无与其它页一致的「单图上传槽」；若要支持需单独设计入口与状态。

## 调试

见 `browser-extension/README.md`（Service Worker 网络记录、须点子菜单、MAIN 世界注入、`origin` 勿误拦扩展消息等）。
