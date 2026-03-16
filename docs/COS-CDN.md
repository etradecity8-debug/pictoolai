# 仓库图片国内加速（腾讯云 COS + CDN）

当服务器在海外（如美国）而用户在国内时，仓库图片直连源站会较慢。通过 **腾讯云 COS 存储 + 临时签名 URL**，新图上传到 COS，列表接口返回带签名的 URL，浏览器可直接从 COS（或配置 CDN 后从边缘节点）拉取，国内访问延迟明显降低。

## 行为说明

- **业务逻辑（全站统一）**：只要生图成功，图片都会**自动进入仓库**；生图完成后图片旁仅提供「保存到本地」，方便客人快速保存到电脑。不提供单独的「保存到仓库」按钮。
- **未配置 COS**：与之前一致，图片仅存服务器本地，列表返回 `/api/gallery/image/:id`，前端带 Token 请求。
- **配置 COS 后**：保存图片时同步上传到 COS，数据库记录 `cos_key`；列表接口对有 `cos_key` 的记录返回 **COS 临时签名 URL**（默认 1 小时有效），前端直接使用该 URL，无需带 Authorization。
- **删除**：删除仓库记录时会同时删除本地文件；若有 `cos_key` 会异步删除 COS 对象。

## 腾讯云侧准备

### 1. 开通对象存储 COS

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com)
2. 进入 **对象存储** → **存储桶列表** → **创建存储桶**
3. 选择地域：建议与业务一致（如美国服务器可选美东/硅谷，或为国内加速选香港/广州）
4. 名称自定义，访问权限选 **私有读写的私有桶**（通过临时签名 URL 访问）
5. 创建完成后记下：**桶名称**（如 `pictoolai-1234567890`）、**地域**（如 `na-siliconvalley`）

### 2. API 密钥

1. 进入 **访问管理** → **API 密钥管理** → **新建密钥**
2. 得到 **SecretId** 与 **SecretKey**，妥善保存（仅后端使用，不要提交到 Git）

### 3. 可选：CDN 加速

若希望国内用户通过 CDN 节点拉图：

1. 在 **CDN 控制台** 添加加速域名（如 `img.pictoolai.studio`），源站类型选 **对象存储**，选择刚创建的桶
2. 在 **域名解析** 中为该子域名添加 CNAME 指向 CDN 提供的 CNAME
3. 后端配置 `COS_CDN_DOMAIN=img.pictoolai.studio` 后，列表返回的签名 URL 将使用该域名（需 COS 支持自定义域名或 CDN 回源鉴权，按腾讯云当前文档配置）

未配置 CDN 时，签名 URL 使用 COS 默认域名，国内访问仍比直连美国源站快。

## 后端配置

在服务器 `server/.env` 中增加（不提交到 Git）：

```env
COS_SECRET_ID=你的SecretId
COS_SECRET_KEY=你的SecretKey
COS_BUCKET=pictoolai-1234567890
COS_REGION=na-siliconvalley
# 可选：CDN 加速域名
# COS_CDN_DOMAIN=img.pictoolai.studio
```

重启后端后生效：

```bash
pm2 restart pictoolai-server
```

## 数据库与代码

- **gallery 表** 已增加 `cos_key` 字段（空表示仅本地）；新写入的记录在配置 COS 后会自动写入 `cos_key`。
- **旧数据**：未配置 COS 前的图片无 `cos_key`，列表仍返回 `/api/gallery/image/:id`，由现有接口带 Token 提供，无需迁移即可兼容。

## 验收

1. 配置好 COS 并重启后端，新生成或保存一张图到仓库。
2. 打开仓库页，列表该项的 `url` 应为以 `https://` 开头的 COS 签名 URL。
3. 国内网络下打开该 URL 或仓库页，图片加载速度应明显优于直连美国源站。

## 相关文件

- 后端：`server/index.js`（COS 上传、列表签名 URL、删除时删 COS 对象）、`server/db.js`（gallery 表 cos_key）
- 配置示例：`server/.env.example` 中 COS_* 说明

---

## COS 实现说明与影响范围

### 1. 是否需要「等几十秒再去仓库」？

**结论：不需要，也不应要求用户这样做。**

- **列表返回什么**：有 `cos_key` 时返回 COS 临时签名 URL（`https://...cos...`）；没有时返回相对路径 `/api/gallery/image/:id`。
- **前端如何展示**：
  - 绝对 URL（COS）：直接用作 `<img src={url} />`，不发起 fetch，无 CORS 问题，图片可立即显示。
  - 相对路径：带 Token 请求 `/api/gallery/image/:id`，后端从**本地文件**返回（我们总是先写本地再上传 COS），图片也可立即显示。
- 因此：**无论 COS 是否已上传完成，用户进仓库都能立刻看到图**。之前「等几十秒」是因为误以为必须等 COS 才有地址；实际上无 `cos_key` 时用相对路径 + 本地文件即可。若曾出现「一直加载中」，是因为前端对 COS URL 用了 `fetch()` 触发跨域，已改为直接 img src 后已修复。
- **COS 上传时机**：除「手动保存到仓库」会等待 COS 再返回外，其余流程（电商生图、修改图片、风格复刻、A+、Listing 生图等）均为**先写本地 + 插入数据库，再异步上传 COS**，不阻塞接口响应，避免长时间等待或 502。

