# 已知问题与待办（后续再改）

## 待后续改进

### 仓库保存/下载体验

- **现状与不满**：当前单张用「另存为」（showSaveFilePicker）可正常选路径保存；多张用「选择文件夹」（showDirectoryPicker）一次性写入，但部分目录（如含系统/隐藏文件）会被浏览器拒绝并提示「含有系统文件」，导致无法保存。用户对该块体验不满意，后续需再改。
- **约束**：多张若改为「每张弹一次另存为」（showSaveFilePicker 循环），选 1 万张就要点 1 万次，不可接受；因此多张仍需「选一次文件夹」的机制，但需在浏览器限制下找到更好方案（例如引导用户选子文件夹、或后续有更合适的 API/产品方案再优化）。

## 今日完成（2026-03-05）

- **设计规范与图片规划**：改为 Markdown 渲染（`react-markdown` + `remark-breaks`），不再做自定义换行/字体解析；支持单换行显示。
- **重置**：整体设计规范、图片规划在编辑时可「重置」到分析首次返回的原始内容。
- **步骤 5**：「返回上一步」→ 步骤 3；「新建项目」→ 步骤 1；确认弹窗改为自定义（不显示 localhost、字体更大）。
- **图片展示**：一行两图、更大；图片规划分析只填主标题，副标题/说明留空供用户自填。
- **进度条**：分析中/生成中全页遮罩内增加不确定进度条。
- **仓库**：SQLite 数据库（`server/db.js` + `picaitool.db`）+ `server/gallery/` 存图；登录用户生成图**自动**写入仓库；每张图可「保存到本地」下载；工作台 → 仓库从接口拉取并展示。
- **README**：补充数据库概念（SQLite vs MySQL/PostgreSQL）、已知问题/后续可做与文档同步。
- **侧栏与路由**：「工作台」改为仅保留「仓库」入口（`/dashboard/gallery`）；访问 `/dashboard` 重定向到 `/dashboard/gallery`。
- **仓库批量删除**：仓库页增加「删除选中」按钮，对选中图片逐个调用 DELETE 并更新列表与选中状态。
- **生图文字不裁切**：在 `server/index.js` 生图 prompt 中强化 `safeAreaRule`，要求整段标题完整在画面内、四周留足边距、禁止单词在边缘被裁切（如 "DURABILITY" 不得只露出一部分）。

## 历史记录（已处理）

### 整体设计规范显示方式（已改为 Markdown 渲染）

- 前端已删除 `SECONDARY_LABELS`、`splitBySecondaryLabels`、`parseLabelLine`；`SpecPreview` 与图片规划描述均用 `react-markdown` 渲染。
- 若分析结果格式不规范，可在 `server/index.js` 的分析 prompt 中约定输出为规范 Markdown。

---

## 文档与代码归档说明

- 项目说明与结构见根目录 `README.md`。
- 后端接口与模型配置见 `server/index.js`、`server/gemini-models.js`、`server/db.js`。
- 全品类组图流程、设计规范与图片规划逻辑见 `src/pages/DetailSet.jsx` 及本目录下的记录。
