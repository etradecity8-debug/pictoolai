## PicAITool 营销站复刻（学习用）

这是对 PicSet AI 官网的一次 1:1 前端复刻练习，品牌名替换为 **PicAITool**，用于练习 React + Tailwind 的 vibe coding 开发方式，仅供个人学习使用。

### 技术栈

- React 18 + Vite
- React Router 6（多页面路由）
- Tailwind CSS（原子化样式）

### 主要功能/页面

- 首页：导航（万能画布/全品类组图/风格复刻/服装组图/图片精修/定价策略）、Hero、产品能力展示（Tab）、功能卡片、常见问题（FAQ）、底部 CTA
- 营销页：产品、定价、关于我们、联系我们
- 认证页：登录、注册、忘记密码（静态表单 UI）
- 产品内页：Dashboard 工作台、图库、设置（静态布局）

### 本地运行

```bash
cd \"nano banana for business\"
npm install
npm run dev
```

浏览器打开终端输出的本地地址（通常是 `http://localhost:5173`）。

### 后续可以改进的方向（TODO）

- 继续微调首页各区块的间距、字号和对齐，使之更接近原站视觉
- 复刻更多原站的营销内容（案例展示、合作品牌等）
- 让 Dashboard 内页 UI 更贴近真实产品（筛选、表格、操作按钮等）
- 为组件补充简单的 Storybook/截图文档，记录每次 vibe coding 的设计决策

