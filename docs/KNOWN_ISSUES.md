# 已知问题与待办（后续再改）

## 今日完成（2026-03-05）

- **设计规范与图片规划**：改为 Markdown 渲染（`react-markdown` + `remark-breaks`），不再做自定义换行/字体解析；支持单换行显示。
- **重置**：整体设计规范、图片规划在编辑时可「重置」到分析首次返回的原始内容。
- **步骤 5**：「返回上一步」→ 步骤 3；「新建项目」→ 步骤 1；确认弹窗改为自定义（不显示 localhost、字体更大）。
- **图片展示**：一行两图、更大；图片规划分析只填主标题，副标题/说明留空供用户自填。
- **进度条**：分析中/生成中全页遮罩内增加不确定进度条。
- **仓库**：SQLite 数据库（`server/db.js` + `picaitool.db`）+ `server/gallery/` 存图；登录用户生成图**自动**写入仓库；每张图可「保存到本地」下载；工作台 → 仓库从接口拉取并展示。
- **README**：补充数据库概念（SQLite vs MySQL/PostgreSQL）、已知问题/后续可做与文档同步。

## 历史记录（已处理）

### 整体设计规范显示方式（已改为 Markdown 渲染）

- 前端已删除 `SECONDARY_LABELS`、`splitBySecondaryLabels`、`parseLabelLine`；`SpecPreview` 与图片规划描述均用 `react-markdown` 渲染。
- 若分析结果格式不规范，可在 `server/index.js` 的分析 prompt 中约定输出为规范 Markdown。

---

## 文档与代码归档说明

- 项目说明与结构见根目录 `README.md`。
- 后端接口与模型配置见 `server/index.js`、`server/gemini-models.js`、`server/db.js`。
- 全品类组图流程、设计规范与图片规划逻辑见 `src/pages/DetailSet.jsx` 及本目录下的记录。
