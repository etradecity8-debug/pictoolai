# PicAITool 部署指南（香港 VPS）

## 服务器信息

| 项目 | 内容 |
|------|------|
| 服务商 | 腾讯云轻量应用服务器 |
| 地域 | 中国香港（锐驰型，跨境优化） |
| 套餐 | 2核2G / 40GB SSD / 200Mbps / ¥55/月 |
| 公网 IP | 43.161.215.41 |
| 系统 | Ubuntu 22.04 LTS |
| 登录用户 | ubuntu |

## 连接服务器

```bash
ssh ubuntu@43.161.215.41
```

---

## 阶段一：环境安装（已完成 ✅）

### 安装 Git、Nginx、Node.js 20、PM2

```bash
sudo apt update && sudo apt upgrade -y && sudo apt install -y git nginx && curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs && sudo npm install -g pm2
```

### 验证版本

```bash
node -v && npm -v && pm2 -v && nginx -v
```

已安装版本：
- Node.js v20.20.1
- npm 10.8.2
- PM2 6.0.14
- Nginx 1.18.0

> **遇到紫色弹窗时**：按键盘左上角 **Tab** 键移动到 `<Ok>` 按钮，再按回车确认。

---

## 阶段二：上传代码

### 2.1 本地：推送到 GitHub

1. **在 GitHub 新建私有仓库**（如 `pictoolai`），不要勾选「Add README」。
2. **在项目根目录执行**（把 `你的用户名` 和 `仓库名` 换成你的）：

```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

若仓库已存在且已添加过 `origin`，只需 `git push -u origin main`。

若推送报错 **Repository not found**：先确认在 GitHub 已创建同名仓库（如 `pictoolai`）；若仓库名不同，可修改远程地址：

```bash
git remote set-url origin https://github.com/你的用户名/实际仓库名.git
git push -u origin main
```

### 2.2 服务器上：克隆代码

SSH 登录后执行（本项目仓库：`etradecity8-debug/pictoolai`）：

```bash
cd ~
git clone https://github.com/etradecity8-debug/pictoolai.git app
cd app
```

若为私有仓库，会提示输入 GitHub 用户名和密码（密码处填 **Personal Access Token**）。

---

## 阶段三：配置环境变量

在服务器上执行：

```bash
nano server/.env
```

**下面整段复制到 nano 里**，把 `你的Gemini的API_Key`、`你的管理员邮箱`、`你的管理员密码` 换成真实值后保存：

```
GEMINI_API_KEY=你的Gemini的API_Key

# 香港服务器不需要代理，不要填 HTTPS_PROXY
# HTTPS_PROXY=

ADMIN_EMAIL=你的管理员邮箱
ADMIN_PASSWORD=你的管理员密码
```

保存：`Ctrl+O`（**字母 O**，不是数字 0）回车，退出：`Ctrl+X`。

---

## 阶段四：安装依赖（待做）

```bash
# 安装前端依赖
cd ~/app
npm install

# 安装后端依赖
cd ~/app/server
npm install
```

---

## 阶段五：构建前端（待做）

```bash
cd ~/app
npm run build
```

构建完成后会生成 `dist/` 目录，这是前端的静态文件。

---

## 阶段六：启动后端（待做）

```bash
cd ~/app/server
pm2 start index.js --name pictoolai-server
pm2 save
pm2 startup
```

验证后端是否正常：

```bash
pm2 status
pm2 logs pictoolai-server
```

---

## 阶段七：配置 Nginx

> 说明：Nginx 配置文件名、PM2 进程名只是「标识符」，和仓库名 pictoolai 一致即可，避免与品牌名 PicAITool 混淆。

```bash
sudo nano /etc/nginx/sites-available/pictoolai
```

填入以下配置：

```nginx
server {
    listen 80;
    server_name 43.161.215.41;  # 后续换成域名

    # 前端静态文件
    root /home/ubuntu/app/dist;
    index index.html;

    # 前端路由（React Router）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 转发
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
        client_max_body_size 20m;
    }

    # 仓库图片转发
    location /api/gallery/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/pictoolai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # 去掉默认站点，否则会显示 Welcome to nginx
