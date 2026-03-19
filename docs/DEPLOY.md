# PicToolAI 运维手册

> 本文涵盖四块内容：**首次部署**（VPS 环境搭建）→ **每次更新**（日常发版操作）→ **COS 配置**（仓库图片国内加速）→ **用户管理**（管理后台 + 数据库操作）。
>
> 附录：Gemini 地区限制说明。

---

## 目录

- [一、首次部署（VPS）](#一首次部署vps)
- [二、每次更新上线](#二每次更新上线)
- [三、配置 SerpApi（开放侵权深度查询）](#三配置-serpapi开放侵权深度查询)
- [四、仓库图片加速（腾讯云 COS，可选）](#四仓库图片加速腾讯云-cos可选)
- [五、用户管理与数据库操作](#五用户管理与数据库操作)
- [附录：Gemini 地区限制](#附录gemini-地区限制)

---

## 一、首次部署（VPS）

> 下文步骤适用于 Ubuntu/Debian VPS，部署时把「服务器 IP、用户」换成你的即可。
> 当前已部署：美国硅谷（腾讯云轻量，`43.162.87.60`，域名 `pictoolai.studio`，HTTPS 已启用）。

### 1.1 连接服务器

```bash
ssh ubuntu@你的服务器IP
```

### 1.2 安装环境（已完成 ✅）

```bash
sudo apt update && sudo apt upgrade -y && sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

验证版本：

```bash
node -v && npm -v && pm2 -v && nginx -v
```

> 遇到紫色弹窗时：按 **Tab** 键移到 `<Ok>` 再回车。

### 1.3 克隆代码

```bash
cd ~
git clone https://github.com/etradecity8-debug/pictoolai.git app
cd app
```

私有仓库会提示输入 GitHub 用户名和密码（密码填 **Personal Access Token**）。

### 1.4 配置环境变量

```bash
nano server/.env
```

把下面内容粘贴进去，把 `你的…` 换成真实值后保存：

```
GEMINI_API_KEY=你的Gemini的API_Key
ADMIN_EMAIL=你的管理员邮箱
ADMIN_PASSWORD=你的管理员密码

# 以下可选：
# HTTPS_PROXY=http://127.0.0.1:7890        # 若服务器访问 Gemini 需代理则填
# SERPAPI_KEY=你的SerpApi密钥               # 侵权风险深度查询，见第三节
# COS_SECRET_ID=                            # 腾讯云 COS 加速，见第四节
# COS_SECRET_KEY=
# COS_BUCKET=pictoolai-1234567890
# COS_REGION=na-siliconvalley
# COS_CDN_DOMAIN=img.pictoolai.studio       # 可选 CDN 加速域名
```

保存：`Ctrl+O` 回车；退出：`Ctrl+X`。

### 1.5 安装依赖并构建前端

```bash
cd ~/app
npm install
npm run build
cd server
npm install
```

### 1.6 启动后端

```bash
cd ~/app/server
pm2 start index.js --name pictoolai-server --cwd /home/ubuntu/app/server
pm2 save
pm2 startup
```

验证：

```bash
pm2 status
pm2 logs pictoolai-server
```

### 1.7 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/pictoolai
```

粘贴以下配置（**不要带 ` ```nginx ` 等 Markdown 符号**）：

```nginx
server {
    listen 80;
    server_name 43.162.87.60;

    root /home/ubuntu/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
        client_max_body_size 20m;
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/pictoolai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

**常见问题**：
- **浏览器 500**：Nginx 无权限读 `dist`，执行 `sudo chmod 755 /home/ubuntu /home/ubuntu/app /home/ubuntu/app/dist && sudo chmod -R 755 /home/ubuntu/app/dist`，再强制刷新。
- **登录不进去**：确认 `pm2 status` 显示 `pictoolai-server` 为 `online`；若在配好 `.env` 前就启动了后端，管理员未创建，需 `pm2 restart pictoolai-server` 后重试。

### 1.8 配置 HTTPS（已完成 ✅）

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d pictoolai.studio
```

- 证书自动续期（`certbot.timer`）。
- 腾讯云轻量防火墙需放行 **TCP 443**（来源 0.0.0.0/0）。
- 如需添加 `www`：先做 A 记录，再执行 `sudo certbot --nginx -d pictoolai.studio -d www.pictoolai.studio`。

### 1.9 迁移说明（已有旧版部署）

若曾按旧拼写（`picaitool`）部署过，执行一次性迁移：

```bash
# 重命名旧数据库
cd ~/app/server
mv picaitool.db pictoolai.db 2>/dev/null
mv picaitool.db-wal pictoolai.db-wal 2>/dev/null

# 更换 PM2 进程名
pm2 delete picaitool-server
pm2 start index.js --name pictoolai-server --cwd /home/ubuntu/app/server
pm2 save
```

---

## 二、每次更新上线

> 每次改完代码后按这个流程操作。先在本机做 1-4 步，然后 SSH 登录服务器做 5-11 步。

### 第一步：本机 → 查看改动

```bash
git status
```

确认改动文件符合预期（如 `server/index.js`、`src/pages/...`、`docs/` 等）。

### 第二步：本机 → 加入暂存区

```bash
git add .
```

### 第三步：本机 → 提交

```bash
git commit -m "简短说明，如：feat: 侵权风险检测"
```

### 第四步：本机 → 推送

```bash
git push
```

若提示输入密码，填 GitHub **Personal Access Token**（不是登录密码）。

---

以下在**服务器**（SSH 登录后）执行：

### 第五步：进入项目目录

```bash
cd ~/app
```

### 第六步：拉取最新代码

```bash
git pull
```

### 第七步：安装前端依赖（仅 package.json 有变化时需要）

```bash
npm install
```

### 第八步：构建前端（有前端改动时执行）

```bash
npm run build
```

若只改了后端（`server/index.js` 等），跳过第七、八步。

### 第九步：进入后端目录

```bash
cd server
```

### 第十步：安装后端依赖（仅后端 package.json 有变化时需要）

```bash
npm install
```

### 第十一步：重启后端

```bash
pm2 restart pictoolai-server
```

若 PM2 进程名不是 `pictoolai-server`，先用 `pm2 list` 查看实际名字。

---

**查看日志**（出现问题时）：

```bash
pm2 logs pictoolai-server
```

**服务器重启后自动恢复**：PM2 startup 配置好后，服务器重启会自动拉起后端，Nginx 也会自动启动。

---

## 三、配置 SerpApi（开放侵权深度查询）

界面显示「深度查询暂未开放，请联系管理员」= 服务器上未配置 `SERPAPI_KEY`。

**获取 Key**：访问 https://serpapi.com/ → 注册/登录 → Dashboard → 复制 API Key。

**套餐参考**：Free 约 250 次/月；正式使用建议 Developer（$75/月，5000 次/月）。每次深度查询约消耗 3 次（1 次 Lens + 1 次 Patents + 1 次商标）。

**在服务器上配置**（一步步执行）：

```bash
cd ~/app
```

```bash
nano server/.env
```

在文件末尾加一行：

```
SERPAPI_KEY=你的SerpApi密钥
```

保存退出（`Ctrl+O` 回车 → `Ctrl+X`）。

```bash
pm2 restart pictoolai-server
```

重启后，站内「深度查询」即可正常使用。

---

## 四、仓库图片加速（腾讯云 COS，可选）

服务器在海外（美国），国内用户访问仓库图片会较慢。配置腾讯云 COS 后，新图自动同步到 COS，国内用户从就近节点加载，速度明显提升。**不配置时行为与之前一致，无需迁移**。

### 4.1 准备 COS

1. 登录[腾讯云控制台](https://console.cloud.tencent.com)，进入**对象存储** → **创建存储桶**。
2. 选地域（国内加速建议香港/广州），权限选**私有读写**。记下**桶名称**（如 `pictoolai-1234567890`）和**地域**（如 `ap-guangzhou`）。
3. **访问管理** → **API 密钥管理** → **新建密钥**，得到 `SecretId` 和 `SecretKey`。
4. **可选 CDN**：在 CDN 控制台添加加速域名（如 `img.pictoolai.studio`），源站选对象存储，再配置 CNAME。

### 4.2 配置 .env

在服务器 `server/.env` 末尾追加：

```
COS_SECRET_ID=你的SecretId
COS_SECRET_KEY=你的SecretKey
COS_BUCKET=pictoolai-1234567890
COS_REGION=ap-guangzhou
# COS_CDN_DOMAIN=img.pictoolai.studio   # 可选，配了 CDN 再填
```

```bash
pm2 restart pictoolai-server
```

### 4.3 工作原理

| 状态 | 仓库返回地址 | 前端展示 |
|------|------------|---------|
| 图刚生图，COS 还在上传 | `/api/gallery/image/:id`（本地） | 带 Token fetch，能正常展示 |
| COS 上传完成 | `https://...cos...`（COS 签名 URL） | 直接 img src，加载更快 |

- 生图时先写本地 + 入库，再**异步**上传 COS，不阻塞生图接口。
- 仓库列表对 COS URL 直接 img src（无 CORS 问题）；相对路径带 Token fetch。
- 下载/批量下载统一走 `/api/gallery/image/:id`（后端从本地读），不依赖 COS。
- 删除图片时同时删本地文件和 COS 对象（若有 `cos_key`）。

### 4.4 费用参考（2026-03 价格）

| 费用类型 | 单价 |
|---------|------|
| 存储费 | ~0.099 元/GB/月 |
| 读请求（GET） | ~0.01 元/万次 |
| 写请求（PUT） | ~0.01 元/万次 |
| 外网下行流量 | ~0.5 元/GB（主要费用） |

**实测**：单用户每天生成 10 张图、查看仓库几次，月费约 **0.1–0.3 元**。若配 CDN 可降低流量费（CDN 回源约 0.15 元/GB，且有缓存）。不需要 COS 时注释掉 `.env` 里四行 `COS_*` 并重启即可关闭。

### 4.5 验收测试

**不配 COS 时**：生图后立刻进仓库，应能看到图（不卡「加载中」）；点下载能保存。

**配 COS 后**：生图后进仓库，图能展示（先相对路径，稍后刷新变 COS URL）；删除一张图后列表消失。

若仓库图片一直「加载中」：F12 → Network 看 `/api/gallery` 和 `/api/gallery/image/xxx`。**401** = Token 过期，重新登录；**404/500** = 查后端日志。

---

## 五、用户管理与数据库操作

### 5.1 管理后台删除用户（推荐）

1. 管理员账号登录站点，进入 `/admin`（管理后台）。
2. 找到用户，点「删除」按钮，弹窗确认。

后台会**同时清除**：`users`、`user_points`、`points_transactions`、`gallery`（含本地文件与 COS 对象）、`amazon_listing_snapshots`、`ebay_listing_snapshots`、`aliexpress_listing_snapshots`。

删除后该邮箱可重新注册（积分重置为 0）。不能删除自己的账号。

### 5.2 在服务器上手动删除（仅数据库，不删文件）

> 用于后台不可用或需直接操作数据库时。**此方法只删数据库记录，不删图片文件**。若需连文件一起删，用 5.1 的管理后台方式。

进入数据库：

```bash
cd ~/app/server
sqlite3 pictoolai.db
```

逐条执行（把邮箱替换为实际邮箱，引号要成对，不要多打）：

```sql
DELETE FROM gallery WHERE user_email = '要删除的邮箱@example.com';
DELETE FROM user_points WHERE user_email = '要删除的邮箱@example.com';
DELETE FROM points_transactions WHERE user_email = '要删除的邮箱@example.com';
DELETE FROM amazon_listing_snapshots WHERE user_email = '要删除的邮箱@example.com';
DELETE FROM ebay_listing_snapshots WHERE user_email = '要删除的邮箱@example.com';
DELETE FROM aliexpress_listing_snapshots WHERE user_email = '要删除的邮箱@example.com';
DELETE FROM users WHERE email = '要删除的邮箱@example.com';
```

退出：

```sql
.quit
```

**sqlite3 卡住时**（`...>` 出不去）：按 **Ctrl+C** 回到 `sqlite>`，再输入 `.quit`。通常是引号没闭合（多打了一个 `'`）导致续行状态。

### 5.3 只让邮箱能再次注册

若界面提示「该邮箱已注册」但用户已删，多半是 `users` 表还有残留。执行：

```bash
cd ~/app/server && sqlite3 pictoolai.db
```

```sql
DELETE FROM users WHERE email = '该邮箱@example.com';
.quit
```

注意：其他表的数据（积分、仓库、Listing）不会被删，如需彻底清理请用 5.2 的完整 7 条语句。

### 5.4 查看所有用户

```bash
cd ~/app/server && sqlite3 pictoolai.db
```

```sql
SELECT email, role, admin_notes, datetime(created_at/1000,'unixepoch','localtime') AS 注册时间
FROM users ORDER BY created_at DESC;
```

退出：`.quit`。不要用 `SELECT *`，避免在终端暴露 `password_hash`。

### 5.5 数据库文件位置

| 内容 | 位置 |
|------|------|
| 数据库文件 | `server/pictoolai.db` |
| 图片文件 | `server/gallery/` |
| 备份方式 | 复制这两个路径即可 |

### 5.6 接口对应关系

| 操作 | 接口 | 权限 |
|------|------|------|
| 删除用户 | `DELETE /api/admin/users/:email` | 仅 admin |
| 充值积分 | `POST /api/admin/users/:email/grant` | 仅 admin |
| 查积分流水 | `GET /api/admin/users/:email/transactions` | 仅 admin |
| 编辑备注 | `PATCH /api/admin/users/:email/notes` | 仅 admin |
| 清理孤儿仓库 | `POST /api/admin/cleanup-orphan-gallery` | 仅 admin |

---

## 附录：Gemini 地区限制

### 现象

服务器在香港时，调用 Gemini 返回：
```
User location is not supported for the API use.（status: FAILED_PRECONDITION）
```

### 原因

Gemini API 有地区限制，仅允许美国、加拿大、部分欧洲、印度、澳大利亚等地区请求。**香港不在列**。发请求的是服务器（非用户浏览器），因此用户自己开代理无效。

### 解决方案

| 方案 | 做法 | 优缺点 |
|------|------|--------|
| **A. 迁美国服务器（当前方案）** | 在美国 VPS 重新部署 | 根本解决；国内用户访问略慢 |
| **B. 香港 + 代理** | `server/.env` 配 `HTTPS_PROXY=http://代理IP:端口` | 保留香港部署；需有美国代理出口 |
| **C. 用户自己开代理** | — | **无效**（调 Gemini 的是服务器） |

**当前状态**：已迁移至美国硅谷（43.162.87.60），Gemini 访问正常，无需代理。
