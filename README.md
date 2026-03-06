# PicAITool 全品类组图（营销站复刻）

对 PicSet AI 官网的前端复刻，品牌名 **PicAITool**。React + Tailwind + Express，含登录/注册、全品类组图（分析 + 生图）等能力。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite、React Router 6、Tailwind CSS |
| 后端 | Node.js、Express、JWT、bcrypt、用户存 `server/users.json`、仓库用 SQLite（`server/db.js` + `server/picaitool.db`） |
| AI | Google Gemini（分析：文+图→文；生图：Nano Banana / 2 / Pro） |

---

## 项目结构（关键文件）

```
nano banana for business/
├── docs/
│   └── KNOWN_ISSUES.md         # 已知问题与待办、今日完成记录
├── src/
│   ├── App.jsx                 # 路由
│   ├── context/AuthContext.jsx  # 登录态
│   ├── lib/clarityByModel.js    # 模型与清晰度联动（Nano 仅 1K）
│   ├── lib/aspectByModel.js     # 模型与尺寸比例联动
│   ├── pages/
│   │   ├── DetailSet.jsx        # 全品类组图：上传→分析→确认规划→生成→完成
│   │   ├── ImageEdit.jsx        # 修改图片：7种 Gemini 图片编辑模式
│   │   ├── StyleClone.jsx       # 风格复刻
│   │   ├── ApparelSet.jsx       # 服装组图
│   │   ├── Login.jsx / 注册、ForgotPassword、Dashboard 等
│   └── components/             # Header（导航重构）、Footer、各 section
├── public/
│   └── demo-*.png              # 修改图片各模式 before/after 演示图（14 张）
├── server/
│   ├── index.js                # Express：注册/登录、分析、生图、仓库 API
│   ├── db.js                   # SQLite 初始化与 gallery 表
│   ├── gemini-models.js        # 生图/分析模型 ID、清晰度与 0.5K/1K/2K/4K
│   ├── .env.example            # 环境变量示例（复制为 .env，勿提交）
│   ├── users.json              # 用户存储（gitignore）
│   ├── picaitool.db            # SQLite 数据库（gitignore，首次运行自动创建）
│   └── gallery/                # 仓库图片文件（gitignore）
├── .cursor/rules/              # 项目记忆与约定（见下）
├── .gitignore
└── README.md
```

---

## 全品类组图流程

1. **输入**：产品图、组图要求（产品名称/卖点/目标人群/风格/其他）、目标语言、模型、尺寸比例、清晰度、生成数量  
2. **分析中**：`POST /api/detail-set/analyze`（Gemini 文+图→文），得到设计规范 + 图片规划  
3. **确认规划**：展示规划，用户点击「确认生成 x 张图片」  
4. **生成中**：`POST /api/detail-set/generate`（按条调用 Gemini 生图模型），返回 data URL 列表  
5. **完成**：展示图片；可「再次生成」或「返回修改规划」  

**逻辑约定**：生成完成后若修改 **产品名称/卖点/目标人群/风格/其他/产品图/生成数量**，会自动回到步骤 1 并清空分析/生成结果，需重新分析；修改 **目标语言、模型、尺寸、清晰度** 不影响规划，可直接「再次生成」。

详细字段与 AI 传参说明见 **`docs/DATA-FLOW.md`**。

---

## 本地运行

需要**两个终端**：一个跑前端，一个跑后端；**后端必须在 `server` 目录下运行**，在项目根目录执行 `npm start` 会再起一个前端（端口会变成 5174 等）。

### 终端一：前端（项目根目录）

```bash
cd "/Users/lina/cursor/nano banana for business"
npm install
npm run dev
```

浏览器访问 **图片惊喜**。

### 终端二：后端（务必先 cd 到 server 目录）

```bash
cd "/Users/lina/cursor/nano banana for business/server"
npm install
npm start
```

看到 `[后端 API] Server running at http://localhost:3001` 即正常。登录/注册、分析、生图均请求 3001。

### API Key 与代理