sudo nginx -t
sudo systemctl reload nginx
```

**阶段七常见问题：**

- **浏览器 500**：多半是 Nginx 无权限读 `dist`。在服务器执行：
  ```bash
  sudo chmod 755 /home/ubuntu /home/ubuntu/app /home/ubuntu/app/dist
  sudo chmod -R 755 /home/ubuntu/app/dist
  ```
  然后强制刷新页面（Ctrl+Shift+R）。
- **粘贴配置时**：只粘贴从 `server {` 到 `}` 的纯配置，**不要**带 \`\`\`nginx 或 \`\`\` 等 Markdown 符号，否则 nginx -t 会报 unknown directive。

---

## 阶段八：验证访问

浏览器打开：`http://43.161.215.41`

能看到登录页面说明部署成功。

**若登录不进去**：见下方「登录问题排查」。

---

## 登录问题排查

- **用哪个账号？** 服务器上的管理员账号 = 你在**服务器** `server/.env` 里填的 `ADMIN_EMAIL` + `ADMIN_PASSWORD`（后端启动时会自动创建或提升该邮箱为管理员）。请用这两个值登录，注意大小写、空格。
- **先试注册**：在登录页点「注册」，用任意邮箱和至少 6 位密码注册，再登录，可确认接口是否正常。
- **确认后端在跑**：SSH 上服务器执行 `pm2 status`，看 `pictoolai-server`（或 `picaitool-server`）是否为 `online`。
- **重启后端再试**：若你是在配好 `server/.env` 之前就启动了后端，管理员可能没被创建。SSH 上执行 `pm2 restart pictoolai-server`（或你的进程名），再用 ADMIN_EMAIL / ADMIN_PASSWORD 登录。
- **看接口是否被调用**：浏览器 F12 → Network，点登录，看是否有对 `http://43.161.215.41/api/login` 的请求；若 401 为「邮箱或密码错误」，若 500 可看服务器 `pm2 logs pictoolai-server` 最后几行报错。

---

## 部署完成总结（第一次部署后看）

| 项目 | 说明 |
|------|------|
| 访问地址 | http://43.161.215.41 |
| 代码位置 | 服务器 `~/app`（Git 从 GitHub 拉取） |
| 后端 | PM2 进程名 `pictoolai-server`（若当时用了 `picaitool-server` 则以实际为准） |
| 下次更新 | 见下方「日常运维 → 更新代码」，或部署时再问一步步操作 |

---

## 日常运维

### 更新代码（分两步：本机 → 服务器）

> **若不熟悉 Git/部署**：请严格按顺序、一步一步执行；先做完「本机」再去做「服务器」。

**第一步：本机**（在项目目录，如 `nano banana for business`）
```bash
git add .                    # 或只 add 改动的文件，如 git add server/index.js
git commit -m "简短说明"     # 例如：fix: 删除用户时清除积分
git push
```

**第二步：服务器**（SSH 登录后）
```bash
cd ~/app
git pull
npm run build                # 仅当前端有改动时执行
cd server && npm install     # 仅当后端依赖有变化时执行
pm2 restart picaitool-server # 进程名以你实际为准（picaitool-server 或 pictoolai-server）
```

只有后端改动的更新（如只改了 `server/index.js`）：本机 push 后，服务器执行 `cd ~/app && git pull && pm2 restart picaitool-server` 即可，无需 build。

### 管理后台：删除用户

管理员在「管理后台」删除客户时，会同时清除该客户的**积分余额**与**流水记录**，该邮箱重新注册后积分为 0。

### 查看后端日志

```bash
pm2 logs pictoolai-server
```

### 重启后端

```bash
pm2 restart pictoolai-server
```

### 服务器重启后自动恢复

PM2 startup 配置好后，服务器重启会自动拉起后端，Nginx 也会自动启动。

---

## 下一步可选：绑定域名 + HTTPS

1. 买一个域名（阿里云/腾讯云，约 ¥55/年）
2. 域名解析：添加 A 记录，指向 43.161.215.41
3. 用 certbot 申请免费 SSL 证书（Let's Encrypt）
4. Nginx 配置改为 443 端口 + 证书路径

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```