### 2. COS 对全代码的影响一览

**统一入口**：`server/index.js` 中的 `saveImageToGallery(email, id, title, dataUrl, pointsUsed, model, clarity)`。  
行为：写本地文件 → INSERT 一条 gallery（`cos_key = null`）→ 若开启 COS 则 `await uploadToCos` → UPDATE `cos_key`。  
**只有「调用方 await」时，列表在本次请求后才会立刻带上 COS 地址**；否则列表先返回相对路径，等后台 COS 上传完成后，下次拉列表才会变成 COS URL。

| 调用位置 | 是否 await | 说明 |
|----------|------------|------|
| **POST /api/gallery** | ✅ await | 当前前端无「保存到仓库」入口，生图均为自动入仓；该接口保留，若日后有手动保存入口则等待 COS 再返回。 |
| **电商生图**（DetailSet 生成完成自动入仓） | ❌ 否 | 生图成功后自动入仓，COS 后台进行。用户进仓库即可看到图（先相对路径，过一会儿刷新可见 COS URL）。 |
| **修改图片 / 一键换色 / 智能扩图等**（生成后自动入仓） | ❌ 否 | 同上，避免生图+COS 导致接口超时/502。 |
| **风格复刻**（StyleClone 每张入仓） | ❌ 否 | 同上。 |
| **A+ 详情页生成**（4 张图入仓） | ❌ 否 | 同上。 |
| **电商 AI 助手 - 亚马逊 / eBay / 速卖通**（各类产品图入仓） | ❌ 否 | 同上。 |

**前端与仓库相关的统一约定**（已实现）：

- **仓库列表**（`GET /api/gallery`）：返回的 `item.url` 可能是 `https://...`（COS）或 `/api/gallery/image/:id`（本地）。
- **仓库页展示**（`Gallery.jsx`）：`item.url` 为绝对 URL 时直接用作 img src；为相对路径时用 Token fetch 转 blob 再展示。下载/批量下载统一走 `GET /api/gallery/image/:id`（带 Token），由后端从本地文件返回，不依赖 COS CORS。
- **其他用仓库图片的页面**（ImageEdit、StyleClone、LocalErase、LocalRedraw、OneClickRecolor、SmartExpansion、ProductRefinement 等）：若 `item.url` 以 `http` 开头则请求时不带 Authorization，否则带 Token；展示时同样避免对 COS URL 做 fetch 造成跨域（若用 img 直接 src 则无问题）。

**删除与清理**：

- 单张删除（`DELETE /api/gallery/:id`）、管理员删用户、清理孤儿仓库：都会删本地文件，若有 `cos_key` 则异步删 COS 对象。

### 3. 最小测试清单

按顺序勾选即可，覆盖「不配 COS」与「配 COS」两种状态。

**前置**：后端已启动，前端能正常登录并打开仓库页。

---

#### A. 不配置 COS（注释掉 `server/.env` 中 COS_SECRET_ID 等四行或删掉，重启后端）

| # | 步骤 | 预期 | 勾选 |
|---|------|------|------|
| A1 | 任选一生图流程完成一张图（如：电商生图、修改图片、扩图、换色等），生图成功后**自动入仓** | 进仓库页**立刻**看到该图，无「加载中」卡住 | ☐ |
| A2 | 在仓库页对该图点「下载」 | 能弹出另存为并保存成功 | ☐ |
| A3 | 勾选 1～2 张图，点「批量保存到本地」、选文件夹 | 能保存到所选目录 | ☐ |

---

#### B. 配置 COS（填好 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION，重启后端）

| # | 步骤 | 预期 | 勾选 |
|---|------|------|------|
| B1 | 任选一生图流程完成一次生成（电商生图 / 修改图片 / 一键换色 / 智能扩图等）；生成成功后**自动入仓**，页上仅提供「保存到本地」 | 进仓库**马上**能看到新图且能正常显示（无需等几十秒；地址可能先为相对路径，过一会儿刷新可见 COS URL） | ☐ |
| B2 | 对仓库中任一张图点「下载」 | 能正常下载到本地 | ☐ |
| B3 | 在仓库删除一条记录（单张删除或批量删除） | 列表刷新后该条消失 | ☐ |

**若刷新后仓库里所有图一直「加载中」**：打开 F12 → Network，看 `GET /api/gallery` 与 `GET /api/gallery/image/xxx` 的状态码。若图片请求为 **401**，多为登录态过期，请**重新登录**后再进仓库；若为 404/500，需查后端日志或本地文件是否存在。

---

#### C. 可选（有国内环境时）

| # | 步骤 | 预期 | 勾选 |
|---|------|------|------|
| C1 | 配置 COS 后，从国内网络打开仓库页、加载多张图 | 图片能全部显示，加载延迟可接受（若配了 CDN 可对比未配时） | ☐ |

---

**说明**：  
- A 通过即可确认「无 COS 时仓库展示与下载」正常。  
- B 通过即可确认「有 COS 时自动入仓立即可见、下载与删除」正常。  
- 若某一步失败，记下编号（如 B2）和现象（如一直加载中、报错文案），便于排查。
