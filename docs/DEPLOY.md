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

## 阶段二：上传代码（待做）

### 方式：通过 GitHub

> 如果代码还没推到 GitHub，先在本地执行：
> 1. 去 github.com 新建一个私有仓库
> 2. `git remote add origin https://github.com/你的用户名/仓库名.git`
> 3. `git push -u origin main`

### 在服务器上拉取代码

```bash
cd ~
git clone https://github.com/你的用户名/仓库名.git app
cd app
```

---

## 阶段三：配置环境变量（待做）

```bash
nano server/.env
```

填入以下内容（参考 server/.env.example）：

```
GEMINI_API_KEY=你的key

# 香港服务器不需要代理，这行删掉或注释掉
# HTTPS_PROXY=http://127.0.0.1:7890

ADMIN_EMAIL=你的管理员邮箱
ADMIN_PASSWORD=你的管理员密码
```

保存：`Ctrl+O` 回车，退出：`Ctrl+X`

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
pm2 start index.js --name picaitool-server
pm2 save
pm2 startup
```

验证后端是否正常：

```bash
pm2 status
pm2 logs picaitool-server
```

---

## 阶段七：配置 Nginx（待做）

```bash
sudo nano /etc/nginx/sites-available/picaitool
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
sudo ln -s /etc/nginx/sites-available/picaitool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 阶段八：验证访问（待做）

浏览器打开：`http://43.161.215.41`

能看到登录页面说明部署成功。

---

## 日常运维

### 更新代码

```bash
cd ~/app
git pull
npm run build          # 前端有改动时执行
cd server && npm install  # 后端依赖有变化时执行
pm2 restart picaitool-server
```

### 查看后端日志

```bash
pm2 logs picaitool-server
```

### 重启后端

```bash
pm2 restart picaitool-server
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
