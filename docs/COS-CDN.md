# 仓库图片国内加速（腾讯云 COS + CDN）

当服务器在海外（如美国）而用户在国内时，仓库图片直连源站会较慢。通过 **腾讯云 COS 存储 + 临时签名 URL**，新图上传到 COS，列表接口返回带签名的 URL，浏览器可直接从 COS（或配置 CDN 后从边缘节点）拉取，国内访问延迟明显降低。

## 行为说明

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
