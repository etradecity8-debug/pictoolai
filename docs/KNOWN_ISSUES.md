# 已知问题与待办（后续再改）

## 运营须知：数据隐私与客户信任

### 技术层面：管理员能看到什么

| 数据 | 能看到吗 | 说明 |
|------|------|------|
| 账号邮箱 | ✅ 能 | 存在 users 表 |
| 密码 | ❌ 不能 | bcrypt 加密，不可逆 |
| 积分余额/流水 | ✅ 能 | 存在 user_points / points_transactions 表 |
| 生成的图片 | ✅ 能 | 存在服务器 server/gallery/ 目录 |
| 上传的产品图 | ❌ 不存储 | 只做分析，处理完即丢弃，不落盘 |
| 输入的文字要求 | ❌ 不存储 | 只传给 Gemini，不写入数据库 |

### 如何和客户真诚沟通

**建议直接告知**，不要回避：
> 「作为平台管理员，我技术上能看到你生成的图片和账号信息，但我不会主动去查看。这和你用 Canva、Notion 等任何 SaaS 工具是一样的——服务方都有管理员权限，信任来自我们的关系和我的承诺。」

绝大多数做跨境/亚马逊的卖家可以接受这一点，因为产品图本来就是要公开销售的，不属于高度机密。

### 哪类客户需要额外说明

如果客户的产品图属于以下情况，需要提前告知限制：
- 未上市产品、核心专利外观
- 高度保密的商业设计

对这类客户的建议：
- 用完后在仓库里手动删除图片（管理后台可帮忙删）
- 或等后续「用户自带 API Key」功能上线后再使用

### 后续可做的隐私增强（记录备用）

| 功能 | 说明 | 优先级 |
|------|------|------|
| 用户自带 API Key | 用户填自己的 Gemini Key，生成请求不过本服务器 | 中 |
| 图片定期自动清理 | N 天后自动删除仓库中的图片文件 | 低 |
| 隐私政策页面 | 前端加一页说明数据存储范围与用途 | 低 |

---

## 待后续改进

### 生成 Listing Step 4 A+（暂锁）

- **现状**：Step 4「A+ 文案与图片」已暂时锁定（`APLUS_STEP_ENABLED = false`），界面显示「功能优化中，每位用户对 A+ 的要求不同，我们正在研究如何更好地满足个性化需求，敬请期待」。
- **原因**：生图效果暂不满意；不同用户对 A+ 的需求差异大，需研究个性化方案。
- **恢复方式**：前端 `src/pages/AiAssistant.jsx` 中改 `APLUS_STEP_ENABLED = true` 即可。

### 角色一致性：360° 全景 · 女模特指令执行偏差

- **现象**：用户测试发现，男模特的「左侧侧面」「右侧侧面」指令能正确执行；女模特的同类指令（如「左侧侧面白底棚拍肖像图」）却常生成相反结果（如实际输出右侧侧面）。
- **可能原因**：模型对左侧/右侧视图的理解可能存在偏差，也可能是中文翻译成英文指令时存在偏差，待后续调试。
- **相关**：修改图片 → 角色一致性：360° 全景（`character-360` 模式），`/api/image-edit`。

### 仓库保存/下载体验

- **现状与不满**：当前单张用「另存为」（showSaveFilePicker）可正常选路径保存；多张用「选择文件夹」（showDirectoryPicker）一次性写入，但部分目录（如含系统/隐藏文件）会被浏览器拒绝并提示「含有系统文件」，导致无法保存。用户对该块体验不满意，后续需再改。
- **约束**：多张若改为「每张弹一次另存为」（showSaveFilePicker 循环），选 1 万张就要点 1 万次，不可接受；因此多张仍需「选一次文件夹」的机制，但需在浏览器限制下找到更好方案（例如引导用户选子文件夹、或后续有更合适的 API/产品方案再优化）。

### 仓库 COS 加速（已实现）

- **已完成**：腾讯云 COS 接入（可选），配置 `COS_*` 环境变量后新图自动上传 COS，列表返回临时签名 URL 加速访问。未配置 COS 时行为与之前一致。详见 `docs/DEPLOY.md` 第四节。
- **业务逻辑**：全站统一——生图成功即自动入仓，图片旁仅「保存到本地」。仓库页对 COS 绝对 URL 直接 img src 展示（不 fetch，避免 CORS）；对相对路径用 Token fetch 转 blob 展示。下载/批量下载统一走 `/api/gallery/image/:id`（带 Token，从本地文件读取）。
- **拉图失败处理**：相对路径 fetch 失败时，仓库页显示「加载失败」+「点击重试」（而非永远「加载中」），控制台打日志 `[仓库] 拉图失败`，便于排查（常见原因：Token 过期 → 重新登录）。

---

## 今日完成（2026-03-19）

### 1. 文字修改模块优化

- **语言转换默认模型**：改为 **Nano Banana 2**（Nano Banana 经常无法处理语言转换任务）。`ImageEdit.jsx` 中 `initialMode === 'text-translate'` 时默认选中 Nano Banana 2；切换模式时同步更新。
- **文字去除**：① 增加占位图 `public/text-remove-demo-before.png`、`text-remove-demo-after.png`（流浪猫救援海报 before/after 示例）；② OutputSettings 在文字去除模式下显示 hint「文字编辑任务建议选择 Nano Banana 2 或 Pro」。
- **文档**：`docs/AI-DESIGNER.md` 第六部分已更新；`.cursor/rules/project-context.mdc` 已同步记忆。

---

## 今日完成（2026-03-18）

### 1. 添加人/物（完善）