- 在 `server` 下复制 `.env.example` 为 `.env`，填入 `GEMINI_API_KEY`（[Google AI Studio](https://aistudio.google.com/app/apikey)）。不配置则分析返回 mock。
- 访问 Google 需代理时，在 `.env` 中设置 `HTTPS_PROXY=http://127.0.0.1:7890`（按本机代理端口修改）。后端用 undici 的 `EnvHttpProxyAgent` 走代理。

---

## 模型与额度（参考）

| 用途 | 模型/说明 |
|------|-----------|
| 分析（文+图→文） | `gemini-2.5-flash`（可通过 `GEMINI_ANALYSIS_MODEL` 环境变量覆盖） |
| 生图 | 用户选 Nano Banana / 2 / Pro，对应 `gemini-models.js` 中的 IMAGE_MODEL_IDS；Nano Banana 仅支持 1K 清晰度 |

---

## 网络与稳定性（已做）

- **分析/生图请求体**：前端上传前用 `fileToCompressedDataUrl` 将产品图压缩（长边 1024px、JPEG 0.82），避免大图导致代理连接关闭。
- **分析失败重试**：遇 `fetch failed` / `other side closed` 时后端自动重试最多 3 次（间隔 2s/4s），并返回更明确的错误提示（建议检查代理或直连重试）。
- **生图尺寸比例**：后端将用户选的尺寸（如 1:1 正方形）映射为 `imageConfig.aspectRatio` 传给 Gemini，并在 prompt 中强调「输出必须严格符合该比例」；生图时打日志 `aspectRatio` 便于排查。若 1:1 仍偶发非方图，可继续加强 prompt 或查 API 文档。

---

## 数据库与仓库

**数据库是什么？** 数据库用来持久化存数据（用户、图片记录等），支持按条件查询、不丢数据。本项目用的 **SQLite** 是「真正的」数据库，和 MySQL、PostgreSQL 一样是关系型数据库，区别在于：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| **SQLite**（本项目） | 单文件、无需单独安装、内嵌在程序里 | 小到中型应用、单机、原型、轻量部署 |
| **MySQL / PostgreSQL** | 独立数据库服务，需安装并启动，支持多机、高并发 | 大型站点、多用户高并发、需要独立运维 |

本项目用 SQLite 即可满足「用户登录 + 仓库图片」的存储；若以后访问量很大或要独立备份/迁移数据库，可再迁到 MySQL/PostgreSQL，表结构可复用。

- **SQLite 文件**：无需单独安装，首次有仓库请求时会在 `server/` 下自动创建 `picaitool.db`。
- **仓库表**：`db.js` 中创建表 `gallery`（id、user_email、title、file_path、saved_at），图片文件存在 `server/gallery/{用户 hash}/`，数据库只存元数据与路径。
- **自动保存**：用户登录状态下生成图片后，会**自动**写入仓库（数据库 + 文件）；客户可随时在每张图下点击「下载」保存到本地。
- **仓库页**：侧栏入口为「仓库」（无单独工作台）；按日期分组展示；支持多选、**批量保存到本地**、**批量删除选中**；单张可下载或移除。
- **备份**：复制 `server/picaitool.db` 和 `server/gallery/` 即可备份仓库数据；生产环境建议定期备份。

## 安全与忽略

- API Key 仅在后端通过 `getGeminiApiKey()` 读取，不写进前端或日志。
- `.gitignore` 已包含 `node_modules`、`dist`、`.env`、`.env.*`、`server/users.json`、`server/picaitool.db*`、`server/gallery`，勿提交敏感文件。

---

## 已知问题（后续再改）

详见 **`docs/KNOWN_ISSUES.md`**。当前含：**仓库保存/下载体验**（单张「下载」正常；多张「保存选中到本地」用选择文件夹，部分目录会被浏览器以「含有系统文件」拒绝）待后续改进。

---

## 修改图片（/image-edit）

基于 Gemini 图片编辑能力，支持 7 种模式：

| 模式 | 说明 | 输入→输出 |
|------|------|-----------|
| 添加 / 移除元素 | 在图片中自然地添加或移除指定元素 | 1 → 1 |
| 局部重绘（语义遮盖） | 修改特定区域，其余保持完全不变 | 1 → 1 |
| 风格迁移 | 将照片转换为指定艺术风格 | 1 → 1 |
| 高级合成：多图组合 | 将多张图（最多 5 张）中的元素合成新图 | 2–5 → 1 |
| 高保真细节保留 | 将细节/标志融合到主体图中，主体特征不变 | 2 → 1 |
| 让草图变生动 | 草图/线稿渲染为真实感成品图 | 1 → 1 |
| 角色一致性：360° 全景 | 基于参考图生成多角度一致性视图 | 1 → 多 |

- 后端接口 `POST /api/image-edit`，支持 Nano Banana / 2 / Pro，含重试逻辑（Pro/Nano2 最多 3 次）。
- 每种模式顶部展示真实 before → after 可视化示例，`ModeDemo` 组件自动适配「单→单」「多→单」「单→多」三种布局。
- 演示图存于 `public/demo-*.png`（14 张）。

---

## 后续可做

- 首页/营销页细节与间距微调
- 仓库筛选、导出（已支持按日期分组与批量保存/删除）
- 分析/生图 429 或额度用尽时的友好提示与重试策略
- 修改图片结果支持自动保存到仓库
