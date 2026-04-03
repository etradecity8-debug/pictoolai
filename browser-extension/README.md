# PicToolAI 浏览器扩展（Chromium）

**给客户用的安装与说明文案**（运营可复制）：见仓库 **`docs/BROWSER-EXTENSION.md`** 中 **「客户试用说明」** 一节。

## 功能

- 在任意网页对图片使用右键菜单：**PicToolAI →** 语言转换、文字替换、文字去除、一键换色、局部重绘、局部消除、智能扩图
- 自动打开 `pictoolai.studio` 对应 AI 美工页面并载入该图；生成完成后可点 **替换原网页图片**，将来源页面上被标记的 `<img>` 替换为结果图（仅修改当前浏览器 DOM，不修改对方服务器）。

## 本地开发

1. 打开 Chrome → **扩展程序** → **开发者模式** → **加载已解压的扩展程序**，选择本目录 `browser-extension`。
2. 若站点跑在本地（如 Vite `http://localhost:5173`），请编辑 `background.js` 顶部常量：

   ```js
   const SITE_ORIGIN = 'http://localhost:5173'
   ```

   **重要**：`content_scripts` 对带端口 URL 易踩坑；仓库已在 **background** 里于新开 PicToolAI 标签 **`loading → complete` 后用 `chrome.scripting.executeScript` 注入 `bridge.js`**，本地开发一般不再依赖 manifest 匹配。

3. 后端需可访问（前端代理或同源），并已登录 PicToolAI 账号。

## 打包上架（Chrome Web Store）

1. 将 `browser-extension` 目录打包为 zip（根目录含 `manifest.json`）。
2. **权限说明（供审核 / 隐私政策）**：
   - `contextMenus`：在图片上显示右键菜单。
   - `storage`：临时存放待导入站点的压缩图（`session` / `local`），页面确认接收后清除。
   - `scripting`：在来源标签页为目标 `<img>` 打标记、生成完成后替换 `src`。
   - `tabs`：定位来源标签页并注入脚本。
   - `host_permissions: <all_urls>`：从任意网页抓取图片 URL（扩展内 `fetch` 不受普通网页 CORS 限制）；仅向用户选择的 PicToolAI 站点传图。
3. **数据与隐私**：扩展不收集独立用户数据；图片仅在用户右键触发后经压缩写入浏览器临时存储并打开 PicToolAI 标签页；编辑与扣费在 PicToolAI 网站完成。若需说明「与 pictoolai.studio 通信」，可写：仅向该域名页面注入脚本并传递用户本次选择的图片数据。

## 大图与降级

- 扩展侧对图片做多档压缩（1024 / 768 / 512 边长）并写入 `chrome.storage`；失败时回退到 `storage.local`。
- 服务端提供一次性读取接口（登录后）：`POST /api/extension/prep-image`、`GET /api/extension/prep-image/:id`，供未来扩展或其它客户端在存储配额不足时改用（当前扩展主路径仍以浏览器存储为主）。

## 调试说明

- **Service Worker 的 Network**：面板往往在**你打开该 DevTools 之后**才开始记请求；若第一次抓图发生在打开面板之前，可能看不到那一行，属正常现象。应以**是否真能带图**为准。
- **右键菜单**：必须点到 **子项**（如「语言转换」）。只点父级「PicToolAI」不会触发抓图；此时 Service Worker Console 会有提示。
- **带图进页面**：除 `bridge.js` 外，后台会用 `chrome.scripting.executeScript` 的 **`world: 'MAIN'`** 把 payload 直接送进页面（与 React 同环境），避免仅依赖隔离世界 `postMessage` 时收不到的问题。

## 故障排除：打开 AI 美工后没有自动出现图片

- 页面侧**不要**用 `ev.origin === location.origin` 过滤扩展 `postMessage`：来自 content script 的消息 `origin` 常为字符串 `"null"`，会被误拦截（仓库已去掉该判断）。
- 本地开发使用 **Vite + React Strict Mode** 时，effect 会跑两次，第一次确认会清空扩展 `storage`，需在 **`AiDesigner` 里用模块级缓存** 保留本次导入（仓库已处理）。
- 请确认 `vite.config.js` 将 `/api` 代理到后端（默认 `localhost:3001`），并已 `npm run dev` + 启动 `server`。
- 请确认网站已包含 **`AiDesigner` 扩展握手**（不过滤 `ev.source`；见上文缓存）。
- 在 `chrome://extensions` 对 PicToolAI 扩展点 **重新加载**，再试右键菜单。

## 限制

- 仅支持右键上下文为图片的 `<img>`；CSS `background-image`、Shadow DOM 内图片等可能无法标记或替换。
- 「替换原网页」只影响当前浏览器标签页中的 DOM；商品后台需用户自行上传新图。