- **多物品**：支持最多 3 件物品，每件可选「文字描述」或「上传产品图」+ 位置；多张产品图时走 `composition`，prompt 中按 image 2、image 3… 指定放置位置。
- **自定义位置**：人物与物品均支持**自定义位置**输入（如「咖啡桌上」「沙发上」「小孩手里」），优先于预设位置下拉。
- **真实比例**：prompt 中增加「真实世界比例」约束（如香水瓶在桌上须为手部大小），减轻添加物过大的问题。
- **占位图**：`public/demo-add-person-object-before.png`、`demo-add-person-object-after.png`；页面顶部有示例对比区。
- **文档**：`docs/AI-DESIGNER.md` 第三·E 部分已含上述说明。

### 2. 仓库「用AI编辑」+ 一二级菜单

- **入口**：仓库页（`/dashboard/gallery`）每张图卡片增加「用AI编辑」按钮，点击后弹窗选择功能并跳转 AI 美工对应页面。
- **自动带图**：跳转时通过路由 `state` 传入 `fromGallery`、`imageUrl`、`imageId`、`imageTitle`；AiDesigner 读取后以 `initialImageFromGallery` 传给各子页面；各 AI 美工页面及 ImageEdit 通过 `src/lib/loadGalleryImage.js` 的 `loadImageFromGalleryUrl(url, getToken)` 拉取图片并设为初始图，无需用户再次上传。
- **一二级菜单**：弹窗内按**一级分组**（图片编辑、质量提升、文字修改、风格变迁、水印添加/去除、官方示例）展示，**二级**为各组内功能按钮，与 AI 美工侧栏结构一致。
- **完整性**：文字修改含 3 项（文字替换、语言转换、文字去除）；官方示例含 7 项（添加/移除元素、局部重绘(语义)、风格迁移、高级合成、高保真细节保留、让草图变生动、角色一致性360°）。详见 `src/pages/dashboard/Gallery.jsx` 中 `GALLERY_EDIT_GROUPS`。

### 3. 文档与项目记忆

- 已更新 `docs/AI-DESIGNER.md`、`docs/README.md`（索引）、`.cursor/rules/project-context.mdc`（关键文件、仓库用AI编辑、添加人/物、文字修改/官方示例项数），保证与代码一致。

### 4. 删除用户与重新注册 + 管理员客户备注

- **删除用户逻辑**：管理员删除客户时会同时删除该用户的 `users`、`user_points`、`points_transactions`、`gallery`（及本地/COS 文件）、`amazon_listing_snapshots`、`ebay_listing_snapshots`、`aliexpress_listing_snapshots`。**删除后该邮箱可以重新注册**（注册时只检查 `users` 表是否存在该邮箱）。**一步步操作说明**（管理后台删除、服务器上手写 SQL、查用户、仅删 users 让邮箱再注册、sqlite 卡住时 Ctrl+C）：见 **docs/DEPLOY.md 第五节**。若删除后该邮箱仍提示「该邮箱已注册」，可在服务器上执行 `DELETE FROM users WHERE email = '该邮箱';` 后该邮箱即可再次注册。
- **管理员客户备注**：`users` 表有 `admin_notes` 字段（启动时自动迁移）；管理后台客户列表有「备注」列与「编辑备注」按钮，管理员可为每个客户填写备注（如「朋友张三」「某某渠道试用客户」）。API：`GET /api/admin/users` 返回 `adminNotes`；`PATCH /api/admin/users/:email/notes` 请求体 `{ adminNotes: "..." }` 更新备注。

### 5. 侵权风险检测（MVP 免费快筛 + 方案 B 深度查询）

- **入口**：主导航「侵权风险检测」，独立模块，路由 `/ip-risk`，页面 `src/pages/IpRisk.jsx`。
- **输入**：1～6 张产品图（必填）；选填：产品名称、品类、目标市场、其他说明。
- **免费快筛（MVP）**：仅调用 Gemini 多模态分析，输出商标/Logo、外观设计、IP 形象、平台合规风险与综合等级、建议及免责声明；不扣积分。**快筛返回**：后端优先让 AI 输出 JSON 结构化字段（trademarkRisk、designRisk、ipImageRisk、platformRisk、overallLevel、suggestions、disclaimer），成功时返回 `{ mode: 'quick', sections: {...} }`，前端按分组卡片展示（每块一个标题+内容）；解析失败时回退为 `{ mode: 'quick', report: 整段文本 }`，前端单块 Markdown 渲染。
- **深度查询（方案 B）**：在快筛基础上，调用 SerpApi：**Google Lens**（首图视觉匹配）、**Google Patents**（专利关键词检索）、**Google 搜索**（商标检索，查询「USPTO trademark + AI 提取的品牌/产品名词」），再由 Gemini 综合成报告；**消耗 20 积分**。深度返回与快筛一致：成功解析 JSON 时返回 `{ mode: 'deep', sections: {...} }` 分组卡片展示，失败时 `{ mode: 'deep', report: 整段 Markdown }`。深度结果另含 **searchSummary** 数组（每项含 method / service / content / purpose），前端在报告上方展示「本次深度查询使用的检索方式」表格（检索方式列含「使用服务」如 Google Lens、Google Patents、Google 搜索），用途说明已区分：以图搜图=整网、专利=主要美国、商标=以美国为主。报告分组卡片从正文开头解析风险等级（高/中高/中/中低/低）展示在标题行，等级为「高」时红色文字+警告图标。需在 `server/.env` 配置 `SERPAPI_KEY`，未配置时深度查询返回「暂未开放」。
- **后端**：`POST /api/ai-assistant/ip-risk-check`，body `{ images, productName?, category?, targetMarket?, hints?, mode: 'quick'|'deep' }`；临时图供 Lens 抓取用 `GET /api/temp-ip-risk-image/:id`，临时文件存 `server/.temp-ip-risk/`，用后删除。深度扣费 `IP_RISK_DEEP_POINTS = 20`。
- **免责**：报告末尾统一带「本报告由 AI 生成，仅供参考，不构成法律意见」。

