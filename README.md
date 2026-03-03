# PicAITool 全品类组图（营销站复刻）

对 PicSet AI 官网的前端复刻，品牌名 **PicAITool**。React + Tailwind + Express，含登录/注册、全品类组图（分析 + 生图）等能力。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite、React Router 6、Tailwind CSS |
| 后端 | Node.js、Express、JWT、bcrypt、用户存 `server/users.json` |
| AI | Google Gemini（分析：文+图→文；生图：Nano Banana / 2 / Pro） |

---

## 项目结构（关键文件）

```
nano banana for business/
├── src/
│   ├── App.jsx                 # 路由
│   ├── context/AuthContext.jsx  # 登录态
│   ├── lib/clarityByModel.js    # 模型与清晰度联动（Nano 仅 1K）
│   ├── pages/
│   │   ├── DetailSet.jsx        # 全品类组图：上传→分析→确认规划→生成→完成
│   │   ├── StyleClone.jsx       # 风格复刻
│   │   ├── ApparelSet.jsx       # 服装组图
│   │   ├── ImageRetouch.jsx     # 图片精修
│   │   ├── Login.jsx / 注册、ForgotPassword、Dashboard 等
│   └── components/             # Header、Footer、各 section
├── server/
│   ├── index.js                # Express：注册/登录、/api/detail-set/analyze、/api/detail-set/generate
│   ├── gemini-models.js        # 生图/分析模型 ID、清晰度校验（Nano 仅 1K）
│   ├── .env.example            # 环境变量示例（复制为 .env，勿提交）
│   └── users.json              # 用户存储（gitignore）
├── .cursor/rules/              # 项目记忆与约定（见下）
├── .gitignore
└── README.md
```

---

## 全品类组图流程

1. **输入**：产品图、组图要求、目标语言、模型、尺寸比例、清晰度、生成数量  
2. **分析中**：`POST /api/detail-set/analyze`（Gemini 文+图→文），得到设计规范 + 图片规划  
3. **确认规划**：展示规划，用户点击「确认生成 x 张图片」  
4. **生成中**：`POST /api/detail-set/generate`（按条调用 Gemini 生图模型），返回 data URL 列表  
5. **完成**：展示图片；可「再次生成」或「返回修改规划」  

**逻辑约定**：生成完成后若修改 **组图要求、产品图、生成数量**，会自动回到步骤 1 并清空分析/生成结果，需重新分析；修改 **目标语言、模型、尺寸、清晰度** 不影响规划，可直接「再次生成」。

---

## 本地运行

需要两个终端：前端 + 后端。

### 前端（项目根目录）

```bash
cd "/Users/lina/cursor/nano banana for business"
npm install
npm run dev
```

浏览器访问 **http://localhost:5173**。

### 后端（server 目录）

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
| 分析（文+图→文） | `gemini-3-flash-preview`（可 `GEMINI_ANALYSIS_MODEL` 覆盖）；503 时用 `gemini-2.5-flash` 重试 |
| 生图 | 用户选 Nano Banana / 2 / Pro，对应 `gemini-models.js` 中的 IMAGE_MODEL_IDS；Nano Banana 仅支持 1K 清晰度 |

---

## 网络与稳定性（已做）

- **分析/生图请求体**：前端上传前用 `fileToCompressedDataUrl` 将产品图压缩（长边 1024px、JPEG 0.82），避免大图导致代理连接关闭。
- **分析失败重试**：遇 `fetch failed` / `other side closed` 时后端自动重试最多 3 次（间隔 2s/4s），并返回更明确的错误提示（建议检查代理或直连重试）。
- **生图尺寸比例**：后端将用户选的尺寸（如 1:1 正方形）映射为 `imageConfig.aspectRatio` 传给 Gemini，并在 prompt 中强调「输出必须严格符合该比例」；生图时打日志 `aspectRatio` 便于排查。若 1:1 仍偶发非方图，可继续加强 prompt 或查 API 文档。

---

## 安全与忽略

- API Key 仅在后端通过 `getGeminiApiKey()` 读取，不写进前端或日志。
- `.gitignore` 已包含 `node_modules`、`dist`、`.env`、`.env.*`、`server/users.json`，勿提交敏感文件。

---

## 后续可做

- 首页/营销页细节与间距微调
- Dashboard 图库、筛选、导出
- 分析/生图 429 或额度用尽时的友好提示与重试策略
