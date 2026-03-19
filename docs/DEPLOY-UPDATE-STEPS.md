# 本次更新：推送到服务器（一步步执行）

本文描述**通用流程**：本机提交并推送 → 服务器拉取、构建、重启。每次发版按下面步骤执行即可；具体改动以当次 `git commit -m "..."` 为准。

**本次（2026-03-18）**：侵权风险检测（免费快筛 + 深度查询：Google Lens + Patents + 商标检索，searchSummary、报告分组卡片、风险等级在标题行且「高」红色+警告）、客户沟通文档 IP-RISK-SERVICES-AND-COST、项目记忆与文档一致性更新。

---

## 第一步：本机提交并推送（在项目根目录执行）

在终端里进入项目目录（例如 `nano banana for business`），然后**一条一条**执行：

```bash
# 1. 查看有哪些文件被修改
git status
```

确认列表里有你期望的改动（如 `server/index.js`、`src/pages/AiAssistant.jsx`、`docs/`、`.cursor/rules/` 等）。

```bash
# 2. 把所有修改加入暂存区
git add .
```

```bash
# 3. 提交（本次可用下面这句；若要自己写说明，改引号里的内容即可）
git commit -m "feat: 侵权风险检测(快筛+深度Lens/Patents/商标+searchSummary+报告卡片风险等级)+IP-RISK文档+项目记忆与文档同步"
```

```bash
# 4. 推送到远程仓库
git push
```

若 `git push` 提示输入用户名/密码，密码处填你在 GitHub 的 **Personal Access Token**（不是登录密码）。

---

## 第二步：服务器上拉取并更新

用 SSH 登录服务器（美国硅谷示例：`ssh ubuntu@43.162.87.60`），登录成功后**按顺序**执行下面每一条：

```bash
cd ~/app
```

```bash
git pull
```

```bash
npm install
```

```bash
npm run build
```

```bash
cd server
```

```bash
npm install
```

```bash
pm2 restart pictoolai-server
```

**说明**：若 PM2 进程名不是 `pictoolai-server`，用 `pm2 list` 查看后替换最后一条里的名字；若项目不在 `~/app`，把第一步的 `cd ~/app` 改成你的实际路径。

---

## 第三步：验证

1. 浏览器打开站点（如 https://pictoolai.studio）。
2. 登录 → 进入 **电商AI运营助手** → 左侧点 **侵权风险检测**。
3. 上传一张图、选「免费快筛」并提交，应出现分组报告卡片（商标/Logo、外观设计等），卡片标题行有风险等级；若为「高」应为红色+警告图标。
4. （可选）若服务器已配置 `SERPAPI_KEY`，选「深度查询」提交，报告上方应出现「本次深度查询使用的检索方式」表格（检索方式、使用服务、用途说明等）。

若页面打不开或接口报错，在服务器执行：

```bash
pm2 logs pictoolai-server
```

看最后几行是否有报错。