**深度查询所需 SerpApi 申请步骤**（配置后才能在站内使用「深度查询」）：

1. 打开 **https://serpapi.com** ，点击右上角 **Sign up** 用邮箱或 Google/GitHub 注册。
2. 登录后进入 **Dashboard**（或 **https://serpapi.com/manage-api-key**），在页面上复制你的 **API Key**。
3. 在项目 **`server/.env`** 中增加一行：`SERPAPI_KEY=你的API_Key`，保存后重启后端（如 `pm2 restart`）。未配置时前端深度查询会提示「深度查询暂未开放」。
4. 套餐说明：**Free** 约 250 次/月可试用；正式使用建议 **Developer**（约 $75/月，约 5000 次/月）。每次深度查询约消耗 3 次 SerpApi（1 次 Google Lens + 1 次 Google Patents + 1 次 Google 商标检索）。

**客户沟通用**：方案 B 费用汇总、轻量版/完整版对比、如何向客户解释「我们查了什么」，见 **docs/IP-RISK.md**（主文档）或 docs/ECOMMERCE-AI-ASSISTANT.md 附录。

---

## 推送到服务器（执行步骤）

**完整步骤**：按 `docs/DEPLOY.md` 第二节执行（本机 `git add` / `commit` / `push` → 服务器 `git pull` / `npm install` / `npm run build` / `pm2 restart`）。

**本次（2026-03-19）建议提交说明**：
```bash
git add .
git commit -m "feat: 文字修改优化-语言转换默认Nano Banana2+文字去除占位图与hint+文档同步"
git push
```
然后到服务器执行 `docs/DEPLOY.md` 第二节的步骤。

---

## 今日完成（2026-03-17）

### 1. 从图库选择图加载优化

- **问题**：「从作品库选择」弹窗里缩略图加载慢（尤其未配 COS 时每张都请求服务器）。
- **实现**：抽公共组件 `src/components/GalleryThumb.jsx`。当 `item.url` 为**绝对 URL（COS 签名）**时**直接用 `<img src={url} />`**，不 fetch，与仓库页一致、加载更快；为相对路径时仍带 Token fetch 转 blob 展示。
- **使用处**：ImageEdit、StyleClone、LocalRedraw、LocalErase、OneClickRecolor、SmartExpansion、ProductRefinement、Clothing3D、ClothingFlatlay、BodyShape、SceneGeneration 的「从作品库选择」弹窗均改用该组件。详见 `docs/DEPLOY.md` 第四节前端约定。

### 2. AI 美工输出设置统一（与官方示例一致）

- **需求**：官方示例中客人需选择模型、清晰度、比例后按客户要求出图；AI 美工其他模块原先无输出设置或仅部分有，现统一为与官方示例一致。
- **实现**：前端新增可复用组件 `src/components/OutputSettings.jsx`（模型、输出尺寸比例、清晰度 + 本次预计消耗积分）。局部重绘、局部消除、一键换色、智能扩图、提升质感、服装3D、服装平铺、调整身材、生成场景均接入该组件并在请求中传入 `model`、`aspectRatio`、`clarity`。积分预估使用 `src/lib/pointsEstimate.js` 的 `getPointsEstimate(model, clarity)`（与 `server/points.js` 一致）。后端 `/api/image-edit` 当请求体带 `aspectRatio` 与 `clarity`（非空字符串）时优先使用请求参数（`useRequestOutput`），不再按原图自动推断；未传时对「保留原图」类模式仍从输入图推断，兼容旧行为。

---

## 今日完成（2026-03-10）

### AI 美工 · 一键换色
- **路由**：`/ai-designer`、`/ai-designer/:toolId`，侧边栏含「图片编辑」下局部重绘、局部消除、**一键换色**。
- **一键换色**：上传图片 → 文字描述要换色的物体（如鼠标、裙子、头发）→ 选择 1–9 种颜色（色卡 24 种 + 自定义 hex/取色器）→ 批量生成。详见 `docs/AI-DESIGNER.md` 第一部分。
- **后端**：`/api/image-edit` 新增 `mode: 'recolor'`，`textDescription` + `targetColor` 构建 prompt，保留原图比例与清晰度。
- **示例图**：`public/recolor-demo-original.png`、`recolor-demo-edited.png`（连衣裙换色）。

### 局部消除
- 示例区改用真实图片：`local-erase-demo-original.png`、`local-erase-demo-edited.png`（粉色鼠标桌面图）；移除未用 `PlaceholderBox`。

---

## 今日完成（2026-03-16，续）

### AI 美工 · 三个服装新功能

- **服装3D**（`/ai-designer/clothing-3d`）：上传平铺服装图，一键生成隐形人台立体 3D 展示效果。保持原图视角，肩膀圆润、袖子张开、纯浅灰背景。使用 Nano Banana 2 模型。示例图 `demo-clothing3d-before/after.png`。
- **服装平铺**（`/ai-designer/clothing-flatlay`）：上传服装图，选择放置表面（木质桌面/毛绒布/白色床单/亚麻布/大理石/水泥/草地/自定义），自动生成 Knolling 风格平铺图（俯视+配饰）。示例图 `demo-flatlay-before/after.png`。
- **调整身材**（`/ai-designer/body-shape`）：上传模特穿搭图，通过体重滑块（35-150kg）+身高滑块（140-200cm）调整模特身材。6 个快速预设、BMI 实时计算。后端根据 BMI 自动生成 6 级身材描述，服装保持 100% 不变。示例图 `demo-bodyshape-before/after.png`。

### 竞品对比升级 + Listing 输出清洁

- **竞品对比**：从最多 3 个扩展到**最多 5 个**竞品，输入区改为 **Tab 切换**形式（可增删），节省界面空间。
- **全平台 Listing 输出清除 Markdown**：后端新增 `stripMarkdown` 函数，自动清除 `**粗体**`、`_斜体_` 等 Markdown 格式。覆盖亚马逊/eBay/速卖通的 generate-listing、optimize-listing、generate-variants 所有输出。

---

## 今日完成（2026-03-16）

### 亚马逊 Listing 四大新功能
- **A/B 文案变体**：优化/生成 Listing 结果区新增「生成 A/B 变体」按钮，后端 `POST /api/ai-assistant/amazon/generate-variants` 根据不同策略角度（功能参数型、场景情感型等）生成 2-3 套变体，前端 Tab 切换对比。不扣积分。
- **合规自检增强**：`optimize-listing` prompt 中合规扫描从 6 类扩展到 9 大类（标题格式、五点格式、描述规则、促销用语、IP/品牌、医疗声明、农药/杀菌、环保声明、其他），每项带 error/warning/info 三级严重度。前端按严重程度分组渲染（红/黄/灰），显示位置、类别、问题文本和修改建议。
- **竞品对比**：新增功能卡片 + `POST /api/ai-assistant/amazon/competitor-compare` 接口 + `CompetitorForm` 组件。输入自己和 1-5 个竞品 Listing（Tab 切换输入，可增删），输出关键词差异（优势词/待补充/共有词）、卖点矩阵表格、标题和五点策略分析、行动计划。不扣积分。
- **关键词研究**：新增功能卡片 + `POST /api/ai-assistant/amazon/keyword-research` 接口 + `KeywordResearchForm` 组件。输入产品名称，输出核心搜索词、5 类长尾词分组、后台关键词建议、标题排布建议、趋势分析、差异分析（可选）。不扣积分。

### eBay / 速卖通模块升级
- **新增「优化 Listing」功能**：
  - eBay：`POST /api/ai-assistant/ebay/optimize-listing`，基于 Cassini 搜索算法深度诊断，含产品分析、三维度评分、合规自检（三级严重度）、双语诊断报告、优化版 Listing
  - 速卖通：`POST /api/ai-assistant/aliexpress/optimize-listing`，基于速卖通搜索算法（标题权重 32.7%、关键词重复惩罚等），同样完整诊断+优化+合规+双语
  - 前端新增 `PlatformOptimizeForm` 组件（eBay/速卖通共用），含方法论卡、输入区、诊断报告（双语切换）、合规自检、优化后版本
  - `ebayFeatures`、`aliexpressFeatures` 各增加 optimize 卡片
- **生成模块增强**：
  - analyze 接口升级为「深度产品智能分析」，新增提取 `topKeywords`（8-12 个高频搜索词）、`buyerQuestions`（3-5 个买家常问）、`buyerPersonas`（2-3 个买家画像）
  - generate-listing prompt 从规则型升级为策略驱动型，标题/属性/描述各有明确策略
  - 前端分析结果页新增「产品洞察」展示区
- **广告语更新**：eBay/速卖通功能卡片描述与亚马逊风格对齐，突出平台特有算法和具体分析能力

### 智能粘贴（三平台通用）
- **后端**：新增 `POST /api/ai-assistant/smart-paste` 通用接口，AI 从粘贴的整页文本中智能提取标题、五点/属性、描述、品牌等字段。不扣积分。
- **前端**：三处加入智能粘贴入口：
  - 亚马逊「优化 Listing」：方法论卡下方可折叠面板
  - eBay/速卖通「优化 Listing」：同样的折叠面板
  - 亚马逊「竞品对比」：每个 Listing 块下方的行内入口
- **用户体验**：打开商品页 → Ctrl+A 全选 → Ctrl+C 复制 → 粘贴到文本框 → 点「智能识别并填充」→ 自动拆分到各字段

---

## 今日完成（2026-03-15）

### eBay / 速卖通模块优化
- **功能描述补充**：三个平台的功能卡片和页面大字说明均补充了"生成产品图"能力描述
- **类目英文统一**：亚马逊和速卖通的产品类目从中文改为英文，与 eBay 一致
- **重新生成进度**：三个平台的"重新生成"按钮点击后显示加载状态（脉冲动画 + 提示条）
- **卖点图 prompt 优化**：eBay/速卖通的卖点图生图 prompt 对齐亚马逊质量（要求创建新构图，不在原图上叠加文字；文字规则含翻译指令防乱码）

### 交互图（三个平台）
- **新增图片类型**：三个平台均新增「交互图」（人和物品交互图），0～4 张
- **生图 prompt**：展示真人自然使用/手持产品（局部可见，聚焦交互），根据产品类型举例（坐凳子/握工具/穿配饰），参考图仅用于外观
- **前端**：新增选择器、积分计算包含交互图、图片展示区新增交互图分组
- **后端**：三个平台 `generate-product-images` 均新增 `interactionCount` 参数和交互图生成循环
- **Listing 历史**：详情页关联图片区新增交互图展示

### 导出统一（CSV + JSON）
- **三个平台统一**：生成页和 Listing 历史详情页均同时提供「导出 CSV」和「导出 JSON」
- **亚马逊 CSV**：`item_name, bullet_point_1~5, product_description, generic_keyword`
- **eBay CSV**：`Title, Description, C:属性名...`（Item Specifics 展开）
- **速卖通 CSV**：`Title, Description, 属性名...`（产品属性展开）
- **新建工具**：`src/lib/exportListingCsv.js` 统一导出逻辑

### 生图加载蒙版统一
- **eBay / 速卖通生图**：补齐亚马逊已有的加载蒙版（灰色框 + 张数 + 预估时间 + 进度条动画），三个平台体验一致

### 特写图 prompt 增强
- **问题**：特写图保留原图未美化
- **修复**：亚马逊/eBay/速卖通特写图 prompt 统一增强：Create a NEW image、Pure white/soft gradient studio background、CRITICAL 约束（仅参考产品外观、不复制背景、生成新构图且增强细节纹理）

### 美国服务器部署完成（2026-03-15）
- **服务商**：腾讯云轻量应用服务器
- **地域**：美国硅谷（Gemini API 无地区限制）
- **公网 IP**：43.162.87.60
- **访问**：https://pictoolai.studio（推荐）；http://43.162.87.60 或 http://pictoolai.studio 会跳转 HTTPS
- **PM2**：`pm2 start /home/ubuntu/app/server/index.js --name pictoolai-server --cwd /home/ubuntu/app/server`（确保 dotenv 加载 server/.env）
- **管理员**：ADMIN_EMAIL/ADMIN_PASSWORD 需在 server/.env 配置，PM2 需 --cwd 到 server 目录才能正确读取
- **域名**：pictoolai.studio 已配置 DNS A 记录指向 43.162.87.60；HTTPS 已启用（Let's Encrypt，certbot 自动续期）
- **Nginx**：proxy_read_timeout/connect_timeout/send_timeout 已设为 300s，避免 image-edit 等长请求 504
- **防火墙**：腾讯云轻量控制台须放行 **TCP 443**，否则 HTTPS 无法访问（见 DEPLOY.md「HTTPS 已配置」）

### 运维小记（2026-03-18）
- **用 IP 访问**：Nginx 已设 `listen 80 default_server` 与 `server_name ... 43.162.87.60`，服务器 curl 正常则问题多在浏览器：缓存或 Chrome 无痕下 HTTP 的「此网站不支持安全连接」提示，点「继续访问网站」即可。建议日常用 https://pictoolai.studio。
- **SSH 过一会儿断联**：多为运营商/中间设备空闲断开，属常见现象；**重新登录不影响服务器**，Nginx、PM2 等照常运行。可选：本机 `~/.ssh/config` 里为该 Host 加 `ServerAliveInterval 60` 减少断线。
- **~/.ssh/config 为空**：正常；未配置快捷主机或别名时即为空，不影响 SSH 登录。

---

## 今日完成（2026-03-14）

### 新用户积分与注册页
- **新用户默认 150 积分**：注册时自动赠送 150 积分，有效期 30 天（`server/points.js` 新增 `grantSignupBonus`，`server/index.js` 注册后调用）。
- **注册页文案**：`src/pages/Register.jsx` 增加「新注册用户赠送 150 积分供您体验」。

### 联系我们
- **页面**：`/contact` 仅保留微信联系方式（已移除姓名/邮箱/留言表单），文案「请通过微信联系我们：微信号：XXXX」；新增「返回主页」按钮。
- **Header 导航**：`src/components/layout/Header.jsx` 新增「联系我们」链接（桌面端与移动端均可见）。

### 定价与产品
- **定价页**：选择套餐后弹出联系我们弹窗（`ContactModal`），因付费未接入，引导用户通过微信联系。
- **删除产品页**：移除「了解产品」按钮、`/product` 路由、`Product.jsx`、Footer「产品功能」链接。
- **删除 ProductShowcase**：主页移除产品能力展示区块（全品类组图/风格复刻/服装组图/图片精修标签与示例）。

### 电商AI运营助手
- **下拉改侧边栏**：Header 的「电商AI运营助手」改为直接链接 `/ai-assistant`，平台选择在 AiAssistant 页面左侧侧边栏展示。
- **优化 Listing**：已实现「诊断 + 一键优化」——粘贴现有 Listing 文案，AI 逐项评分（标题/五点/描述/关键词）并标记合规风险，同时输出优化版本。不扣积分。

### 主页改版
- **Hero**：黑色块 `slate-900` 居中，网格装饰（8% 透明度、48px 格）；主标「智绘电商新生态，重塑商品视觉力」，副标中 Google Gemini Nano Banana 加粗蓝 `#4285F4`；紧凑高度 `py-10 sm:py-12 lg:py-14`。
- **FeatureCards**：左对齐、01/02/03 编号样式；文案：操作零门槛、智能修图、电商全流程适配；紧凑布局。
- **FaqSection**：全部展开无下拉；左对齐；6 条 FAQ 两列网格；编号 01–06 大号灰色、与 FeatureCards 统一。
- **CtaSection**：黑色块 `slate-900` 居中卡片，紧凑高度。
- **统一宽度**：全主页用 `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`，与 Header（Logo 左、退出右）对齐。
- **Footer**：「关于我们」「帮助中心」灰掉不可点（`disabled: true`）。

---

## 今日完成（2026-03-12）

### 风格复刻功能

- **路由**：`/ai-designer/style-clone`，入口在 **AI美工** 侧边栏「风格复刻」；`/style-clone` 自动重定向至上述路径。
- **前端**：`src/pages/StyleClone.jsx`。上传参考设计图（最多 14 张）、产品素材图（最多 6 张）、补充提示词（可选）；模型/尺寸/清晰度/生成数量；从作品库选图；生成结果网格、保存到本地。提示：参考图「最好只上传一种风格」、产品图「只上传一个产品」。
- **文案**：标题「引领风格复刻：从参考到爆款，仅需一步」；副文案「依托 AI 视觉生成技术，精准复刻爆款调性，为您的商品注入视觉销售力。」
- **后端**：`POST /api/style-clone`（需登录）。两阶段：① 用分析模型提取参考图风格描述；② 按产品图 + 风格描述 + 可选提示词循环生图。积分按张数扣除，自动存图库。
- **参考**：Gemini 风格复刻最佳实践（多图参考、风格锁定 prompt、两阶段生成）。

### 今日其他更新（2026-03-12）

- **Turbo 已移除**：ImageRetouch（一键智能产品精修）、StyleClone 中不再有 Turbo 加速相关逻辑。
- **文字替换示例图**：`demo-text-replace-before.png`、`demo-text-replace-after.png`（流浪猫救援海报风格）；箭头中间不显示 prompt 文字。

### AI 美工 · 统一排版与体验

- **材质预设 Tab 顺序**：电子 / 塑料 / 纺织 / 木质 / 玻璃 / 工业 / 自然 / 轻奢；预设与 Tab 分类已核对一致（如蜂窝透明塑料→塑料、磨砂彩色玻→玻璃、液态水银/发光光纤→工业、粗粝亚麻/重磅真丝→纺织）。
- **提升质感页面**：精修前/精修后图片改为 flex 紧凑布局、间距缩小；主内容区 `max-w-3xl`；「保存到本地」按钮移至精修后图片正下方。
- **保存按钮位置**：五个模块（提升质感、智能扩图、局部重绘、局部消除、一键换色）的「保存到本地」均紧贴生成结果放置。
- **统一排版**：标题 `text-2xl`、副文案 `text-base`、示例图 `w-72 h-72`、主卡片 `max-w-3xl p-4`、主按钮 `max-w-xs py-2.5 rounded-lg text-sm`。
- **广告词**：提升质感「内置专业材质引擎，一键让你的产品图从「地摊货」变身「奢侈品」」；智能扩图「智能扩图，视界大开。」+ 两段副文案；一键换色「无论是时装还是产品，一键精准换色，效率提升 10 倍」。
- **文档**：`docs/AI-DESIGNER.md` 新增「UI 布局与广告词」章节。

### AI 美工 · 文字修改

- **新增侧边栏分组**：「文字修改」位于「抠图工具」与「官方示例」之间，含 2 项：文字替换、语言转换。
- **从官方示例移出**：原「图片文字替换」「图片文字语言转换」移至「文字修改」，并重命名为「文字替换」「语言转换」。
- **页面排版**：从 ai-designer 进入时，ImageEdit 使用 `hideModeSelector` 布局——标题居中、副文案 text-base、主内容 `max-w-3xl` 白底卡片；上传区文案「上传图片」「从作品库选择」与其它模块一致。

---

## 今日完成（2026-03-19）

### 定价与积分
- **套餐**：单一标准套餐 ¥200/1000积分，购买之日起 1 年有效。
- **积分规则**：Nano Banana 1K=4；Nano Banana 2 各挡 4/6/10/14；Nano Banana Pro 各挡 12/12/20；侵权深度查询=20 积分/次。
- **有效期**：`grantPoints` 默认 365 天；Admin 充值快捷按钮改为 30天/180天/1年，默认 1 年。
- **定价页**：重写为单一套餐展示，含积分用量参考、生图明细、常见问题。

### 侵权风险检测
- **独立模块**：从 AI 运营助手侧栏迁出，主导航新增「侵权风险检测」，路由 `/ip-risk`，页面 `src/pages/IpRisk.jsx`。

### 文档
- **IP-RISK.md**：侵权风险检测独立文档（功能、检测维度、费用、客户沟通话术）。
- **PRODUCT-INTRO.md**：网站功能介绍（对外宣传，发给客户用）。
- **PRICING-COST.md**：积分规则、API 成本、固定成本（含 Cursor $60/月）、盈利分析、竞品对比（Midjourney、PicSetAI）、试用用户影响评估。

### 其他
- **电商生图**：导航与标题改为「通用电商生图」；Nano Banana(2.5) 文案改为 Nano Banana；卖点图张数标签澄清。
- **文档与代码一致性**：已核对 PROJECT-OVERVIEW、KNOWN_ISSUES、ECOMMERCE-AI-ASSISTANT 中侵权积分 10→20、入口路由等。

---

## 今日完成（2026-03-10）

### 界面与品牌
- **导航**：「产品组图」→「电商生图」，「AI运营助手」→「电商AI运营助手」；文档与项目记忆已同步。
- **品牌统一**：全项目统一为 **PicToolAI**（品牌名）、技术标识 **pictoolai**（数据库 `pictoolai.db`、localStorage 键、PM2 示例名等），避免与旧拼写 picaitool 混淆。
- **Logo**：接入 `public/logo.png`，Header/Footer/标题/favicon 已用；尺寸调大、去白底（与导航栏同底 + mix-blend-multiply）、限制在栏内不溢出。

### 电商AI运营助手（Listing）
- **步骤 4**：点击「生成 A+ 文案」后不再整块折叠，显示「正在生成 A+ 文案…」并滚动到视区；生成中与生图时均保持展开。
- **重新生成**：每步独立——Step 1 卡片「重新分析」「清空全部」，Step 2「重新生成」，Step 3「重新生成产品图」，Step 4「重新生成文案/图片」；文档与界面已区分「分析」与「生成」。
- **保存 Listing**：按钮旁增加说明（保存内容：标题/五点/描述/分析/A+ 文案，若已生成主图或 A+ 图会一并关联）；保存时传入 `mainImageId`、`aplusImageIds`，Listing 历史详情页展示关联主图与 A+ 图。
- **保存/导出**：按钮移至 Step 2 文案内容下方，作为「看完再操作」区域。

### 部署与数据
- **部署**：香港已暂停（Gemini 不可用），下次可能改美国 VPS；`docs/DEPLOY.md` 改为通用 VPS 步骤，含「曾用 picaitool」的迁移说明。
- **数据库**：仅使用 **pictoolai.db**；旧 **picaitool.db** 及 **server/gallery/** 下旧图已清理，不影响程序运行（新图仍写入 `server/gallery/`）。

### 其他
- **打印版**：`npm run docs:print` 为本地脚本，不消耗 Cursor/API token；文档更新后需执行以刷新 `docs/print/*.html`。

---

## 今日完成（2026-03-07，续2）

### 部署准备（香港已暂停，下次或改美国）

- 曾选定腾讯云香港轻量 VPS（43.161.215.41）；因 **Gemini API 香港不可用**，倾向放弃香港，下次改在美国 VPS 部署（美国直连 Gemini 无地区限制）。
- 部署文档 `docs/DEPLOY.md` 为通用 VPS 步骤（环境、Git、PM2、Nginx 等），美国部署时只需换为自己的服务器 IP 与用户。
- 美国部署时：无需配置 HTTPS_PROXY，步骤与文档一致。

---

## 今日完成（2026-03-07，续）

### 客户积分管理系统（手动运营版）

**已完成：**

- 新建 `users` 表（SQLite），替代 `users.json`；用户注册/登录全部改为读写数据库
- 启动时自动将 `users.json` 中的历史账号迁移到 `users` 表（幂等，不重复插入）
- `user_points` 表新增 `expires_at`（订阅到期时间戳）、`last_granted_at`（最后充值时间）字段，旧数据库自动 `ALTER TABLE` 升级
- `getBalance` 加入惰性清零逻辑：每次读取余额时检查 `expires_at`，过期则自动归零并写一条「订阅到期，积分清零」流水
- 新增 `grantPoints(email, amount, days)` 函数：管理员充值专用，每次充值同时重置有效期（新到期时间 = 现在 + days 天）
- `requireAuth` 中间件改为从数据库实时读取用户角色，注入 `req.user.role`
- 新增 `requireAdmin` 中间件（role !== 'admin' 返回 403）
- 新增 5 个管理员 API（均需 admin 角色）：
  - `GET /api/admin/users`：客户列表（邮箱、角色、余额、到期时间、总消耗、注册时间）
  - `POST /api/admin/users/:email/grant`：充值积分并设置有效期
  - `DELETE /api/admin/users/:email`：删除客户
  - `GET /api/admin/users/:email/transactions`：查看某客户积分流水
  - `PATCH /api/admin/users/:email/role`：修改用户角色（user/admin）
- 新增前端管理后台页面 `src/pages/Admin.jsx`（路由 `/admin`，需登录且角色为 admin）：
  - 客户列表表格（余额/到期时间/已消耗积分实时显示，颜色区分「即将到期/已过期/正常」）
  - 充值弹窗（快捷选 7/30/90 天，支持自定义天数）
  - 积分流水弹窗
  - 删除客户确认弹窗
- `AuthContext` 新增 `isAdmin` 便捷属性
- `server/.env` 新增 `ADMIN_EMAIL` + `ADMIN_PASSWORD` 配置项，后端启动时自动提升/创建管理员账号

**客户购买套餐的完整流程（当前手动运营模式）：**

1. 客户通过微信/邮件等渠道联系，选择套餐（如 100 积分，30 天有效）
2. 客户付款（微信/支付宝等线下方式）
3. 管理员收款确认后，打开 `/admin` 后台
4. 若客户无账号，引导客户先去 `/register` 注册
5. 在客户列表找到该邮箱，点「充值」，填写积分数量 + 有效天数，确认
6. 系统自动设置 `expires_at = 现在 + N 天`，客户即可正常使用
7. 到期后，客户下次请求时系统自动清零余额，显示「积分不足」
8. 续费时：客户再次付款 → 管理员再次充值，有效期从充值当天重新起算，未用完积分累加

**待后续完善/升级：**

| 功能 | 说明 | 现状 |
|------|------|------|
| 支付接入 | 微信支付/支付宝，客户自助下单，付款后自动触发充值 | ❌ 待做 |
| 到期提醒 | 提前 3～7 天发邮件/消息通知客户积分即将到期 | ❌ 待做 |
| 前端套餐页 | 客户自助选套餐、查看当前余额和到期时间 | ❌ 待做（当前仅管理员可见信息） |
| 套餐配置化 | 后台可配置套餐名称/价格/积分数/天数，无需改代码 | ❌ 待做 |
| 财务记录 | 订单/收款单据，用于对账和开票 | ❌ 待做（当前只有积分流水） |
| 批量操作 | 管理后台批量充值/批量删除客户 | ❌ 待做 |
| 注册审批 | 新用户注册后需管理员审批才能使用，防止随意注册 | ❌ 待做 |

---

## 今日完成（2026-03-07）

### 亚马逊 A+ 详情页生成（MVP）

**已完成：**
- 前端新增 `src/pages/AmazonAPlus.jsx`，4 步流程：填写信息 → 确认文案 → 生成图片 → 查看结果
- 后端新增两个接口：
  - `POST /api/amazon-aplus/analyze`：调用文本模型生成文案（不扣积分），返回 heroTagline/heroSubtext/3 个特点/品牌故事
  - `POST /api/amazon-aplus/generate`：根据确认后的文案生图（顺序生成 4 张，避免并发限速）、扣积分、自动存图库
- 支持 10 种语言选择（英/德/法/意/西/日/中/荷/瑞/波），文案和图片 prompt 均注入语言指令
- 3 种视觉风格：白底简洁 / 场景生活 / 高端黑金
- 文案和图片一一对应展示，所有文字字段支持一键复制（`CopyableText`）
- 图片自动存图库，成功后显示消耗积分数
- 后端全程调试日志（文案生成、每张图状态、积分扣除、图库保存）
- 图片 prompt 加入最高优先级禁文字规则，防止 AI 将产品名/参考图中的文字渲染到图上
- 导航栏新增「A+ 页面」入口（`/amazon-aplus`）
- 隐藏「服装组图」「风格复刻」「万能画布」导航入口（暂不开放）

**A+ 完整方案（尚未实现，记录备用）：**

| 模块 | 说明 | 现状 |
|------|------|------|
| Hero 横幅 | 1464×600 px，16:9，主标题+副标题 | ✅ MVP 已有 |
| 三栏特点图 | 300×300 px，1:1，标题+描述 | ✅ MVP 已有 |
| 品牌故事 | 纯文字模块，标题+正文 | ✅ MVP 已有（仅文字，无图） |
| 对比图（A/B 模块） | 左右分栏对比，含标题+描述 | ❌ 待做 |
| 产品规格图 | 含技术参数表格，标注尺寸/重量等 | ❌ 待做 |
| 场景生活图 | 产品在真实使用环境中的大图 | ❌ 待做 |
| 视频缩略图/封面 | 亚马逊 A+ 支持嵌入视频 | ❌ 待做 |
| 多语言版本切换 | 一套信息生成多语言版本 | 部分（单次选语言，不支持批量） |
| 自定义模块顺序 | 用户拖拽调整模块顺序 | ❌ 待做 |
| 导出为 HTML/ZIP | 供卖家后台直接上传 | ❌ 待做 |
| 图片尺寸精准裁剪 | 按亚马逊规格精确输出 px | ❌ 待做（当前为比例生成） |

**修改图片模块补充：**
- 新增「图片文字替换」「图片文字语言转换」两种模式（共 9 种）
- 文字替换/翻译支持字体样式选择（字重/颜色/字号放大缩小+百分比）
- **文字替换**支持「框选提取」：在原文字输入框旁可点击「框选提取」，在图片上拖拽框选区域，由 Gemini OCR 识别并自动填入原文字；支持「全图识别」。
- 输出设置默认展开
- 模型选择旁加入黄色提示（文字操作推荐 Nano Banana 2/Pro）
- 修改后图片自动入图库、显示积分消耗
- 图库选图入口（`GalleryThumb` 组件，fetch + blob URL 认证加载）
- 语言选项统一改为中文标识（英文→英文、German→德文 等）

---

## 今日完成（2026-03-05）

- **设计规范与图片规划**：改为 Markdown 渲染（`react-markdown` + `remark-breaks`），不再做自定义换行/字体解析；支持单换行显示。
- **重置**：整体设计规范、图片规划在编辑时可「重置」到分析首次返回的原始内容。
- **步骤 5**：「返回上一步」→ 步骤 3；「新建项目」→ 步骤 1；确认弹窗改为自定义（不显示 localhost、字体更大）。
- **图片展示**：一行两图、更大；图片规划分析只填主标题，副标题/说明留空供用户自填。
- **进度条**：分析中/生成中全页遮罩内增加不确定进度条。
- **仓库**：SQLite 数据库（`server/db.js` + `pictoolai.db`）+ `server/gallery/` 存图；登录用户生成图**自动**写入仓库；每张图可「保存到本地」下载；工作台 → 仓库从接口拉取并展示。
- **README**：补充数据库概念（SQLite vs MySQL/PostgreSQL）、已知问题/后续可做与文档同步。
- **侧栏与路由**：「工作台」改为仅保留「仓库」入口（`/dashboard/gallery`）；访问 `/dashboard` 重定向到 `/dashboard/gallery`。
- **仓库批量删除**：仓库页增加「删除选中」按钮，对选中图片逐个调用 DELETE 并更新列表与选中状态。
- **生图文字不裁切**：在 `server/index.js` 生图 prompt 中强化 `safeAreaRule`，要求整段标题完整在画面内、四周留足边距、禁止单词在边缘被裁切（如 "DURABILITY" 不得只露出一部分）。

## 历史记录（已处理）

### 整体设计规范显示方式（已改为 Markdown 渲染）

- 前端已删除 `SECONDARY_LABELS`、`splitBySecondaryLabels`、`parseLabelLine`；`SpecPreview` 与图片规划描述均用 `react-markdown` 渲染。
- 若分析结果格式不规范，可在 `server/index.js` 的分析 prompt 中约定输出为规范 Markdown。

---

## 今日完成（2026-03-19，续）

### 侵权风险检测独立模块
- **侵权风险检测**从「电商AI运营助手」侧边栏中拆出，成为独立的顶部导航模块，路由 `/ip-risk`，页面 `src/pages/IpRisk.jsx`。
- 文档是否单独起文件：暂不单独起，相关内容（服务构成、费用、SerpApi 说明、待开放功能、向客户解释话术）统一在 `docs/ECOMMERCE-AI-ASSISTANT.md` 附录章节。
- `docs/PROJECT-OVERVIEW.md` 功能表已同步更新。

---

## 今日完成（2026-03-19）

### 界面文案调整
- **导航栏**：「电商生图」→「**通用电商生图**」；页面标题同步更新。文档（PROJECT-OVERVIEW、ECOMMERCE-GENERAL-CREATE-PICTURES）与项目记忆已同步。
- **Nano Banana 提示**：去掉「Nano Banana(2.5)」中的版本号 `(2.5)`，改为「Nano Banana」，避免客户困惑（两处：DetailSet.jsx / AiAssistant.jsx）。
- **卖点图张数标签**：原「各类型 0～4 张；卖点图 0～你填写的卖点数」→「主图/场景/特写/交互图各 0～4 张；卖点图 0～5 张，对应你填写的卖点数」，消除「卖点图也限 4 张」的误解（实际逻辑一直是动态上限=填写卖点数，最多 5 张）。

---

## 文档与代码归档说明

- 项目说明与结构见根目录 `README.md`。
- 后端接口与模型配置见 `server/index.js`、`server/gemini-models.js`、`server/db.js`。
- 全品类组图流程、设计规范与图片规划逻辑见 `src/pages/DetailSet.jsx` 及本目录下的记录。
