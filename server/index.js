import 'dotenv/config'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'
// 让 Node 的 fetch（含 Gemini 请求）走代理，仅当配置了 HTTPS_PROXY 时生效
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
  console.log('[后端 API] 已启用代理:', process.env.HTTPS_PROXY || process.env.https_proxy)
}
import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { createHash } from 'crypto'
import imageSize from 'image-size'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { GoogleGenAI } from '@google/genai'
import { ANALYSIS_MODEL_ID, ANALYSIS_MODEL_FALLBACK, getImageModelId, normalizeClarityForModel } from './gemini-models.js'
import { getDb } from './db.js'
import {
  setGetDb,
  getPointsPerImage,
  getBalance,
  addBalance,
  addTransaction,
  getTransactions,
  deductPoints,
  grantPoints,
  grantSignupBonus,
  getSubscriptionInfo,
} from './points.js'

setGetDb(getDb)

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'pictoolai-dev-secret-change-in-production'

// 腾讯云 COS：仅当配置了 COS 相关环境变量时启用（仓库图片加速）
let cosClient = null
const COS_BUCKET = process.env.COS_BUCKET || ''
const COS_REGION = process.env.COS_REGION || ''
const COS_CDN_DOMAIN = process.env.COS_CDN_DOMAIN || '' // 可选，如 img.pictoolai.studio
function getCosClient() {
  if (cosClient) return cosClient
  const SecretId = process.env.COS_SECRET_ID
  const SecretKey = process.env.COS_SECRET_KEY
  if (!SecretId || !SecretKey || !COS_BUCKET || !COS_REGION) return null
  const COS = require('cos-nodejs-sdk-v5')
  cosClient = new COS({ SecretId, SecretKey })
  return cosClient
}
function isCosEnabled() {
  return !!(process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY && COS_BUCKET && COS_REGION)
}
function uploadToCos(Key, Body, ContentType) {
  return new Promise((resolve, reject) => {
    const client = getCosClient()
    if (!client) return reject(new Error('COS not configured'))
    client.putObject(
      { Bucket: COS_BUCKET, Region: COS_REGION, Key, Body, ContentType },
      (err, data) => (err ? reject(err) : resolve(data))
    )
  })
}
function getCosSignedUrl(Key, Expires = 3600) {
  return new Promise((resolve, reject) => {
    const client = getCosClient()
    if (!client) return resolve(null)
    client.getObjectUrl(
      { Bucket: COS_BUCKET, Region: COS_REGION, Key, Sign: true, Expires },
      (err, data) => {
        if (err) return reject(err)
        let url = data?.Url || data
        if (typeof url !== 'string') url = data?.url
        if (COS_CDN_DOMAIN && url) {
          try {
            const u = new URL(url)
            url = url.replace(u.origin, `https://${COS_CDN_DOMAIN.replace(/^https?:\/\//, '')}`)
          } catch (_) {}
        }
        resolve(url || null)
      }
    )
  })
}
function deleteFromCos(Key) {
  return new Promise((resolve, reject) => {
    const client = getCosClient()
    if (!client) return resolve()
    client.deleteObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key }, (err) => (err ? reject(err) : resolve()))
  })
}

// API Key 仅从环境变量读取，不写进源码、不提交。调用方不要 log 此值。
function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || null
}

const usersPath = join(__dirname, 'users.json')

// 读 users.json（仅用于迁移，保留文件作为备份）
function readUsersJson() {
  if (!existsSync(usersPath)) return []
  try {
    return JSON.parse(readFileSync(usersPath, 'utf8'))
  } catch {
    return []
  }
}

// ── SQLite 用户操作 ──────────────────────────────────────────────────────────

function dbFindUser(email) {
  return getDb().prepare('SELECT email, password_hash, role, created_at FROM users WHERE email = ?').get(email.toLowerCase())
}

function dbCreateUser(email, passwordHash, role = 'user') {
  getDb()
    .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .run(email.toLowerCase(), passwordHash, role, Date.now())
}

/** 启动时将 users.json 中的现有用户迁移到 SQLite */
function dbMigrateFromJson() {
  const users = readUsersJson()
  if (!users.length) return
  let count = 0
  for (const u of users) {
    try {
      const existing = getDb().prepare('SELECT email FROM users WHERE email = ?').get(u.email)
      if (!existing) {
        getDb()
          .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
          .run(u.email, u.passwordHash, 'user', Date.now())
        count++
      }
    } catch (_) {}
  }
  if (count > 0) console.log(`[DB] 已将 ${count} 个用户从 users.json 迁移到 SQLite`)
}

/** 确保环境变量 ADMIN_EMAIL 对应的用户拥有 admin 角色 */
function dbEnsureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return
  const email = adminEmail.toLowerCase()
  const existing = getDb().prepare('SELECT role FROM users WHERE email = ?').get(email)
  if (existing) {
    if (existing.role !== 'admin') {
      getDb().prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email)
      console.log(`[DB] 已将 ${email} 设为管理员`)
    }
  } else {
    const adminPassword = process.env.ADMIN_PASSWORD
    if (adminPassword) {
      const hash = bcrypt.hashSync(adminPassword, 10)
      getDb()
        .prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)")
        .run(email, hash, Date.now())
      console.log(`[DB] 已创建管理员账号: ${email}`)
    }
  }
}

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// 注册
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' })
    }
    const normalizedEmail = email.toLowerCase()
    if (dbFindUser(normalizedEmail)) {
      return res.status(400).json({ error: '该邮箱已注册' })
    }
    const hash = await bcrypt.hash(password, 10)
    dbCreateUser(normalizedEmail, hash)
    // 新用户默认赠送 150 积分，有效期 30 天
    grantSignupBonus(normalizedEmail)
    const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' })
    const balance = getBalance(normalizedEmail)
    return res.json({ token, user: { email: normalizedEmail, role: 'user', pointsBalance: balance } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '注册失败' })
  }
})

// 登录
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' })
    }
    const normalizedEmail = email.toLowerCase()
    const user = dbFindUser(normalizedEmail)
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    const balance = getBalance(user.email)
    return res.json({ token, user: { email: user.email, role: user.role, pointsBalance: balance } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '登录失败' })
  }
})

// 解析前端传来的 data URL 为 { mimeType, data }（纯 base64）
function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1].trim(), data: m[2].trim() }
}

// 将 JSON 字符串值内的真实换行转为 \\n，便于解析（模型有时会返回未转义的换行）
function fixNewlinesInJsonStrings(str) {
  let out = ''
  let i = 0
  let inString = false
  let escape = false
  while (i < str.length) {
    const c = str[i]
    if (escape) {
      out += c
      escape = false
      i++
      continue
    }
    if (c === '\\' && inString) {
      out += c
      escape = true
      i++
      continue
    }
    if (c === '"' && !escape) {
      inString = !inString
      out += c
      i++
      continue
    }
    if ((c === '\n' || c === '\r') && inString) {
      out += '\\n'
      if (c === '\r' && str[i + 1] === '\n') i++
      i++
      continue
    }
    out += c
    i++
  }
  return out
}

// 从模型回复中尝试提取 JSON（支持 ```json ... ``` 包裹；取到最后一个 ``` 避免内容里的 ``` 截断）
const stripMarkdown = (s) => String(s || '').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/_{1,2}([^_]+)_{1,2}/g, '$1').trim()

function extractAnalyzeJson(text, logError) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  let raw = trimmed
  const openMatch = trimmed.match(/^[\s\S]*?```(?:json)?\s*\n?/)
  if (openMatch) {
    const afterOpen = trimmed.slice(openMatch[0].length)
    const lastClose = afterOpen.lastIndexOf('```')
    if (lastClose !== -1) raw = afterOpen.slice(0, lastClose).trim()
  }
  try {
    return JSON.parse(raw)
  } catch (e1) {
    const fixed = fixNewlinesInJsonStrings(raw)
    try {
      return JSON.parse(fixed)
    } catch (e2) {
      if (logError) {
        console.error('[后端 API] 解析分析 JSON 失败:', e2?.message || e2)
        console.error('[后端 API] 原始片段:', raw.slice(0, 300) + (raw.length > 300 ? '...' : ''))
      }
      return null
    }
  }
}

// 全品类组图：分析产品图 + 组图要求，返回整体设计规范 + 图片规划
app.post('/api/detail-set/analyze', async (req, res) => {
  const apiKey = getGeminiApiKey()
  console.log('[后端 API] POST /api/detail-set/analyze 收到请求，环境变量中有 API key:', !!apiKey)
  try {
    const { image, requirements, model, quantity } = req.body
    if (!image) {
      return res.status(400).json({ error: '请上传至少一张产品图' })
    }
    const planCount = Math.min(15, Math.max(1, parseInt(quantity, 10) || 3))
    if (apiKey) {
      const parsed = parseDataUrl(image)
      if (!parsed) {
        return res.status(400).json({ error: '图片格式无效，请重新上传' })
      }
      const prompt = `你是一名电商详情图设计专家。用户上传了一张产品图，并可能提供了组图要求。请根据产品图和用户要求，输出一份「整体设计规范」和「图片规划」。要求：专业家居/产品摄影级、字体与构图清晰、留白与安全边距明确，便于后续生图得到高端、可读性强的详情图。

**整体设计规范**（designSpecMarkdown）必须用 Markdown，且严格包含以下小节（二级标题 ##），与高端电商详情图一致：

1. 开头一句总则：如「所有图片必须遵循以下统一规范，确保视觉连贯性」。仅此一句，后文勿再重复。
2. **色彩系统**（分条写清）：
   - 主色调：色值（如 #FFFFFF）+ 对应用途（如产品主体、纯净与现代感）。
   - 辅助色：色值 + 用途（如强调卖点、环保、温暖感）。
   - 背景色：色值或场景描述（如极简浅灰 #F5F5F5 或自然光影室内场景）。
3. **字体系统**：
   - 标题字体：具体字体名（如 Montserrat Bold 或 Helvetica），现代无衬线。
   - 正文字体：具体字体名（如 Open Sans 或 Arial），轻量无衬线。
   - 字号层级：大标题:副标题:正文 = 3:1.8:1。
   - **标题颜色**：从色彩系统中推导，不要用纯黑或纯白。浅色/米白背景 → 用产品主色调加深版（如深森林绿、暖炭灰、深砖红）；深色背景 → 用暖米白或产品高光色。确保与背景有足够对比度，同时与整体色调视觉融合。
4. **视觉语言**：
   - 装饰元素：极简几何线条、自然植物阴影、环保/认证类图标等。
   - 图标风格：细线条极简风格，线性感强。
   - 留白原则：保持 30% 以上留白，营造高端呼吸感；文字与重要元素须留出安全边距，不得贴边或被裁切。
5. **摄影风格**：
   - 光线：自然柔和侧光/午后窗边光影/柔和投影，或影棚柔光。
   - 景深：中度景深，产品主体清晰，背景适度虚化。
   - 相机参数参考：如 f/4.0, 1/125s, ISO 100。
6. **品质要求**：
   - 分辨率：4K/高清。
   - 风格：专业家居产品摄影。
   - 真实感：超写实照片级，保留产品哑光/磨砂等材质质感。

**图片规划**（imagePlan）：每条包含 title 和 contentMarkdown。contentMarkdown 必须按以下结构逐项书写（换行用\\\\n），便于生图时严格执行构图与文字区域，避免文字被裁切或模糊。风格要对齐高端品牌详情图：分区清晰、留白充足、主标题单行、字体精致。

- **设计目标**：一句话说明该图要达成的效果（如建立品牌第一印象、消除稳固性顾虑、传达环保价值观）。
- **产品出现**：是 / 否。
- **图中图元素**：无；或具体描述如 [放大镜特写, 圆形, 右下角, 20%大小, 展示某细节]、[材质图标, 树叶形, 左上角, 10%大小, 环保认证]。
- **构图方案**（务必具体，便于生图直接执行）：
  - 产品占比与位置：如产品占画面 45%，位于右侧 1/3 或居中；或左侧 1/3，右侧留白。
  - 留白与分区：明确「产品区」与「文字区」分离；留白至少 25–35%，避免拥挤。例如：左侧 1/3 为标题区、右侧 2/3 为产品与背景；或上方 1/3 标题、下方 2/3 产品。
  - 文字区域：主标题仅一行，位置明确（如画面左侧中部、或顶部中央），并注明「整句完整在画面内，四边留足安全边距，不贴边、不裁切」。
- **内容要素**：展示重点、突出卖点（可带英文 slogan）、背景元素、装饰元素；如有备注（如保持磨砂质感、禁止抹除结构线）也写上。
- **文字内容**（注明「使用 英语」或目标语言）：只写主标题的具体文案（完整短句，便于生图使用）；副标题、说明文字不写，留空，由用户需要时在规划中自行填写，以控制图中文字占比。
- **氛围营造**：情绪关键词（如 时尚、宁静、高端、环保、坚固）；光影效果（如 柔和百叶窗投影、硬朗轮廓光、明亮自然阳光）。

用户组图要求：${requirements || '（未填写）'}

请输出恰好 ${planCount} 条图片规划，不要多也不要少。每条对应一张图，标题要有区分度（如品牌形象海报、功能卖点图、材质属性图等）。

你必须只输出一个 JSON 对象，不要其他解释。整个 JSON 必须是合法的一行或单块，字符串内换行用反斜杠 n（\\\\n）。格式：
{
  "designSpecMarkdown": "上述整体设计规范的完整 Markdown，换行用\\\\n",
  "imagePlan": [
    { "title": "图1标题", "contentMarkdown": "按上述结构写的该图完整规划，换行用\\\\n" }
  ]
}
imagePlan 数组长度必须为 ${planCount}。`

      const contents = [
        { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
        { text: prompt },
      ]
      const ai = new GoogleGenAI({ apiKey })
      let response
      let modelUsed = ANALYSIS_MODEL_ID
      const maxTries = 3
      let lastErr
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
          console.log('[后端 API] 使用 Gemini 分析中，模型:', modelUsed, attempt > 1 ? `(第 ${attempt} 次)` : '')
          response = await ai.models.generateContent({ model: modelUsed, contents })
          lastErr = null
          break
        } catch (err) {
          lastErr = err
          const is503 = err?.status === 503
          const cause = err?.cause || err
          const isTimeout = cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || /timeout|ETIMEDOUT/i.test(cause?.message || '')
          const isSocketClosed = cause?.code === 'UND_ERR_SOCKET' || /other side closed|fetch failed/i.test(err?.message || '')
          if (is503 && ANALYSIS_MODEL_FALLBACK && ANALYSIS_MODEL_FALLBACK !== ANALYSIS_MODEL_ID && attempt === 1) {
            console.log('[后端 API] 主模型 503，改用备用模型:', ANALYSIS_MODEL_FALLBACK)
            modelUsed = ANALYSIS_MODEL_FALLBACK
            continue
          }
          if ((isTimeout || isSocketClosed) && attempt < maxTries) {
            const delay = 2000 * attempt
            console.log('[后端 API] 连接异常，', delay, 'ms 后重试…')
            await new Promise((r) => setTimeout(r, delay))
            continue
          }
          throw err
        }
      }
      if (lastErr) throw lastErr
      const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
      if (text) {
        const out = extractAnalyzeJson(text, true)
        if (out && typeof out.designSpecMarkdown === 'string' && Array.isArray(out.imagePlan)) {
          const plan = out.imagePlan.slice(0, planCount).map((item) => ({
            title: item?.title || '未命名',
            contentMarkdown: (item?.contentMarkdown != null ? String(item.contentMarkdown) : '').replace(/\\n/g, '\n'),
          }))
          const specMarkdown = out.designSpecMarkdown.replace(/\\n/g, '\n')
          return res.json({
            designSpecMarkdown: specMarkdown,
            imagePlan: plan,
          })
        }
      }
      console.error('[后端 API] Gemini 返回格式异常，改用 mock，返回片段:', text?.slice(0, 200))
    } else {
      console.log('[后端 API] 未配置 GEMINI_API_KEY 或 key 为空，使用 mock 返回')
    }
    // 无 key 或 API 返回格式异常时回退 mock（结构与优质参考一致）
    const designSpecMarkdown = `所有图片必须遵循以下统一规范，确保视觉连贯性

## 色彩系统
- 主色调：珍珠白（#FFFFFF）- 产品主体，纯净与现代感
- 辅助色：浅灰/森林绿等 - 强调卖点与层次
- 背景色：极简浅灰（#F5F5F5）或自然光影室内场景

## 字体系统
- 标题字体：现代无衬线体（如 Montserrat Bold 或 Helvetica）
- 正文字体：轻量无衬线体（如 Open Sans 或 Arial）
- 字号层级：大标题:副标题:正文 = 3:1.8:1

## 视觉语言
- 装饰元素：极简几何线条、自然植物阴影、环保/认证图标
- 图标风格：细线条极简风格，线性感强
- 留白原则：保持 30% 以上留白；文字与重要元素留安全边距，不得贴边或裁切

## 摄影风格
- 光线：自然柔和侧光，模拟午后窗边光影，柔和投影
- 景深：中度景深，产品主体清晰，背景适度虚化
- 相机参数参考：f/4.0, 1/125s, ISO 100

## 品质要求
- 分辨率：4K/高清
- 风格：专业家居产品摄影
- 真实感：超写实照片级，保留产品哑光磨砂质感

${requirements ? `**用户要求摘要**：${requirements.slice(0, 200)}${requirements.length > 200 ? '...' : ''}` : ''}
`
    const mockPlans = [
      { title: '品牌形象海报', contentMarkdown: '**设计目标**：建立品牌时尚、高端的第一印象\n**产品出现**：是\n**图中图元素**：无\n**构图方案**：产品占比 45%；产品放置在画面右侧三分之一处，左侧留白用于排版；文字区域在画面左侧中部；所有文字须完整在画面内，留安全边距。\n**内容要素**：展示产品整体轮廓与纯净色调；突出卖点 Minimalist Design；背景为现代简约客厅、浅灰墙面、木质地板；装饰可为画面边缘一角绿植。\n**文字内容**（使用 英语）：主标题 Effortless Elegance。副标题：（留空，用户可自填）。说明文字：（留空，用户可自填）。\n**氛围营造**：情绪关键词 时尚、宁静、高端、纯净；光影效果 柔和百叶窗投影。' },
      { title: '功能卖点图', contentMarkdown: '**设计目标**：消除用户对稳固性的顾虑\n**产品出现**：是\n**图中图元素**：可加 [放大镜特写, 圆形, 右下角, 20%大小] 展示细节\n**构图方案**：产品占比 60%；低角度仰拍突出支撑感；文字区域在画面顶部中央；文字须完整在画面内。\n**内容要素**：展示凳腿与连接处、结构线条；突出卖点 Rock-Solid Stability；背景纯净浅灰影棚；可加半透明受力分析线条；保持产品磨砂质感。\n**文字内容**（使用 英语）：主标题 BUILT TO LAST。副标题：（留空，用户可自填）。说明文字：（留空，用户可自填）。\n**氛围营造**：安全、坚固、可靠；硬朗轮廓光。' },
      { title: '材质/环保图', contentMarkdown: '**设计目标**：传达环保、可持续价值观\n**产品出现**：是\n**图中图元素**：[材质/树叶图标, 左上角, 10%大小, 环保认证]\n**构图方案**：产品占比 50%；对角线构图；文字区域在右下角留白区；文字须完整在画面内。\n**内容要素**：展示材质细腻纹理；突出卖点 Eco-Friendly Material；背景为自然光户外或阳台、模糊绿植；装饰为嫩绿叶片、光斑。\n**文字内容**（使用 英语）：主标题 ECO-CONSCIOUS CHOICE。副标题：（留空，用户可自填）。说明文字：（留空，用户可自填）。\n**氛围营造**：环保、自然、清新；明亮自然阳光。' },
      { title: '细节图', contentMarkdown: '**设计目标**：展示工艺与质感\n**产品出现**：是\n**图中图元素**：无\n**构图方案**：产品占比约 50%；留白 30% 以上；文字区域明确且留边距。\n**内容要素**：局部特写、材质表现。\n**文字内容**（使用 英语）：主标题 Crafted for Detail。副标题：（留空）。说明文字：（留空）。\n**氛围营造**：清晰、专业。' },
      { title: '卖点总结图', contentMarkdown: '**设计目标**：理性说服、卖点汇总\n**产品出现**：是\n**构图方案**：留白充足；文字区域不贴边。\n**内容要素**：参数或卖点列表。\n**文字内容**（使用 英语）：主标题 Why Choose Us。副标题：（留空）。说明文字：（留空）。' },
    ]
    const imagePlan = mockPlans.slice(0, planCount)
    return res.json({ designSpecMarkdown, imagePlan })
  } catch (e) {
    console.error(e)
    const status = e.status || e.statusCode
    const cause = e.cause || e
    const isTimeout = cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || /timeout|ETIMEDOUT/i.test(cause?.message || '')
    const isSocketClosed = cause?.code === 'UND_ERR_SOCKET' || /other side closed/i.test(e.message || '')
    const isNetwork = /fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(e.message || '') || isTimeout || isSocketClosed
    const is503 = status === 503 || /high demand|503|UNAVAILABLE/i.test(e.message || '')
    let message = e.message || '分析失败，请稍后重试'
    if (is503) {
      message = 'Gemini 服务当前请求量较大，请稍后再试（或已自动尝试备用模型）'
    } else if (isSocketClosed) {
      message = '连接被中断。请重试；若仍失败可尝试重启代理或直连'
    } else if (isNetwork) {
      message = '连接超时或不可达，请确认代理已开启（.env 中 HTTPS_PROXY）或网络可访问 Google 后重试'
    }
    return res.status(is503 ? 503 : 500).json({ error: message })
  }
})

// 根据用户选择的目标语言，返回生图时图片内文字的硬性要求（避免乱码、错误语言）
function getLanguageRuleForImage(targetLanguage) {
  const t = (targetLanguage || '').trim()
  if (!t || t.startsWith('无文字')) {
    return 'CRITICAL: This image must contain NO text, NO captions, NO labels, NO annotations. Visual only. Do not render any words or characters in the image.'
  }
  if (t === '英语') {
    return 'CRITICAL - Text language: All text that appears in the image (titles, subtitles, labels, callouts, annotations) MUST be in English only. Use correct English spelling and grammar. Do NOT use Chinese characters or any other script. Do NOT generate garbled, nonsensical, or made-up words. If you include text, it must be readable, correct English.'
  }
  if (t.includes('中文')) {
    return 'CRITICAL - Text language: All text in the image must be in Chinese (correct characters, no garbled or nonsensical text). Use proper spelling and grammar.'
  }
  const langMap = {
    '日语': 'Japanese',
    '韩语': 'Korean',
    '德语': 'German',
    '法语': 'French',
    '阿拉伯语': 'Arabic',
    '俄语': 'Russian',
    '泰语': 'Thai',
    '印尼语': 'Indonesian',
    '越南语': 'Vietnamese',
    '马来语': 'Malay',
    '西班牙语': 'Spanish',
    '葡萄牙语': 'Portuguese',
    '巴西葡萄牙语': 'Brazilian Portuguese',
  }
  const enName = langMap[t] || 'English'
  return `CRITICAL - Text language: All text in the image must be in ${enName} only. Use correct spelling and grammar. Do NOT use Chinese characters unless the target is Chinese. Do NOT generate garbled or nonsensical text.`
}

// 尺寸比例文案 → Gemini imageConfig.aspectRatio（含 3.1 Flash 极竖/极横）
const ASPECT_RATIO_MAP = {
  '1:1 正方形': '1:1',
  '2:3 竖版': '2:3',
  '3:2 横版': '3:2',
  '3:4 竖版': '3:4',
  '4:3 横版': '4:3',
  '4:5 竖版': '4:5',
  '5:4 横版': '5:4',
  '9:16 手机竖屏': '9:16',
  '16:9 宽屏': '16:9',
  '21:9 超宽屏': '21:9',
  '1:4 极竖': '1:4',
  '1:8 极竖': '1:8',
  '4:1 极横': '4:1',
  '8:1 极横': '8:1',
}
// 清晰度文案 → Gemini imageConfig.imageSize（0.5K 仅 Nano Banana 2 支持）
const CLARITY_TO_SIZE = { '0.5K 快速': '512', '1K 标准': '1K', '2K 高清': '2K', '4K 超清': '4K' }

// 从图片 buffer 获取尺寸并推断 aspectRatio（保留原图比例）、clarity（保留原图清晰度）
const RATIO_VALUES = [
  ['1:1', 1], ['2:3', 2/3], ['3:2', 3/2], ['3:4', 3/4], ['4:3', 4/3],
  ['4:5', 4/5], ['5:4', 5/4], ['9:16', 9/16], ['16:9', 16/9], ['21:9', 21/9],
  ['1:4', 1/4], ['1:8', 1/8], ['4:1', 4], ['8:1', 8],
]
function getAspectRatioFromDimensions(width, height) {
  if (!width || !height) return '1:1'
  const r = width / height
  let best = RATIO_VALUES[0][0]
  let bestD = Math.abs(r - RATIO_VALUES[0][1])
  for (const [val, v] of RATIO_VALUES) {
    const d = Math.abs(r - v)
    if (d < bestD) { bestD = d; best = val }
  }
  return best
}
function getClarityFromDimensions(width, height) {
  const max = Math.max(width || 0, height || 0)
  if (max > 2048) return '4K 超清'
  if (max > 1024) return '2K 高清'
  return '1K 标准'
}

// 全品类组图：确认规划后生成图片（调用 Gemini 生图模型）
app.post('/api/detail-set/generate', async (req, res) => {
  try {
    const { designSpecMarkdown, imagePlan, model, clarity, aspectRatio, targetLanguage, image } = req.body
    if (!Array.isArray(imagePlan) || imagePlan.length === 0) {
      return res.status(400).json({ error: '请先完成分析并确认图片规划' })
    }
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      return res.status(503).json({ error: '未配置 GEMINI_API_KEY，无法生图' })
    }
    const { clarity: resolvedClarity } = normalizeClarityForModel(model || '', clarity || '1K 标准')
    const imageSize = CLARITY_TO_SIZE[resolvedClarity] || '1K'
    const aspectRatioVal = String(ASPECT_RATIO_MAP[aspectRatio] || '3:4')
    const modelId = getImageModelId(model || 'Nano Banana 2')
    const parsedRef = image ? parseDataUrl(image) : null
    console.log('[后端 API] 生图参数 前端 aspectRatio:', aspectRatio, '-> API:', aspectRatioVal, 'imageSize:', imageSize)

    const ai = new GoogleGenAI({ apiKey })
    const count = Math.min(imagePlan.length, 15)
    const images = []

    const langRule = getLanguageRuleForImage(targetLanguage)
    for (let i = 0; i < count; i++) {
      const item = imagePlan[i]
      const title = item?.title || `图${i + 1}`
      const aspectRule = `CRITICAL - Aspect ratio: The output image MUST have aspect ratio exactly ${aspectRatioVal}. For 1:1 this means a perfect square (width = height). For 3:4 or 4:3 etc. the image must match that ratio precisely. Do not produce a different aspect ratio.`

      const compositionRule = `CRITICAL - Composition and layout (high-end product ad style):
- Use clear visual zoning: reserve one area for the product (e.g. right 1/3 or center) and a separate area for the headline (e.g. left or top), with generous negative space between them. Do not crowd product and text together.
- Keep at least 25–35% of the frame as negative space (clean background, no clutter). This creates a premium, breathable look like high-end brand ads.
- Apply rule-of-thirds or centered balance: place the product on a strong focal position; place the single headline in a dedicated zone with ample padding (at least 8–12% from frame edges). No elements touching the edges.
- Avoid dense, busy layouts. Prefer minimal elements: product + one headline + subtle background. No extra slogans, subtitles, or decorative text.`

      const textQualityRule = `CRITICAL - Typography in image (premium brand level):
- Render the headline in a single line only. Use an elegant, modern sans-serif (geometric or humanist: clean letterforms, medium weight, not thin or heavy). Think Apple / premium magazine ad: refined, spacious, not system font.
- Letter-spacing: slightly wide (+8 to +15% tracking) for a luxury, airy feel. The phrase should feel like one calm, confident statement.
- Do NOT add a subtitle, tagline, or second line. Exactly one headline phrase. No cramped or cheap-looking type.`

      const colorHarmonyRule = `CRITICAL - Text color and visual harmony:
- The headline color MUST be chosen from the image's own palette to feel designed-in, not pasted on top.
  - Light/pastel/neutral background → use a deep, rich tone sampled from the product or scene (e.g. deep forest green, warm charcoal, dusty navy) — NOT generic pure black (#000000).
  - Dark/moody/saturated background → use a warm off-white, cream, or a light accent color that echoes the product highlights — NOT pure white (#FFFFFF).
  - If the product has a strong accent color (e.g. vibrant orange cap, gold label) → the headline can use that accent color at slightly reduced saturation for elegance.
- The result: text and image should feel like they were art-directed together, part of the same visual system — not text floating over a photo.
- Ensure sufficient readability contrast despite the harmonized color choice (minimum 3:1 contrast ratio against the local background behind the text).`

      const safeAreaRule = `CRITICAL - Text must be fully inside the frame: The entire headline (every letter and word) must be fully visible with wide margins (at least 8–12% from each edge). No clipping at left/right/top/bottom. No partial words at the edge. The full phrase sits well within the frame with padding on all sides.`

      const placementRule = `CRITICAL - Physically realistic product placement (non-negotiable):
- The product must be supported by a real, plausible surface: floor, ground, or furniture used as intended (e.g. a stool on the floor beside a sofa, a vase on a side table). No exceptions.
- FORBIDDEN: (1) Product floating or suspended in mid-air. (2) Product placed on an inappropriate surface (e.g. stool/chair on top of a table, desk, counter, or shelf—seating belongs on the floor; small objects may sit on tables only when that is their normal use). (3) Product balanced impossibly, hanging, or in any unnatural or gravity-defying position.
- The reference photo may show the product on a table or in a studio—use it only for the product’s appearance. In your image, place the product in a physically correct, realistic scene. When in doubt: put it on the floor or on a surface that matches how the product is actually used in real life.`

      const prompt = `You are an e-commerce detail image designer. Generate ONE product detail image according to the design spec and this image's plan. Output only the image, no text explanation. Aim for the visual quality of high-end brand product ads: clear composition, generous negative space, premium typography, and harmonious color.

${placementRule}

${aspectRule}

${compositionRule}

${textQualityRule}

${colorHarmonyRule}

${safeAreaRule}

${langRule}

Product placement (reminder): The product must sit on a realistic supporting surface (floor, ground, or appropriate furniture). No floating, no impossible balance, no placing items on wrong surfaces (e.g. no stool on a table). Reference image is for product look only. Mandatory.

Overall design spec:
${designSpecMarkdown || 'Simple, clear, product-focused.'}

This image plan - ${title}:
${item?.contentMarkdown || 'Highlight product, consistent style.'}

You must render at most ONE line of text (the main title only). No subtitle, no second line, no tagline. If the plan mentions 副标题 or 说明文字 as 留空 or empty, do not invent or add any such text.

Typography and color (reminder): The headline must feel art-directed — elegant sans-serif with wide tracking, and a color drawn from the image's own palette so text and image look like one unified design. Generate the image that meets all the above rules.`
      const contents = []
      if (parsedRef) {
        contents.push({ inlineData: { mimeType: parsedRef.mimeType, data: parsedRef.data } })
      }
      contents.push({ text: prompt })

      try {
        // 见 https://ai.google.dev/gemini-api/docs/image-generation#aspect_ratios_and_image_size
        // Gemini 2.5 Flash Image 仅支持 aspectRatio；3.1 Flash / 3 Pro 支持 aspectRatio + imageSize
        const is25Image = modelId === 'gemini-2.5-flash-image'
        const imageConfig = is25Image
          ? { aspectRatio: aspectRatioVal }
          : { aspectRatio: aspectRatioVal, imageSize: String(imageSize || '1K') }
        // Pro / Nano Banana 2 生成时间更长，且可能遇到 503 高负载，最多重试 3 次
        const isHeavyModel = modelId.includes('pro') || modelId.includes('3.1')
        const maxImageTries = isHeavyModel ? 3 : 2
        const retryLabel = isHeavyModel ? '(重型模型 最多重试3次)' : '(最多重试2次)'
        console.log('[后端 API] 生图中', i + 1, '/', count, '模型:', modelId, 'imageConfig:', JSON.stringify(imageConfig), retryLabel)
        let response
        let lastImageErr
        for (let t = 1; t <= maxImageTries; t++) {
          try {
            response = await ai.models.generateContent({
              model: modelId,
              contents,
              config: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig,
              },
            })
            lastImageErr = null
            break
          } catch (e) {
            lastImageErr = e
            const cause = e?.cause || e
            const is503 = e?.status === 503 || /high demand|503|UNAVAILABLE/i.test(e.message || '')
            const isNetworkErr = /fetch failed|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT|other side closed/i.test(e.message || '') || cause?.code?.startsWith('UND_ERR')
            if ((is503 || isNetworkErr) && t < maxImageTries) {
              const delay = is503 ? 8000 * t : 3000 * t
              console.log(`[后端 API] 生图第 ${t} 次失败（${is503 ? '503 高负载' : '网络抖动'}），${delay / 1000}s 后重试…`)
              await new Promise((r) => setTimeout(r, delay))
            } else {
              throw e
            }
          }
        }
        if (lastImageErr) throw lastImageErr
        const parts = response?.candidates?.[0]?.content?.parts || []
        const imagePart = parts.find((p) => p.inlineData?.data)
        if (imagePart?.inlineData?.data) {
          const { mimeType, data } = imagePart.inlineData
          images.push({
            id: `gen-${Date.now()}-${i}`,
            title,
            url: `data:${mimeType || 'image/png'};base64,${data}`,
          })
        } else {
          images.push({
            id: `gen-${Date.now()}-${i}`,
            title,
            url: null,
            error: '未返回图片',
          })
        }
      } catch (err) {
        const cause = err?.cause || err
        console.error('[后端 API] 生图单张失败', i,
          '| message:', err.message,
          '| status:', err.status ?? err.statusCode ?? '(无)',
          '| cause.code:', cause?.code ?? '(无)',
          '| cause.message:', cause?.message ?? '(无)'
        )
        let errMsg = err.message || '生成失败'
        if (err.status === 403 || /permission|forbidden|access denied/i.test(errMsg)) {
          errMsg = `模型 ${modelId} 无访问权限（403），该模型可能需要特殊白名单或付费计划`
        } else if (err.status === 404 || /not found/i.test(errMsg)) {
          errMsg = `模型 ${modelId} 不存在（404），请检查模型 ID 是否正确`
        } else if (/fetch failed|ECONNREFUSED|ENOTFOUND|UND_ERR/i.test(errMsg) || cause?.code?.startsWith('UND_ERR')) {
          errMsg = `网络连接失败（${cause?.code || 'fetch failed'}），请检查代理是否可访问该模型端点`
        }
        images.push({
          id: `gen-${Date.now()}-${i}`,
          title,
          url: null,
          error: errMsg,
        })
      }
    }

    const successCount = images.filter((img) => img.url).length
    if (successCount === 0) {
      return res.status(500).json({ error: images[0]?.error || '全部生图失败，请稍后重试' })
    }
    const auth = req.headers.authorization
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
    const pointsPerImage = getPointsPerImage(model || 'Nano Banana 2', resolvedClarity || '1K 标准')
    const totalPoints = pointsPerImage * successCount
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET)
        const email = payload.email
        if (totalPoints > 0) {
          const balance = getBalance(email)
          if (balance < totalPoints) {
            return res.status(402).json({
              error: '积分不足',
              required: totalPoints,
              balance,
            })
          }
          deductPoints(email, totalPoints, `全品类组图 - ${successCount} 张 (${model || 'Nano Banana 2'}, ${resolvedClarity || '1K 标准'})`)
        }
        const toReturn = images.filter((img) => img.url)
        toReturn.forEach((img) => {
          try {
            saveImageToGallery(email, img.id, img.title, img.url, pointsPerImage, model || null, resolvedClarity || null)
          } catch (e) {
            console.error('[后端 API] 自动保存到仓库失败', img.id, e.message)
          }
        })
      } catch (err) {
        if (err.message === '积分不足') throw err
      }
    }
    return res.json({ images: images.map(({ id, title, url }) => ({ id, title, url: url || '' })).filter((img) => img.url) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || '生成失败，请稍后重试' })
  }
})

// 获取当前用户（校验 token）+ 积分余额 + 角色
app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: '未登录' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const dbUser = dbFindUser(payload.email)
    const balance = getBalance(payload.email)
    return res.json({ user: { email: payload.email, role: dbUser?.role ?? 'user', pointsBalance: balance } })
  } catch {
    return res.status(401).json({ error: '登录已过期' })
  }
})

// 积分：余额
app.get('/api/points/balance', requireAuth, (req, res) => {
  try {
    const balance = getBalance(req.user.email)
    return res.json({ balance })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '获取积分失败' })
  }
})

// 积分充值仅限管理员，见 /api/admin/users/:email/grant

// 积分：扣取明细
app.get('/api/points/transactions', requireAuth, (req, res) => {
  try {
    const list = getTransactions(req.user.email)
    return res.json({ items: list })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '获取明细失败' })
  }
})

// ---------- 仓库（数据库/文件存储）----------
// 需要登录的中间件
function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: '请先登录后再使用' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const dbUser = dbFindUser(payload.email)
    req.user = { email: payload.email, role: dbUser?.role ?? 'user' }
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限，需要管理员账号' })
    next()
  })
}

const galleryRoot = join(__dirname, 'gallery')

function userGalleryDir(email) {
  const hash = createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 16)
  return join(galleryRoot, hash)
}

/** 相对路径，用于存入数据库（便于迁移），读取时 join(__dirname, file_path) */
function galleryFilePath(email, id, ext) {
  const hash = createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 16)
  return join('gallery', hash, `${id}.${ext}`)
}

/** 将一张图片写入仓库（文件 + 数据库），可选上传 COS；pointsUsed/model/clarity 可选。
 * 调用方 await 时：列表下次请求可立即带 COS 地址（仅 POST /api/gallery 如此）。
 * 调用方不 await（电商生图/修改图片/风格复刻/A+/Listing 等）：先写本地+入库，COS 异步上传，用户进仓库立即可见图（相对路径），过一会儿刷新可见 COS URL。详见 docs/COS-CDN.md */
async function saveImageToGallery(email, id, title, dataUrl, pointsUsed = null, model = null, clarity = null) {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !parsed.data) return
  const dir = userGalleryDir(email)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const ext = (parsed.mimeType || '').includes('png') ? 'png' : 'jpg'
  const fullPath = join(dir, `${id}.${ext}`)
  const buf = Buffer.from(parsed.data, 'base64')
  writeFileSync(fullPath, buf)
  const filePath = galleryFilePath(email, id, ext)
  const savedAt = Date.now()
  getDb().prepare('INSERT INTO gallery (id, user_email, title, file_path, saved_at, points_used, model, clarity, cos_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, email, title || '未命名', filePath, savedAt, pointsUsed != null ? pointsUsed : null, model || null, clarity || null, null)
  if (isCosEnabled()) {
    const Key = filePath
    const ContentType = ext === 'png' ? 'image/png' : 'image/jpeg'
    try {
      await uploadToCos(Key, buf, ContentType)
      getDb().prepare('UPDATE gallery SET cos_key = ? WHERE id = ? AND user_email = ?').run(Key, id, email)
    } catch (e) {
      console.error('[COS] 上传仓库图片失败', id, e.message)
    }
  }
}

// 保存图片到仓库：dataUrl 转为文件，元数据写入 SQLite，并等待 COS 上传完成以便列表立即带 COS 地址
app.post('/api/gallery', requireAuth, async (req, res) => {
  try {
    const { image: dataUrl, title } = req.body || {}
    const parsed = parseDataUrl(dataUrl)
    if (!parsed || !parsed.data) {
      return res.status(400).json({ error: '请提供有效的图片数据' })
    }
    const email = req.user.email
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    await saveImageToGallery(email, id, title || '未命名', dataUrl)
    return res.json({ id })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '保存失败' })
  }
})

// 拉取当前用户的仓库列表（有 cos_key 则返回 COS 临时签名 URL，否则返回相对路径）
app.get('/api/gallery', requireAuth, async (req, res) => {
  try {
    const email = req.user.email
    const rows = getDb().prepare('SELECT id, title, saved_at AS savedAt, points_used AS pointsUsed, model, clarity, cos_key AS cosKey FROM gallery WHERE user_email = ? ORDER BY saved_at DESC').all(email)
    const list = await Promise.all(rows.map(async (row) => {
      let url = `/api/gallery/image/${row.id}`
      if (row.cosKey && isCosEnabled()) {
        try {
          const signed = await getCosSignedUrl(row.cosKey, 3600)
          if (signed) url = signed
        } catch (_) {}
      }
      return {
        id: row.id,
        title: row.title,
        url,
        savedAt: row.savedAt,
        pointsUsed: row.pointsUsed != null ? row.pointsUsed : undefined,
        model: row.model != null && String(row.model).trim() ? String(row.model).trim() : undefined,
        clarity: row.clarity != null && String(row.clarity).trim() ? String(row.clarity).trim() : undefined,
      }
    }))
    return res.json({ items: list })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '获取仓库失败' })
  }
})

// 获取单张图片（需登录且只能看自己的，从数据库查 file_path 再读文件）
app.get('/api/gallery/image/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params
    const email = req.user.email
    const row = getDb().prepare('SELECT file_path FROM gallery WHERE id = ? AND user_email = ?').get(id, email)
    if (!row) return res.status(404).json({ error: '图片不存在' })
    const fullPath = join(__dirname, row.file_path)
    if (!existsSync(fullPath)) return res.status(404).json({ error: '文件不存在' })
    const buf = readFileSync(fullPath)
    const mime = fullPath.endsWith('.png') ? 'image/png' : 'image/jpeg'
    res.setHeader('Content-Type', mime)
    return res.send(buf)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '获取图片失败' })
  }
})

// 从仓库删除一张（删数据库记录 + 删本地文件 + 若有 cos_key 则删 COS 对象）
app.delete('/api/gallery/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params
    const email = req.user.email
    const row = getDb().prepare('SELECT file_path, cos_key FROM gallery WHERE id = ? AND user_email = ?').get(id, email)
    if (!row) return res.status(404).json({ error: '图片不存在' })
    const fullPath = join(__dirname, row.file_path)
    if (existsSync(fullPath)) unlinkSync(fullPath)
    if (row.cos_key && isCosEnabled()) {
      deleteFromCos(row.cos_key).catch((e) => console.error('[COS] 删除对象失败', row.cos_key, e.message))
    }
    getDb().prepare('DELETE FROM gallery WHERE id = ? AND user_email = ?').run(id, email)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '删除失败' })
  }
})

// ---------- 图片文字提取（OCR，供文字替换模式框选用） ----------
app.post('/api/image-edit/extract-text', async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { image } = req.body || {}
    const parsed = parseDataUrl(image)
    if (!parsed) return res.status(400).json({ error: '图片格式无效，请重新上传' })

    const ai = new GoogleGenAI({ apiKey })
    const contents = [
      { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
      {
        text:
          'Extract all text visible in this image. Return ONLY the raw text, nothing else. ' +
          'Preserve line breaks. If no text is found, return an empty string.',
      },
    ]
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL_ID,
      contents,
    })
    const text =
      response?.text ??
      (response?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join('') || '')
    const trimmed = String(text || '').trim()
    return res.json({ text: trimmed })
  } catch (e) {
    console.error('[后端 API] 图片文字提取失败', e.message)
    const cause = e?.cause || e
    const msg = /503|UNAVAILABLE/i.test(e?.message || '')
      ? '服务暂时繁忙，请稍后重试'
      : e?.message || '文字提取失败'
    return res.status(500).json({ error: msg })
  }
})

// ---------- 修改图片（7种模式） ----------
app.post('/api/image-edit', async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { mode, prompt, images, model: modelName, aspectRatio, clarity, targetColor, colorName, textDescription, expansionRatio, materialPrompt, surface, targetWeight, targetHeight, productName, sceneDescription, styleDescription } = req.body
    // recolor / smart-expansion / product-refinement 用内置 prompt，其他模式需要 prompt
    const isRecolor = mode === 'recolor'
    const isSmartExpansion = mode === 'smart-expansion'
    const isProductRefinement = mode === 'product-refinement'
    const isClothing3D = mode === 'clothing-3d'
    const isClothingFlatlay = mode === 'clothing-flatlay'
    const isBodyShape = mode === 'body-shape'
    const isSceneGeneration = mode === 'scene-generation'
    const isWatermarkRemove = mode === 'watermark-remove'
    if (!isRecolor && !isSmartExpansion && !isProductRefinement && !isClothing3D && !isClothingFlatlay && !isBodyShape && !isSceneGeneration && !isWatermarkRemove && (!prompt || !prompt.trim())) return res.status(400).json({ error: '请填写修改指令' })
    if (isSceneGeneration && (!productName || typeof productName !== 'string' || !productName.trim())) return res.status(400).json({ error: '请输入产品名称' })
    if (isSceneGeneration && (!sceneDescription || typeof sceneDescription !== 'string' || !sceneDescription.trim())) return res.status(400).json({ error: '请描述场景' })
    if (isRecolor && (!targetColor || typeof targetColor !== 'string')) return res.status(400).json({ error: '请选择目标颜色' })
    if (isRecolor && (!textDescription || typeof textDescription !== 'string' || !textDescription.trim())) return res.status(400).json({ error: '请描述要换色的物体' })
    if (isSmartExpansion && (!expansionRatio || ![1.1, 1.2, 1.5, 2].includes(Number(expansionRatio)))) return res.status(400).json({ error: '请选择扩图比例' })
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请上传至少一张图片' })

    // 解析所有参考图
    const parsedImages = images.map((img) => parseDataUrl(img)).filter(Boolean)
    if (parsedImages.length === 0) return res.status(400).json({ error: '图片格式无效，请重新上传' })

    // 若前端传入输出设置（model + aspectRatio + clarity），则统一使用请求参数；否则对「保留原图」类模式从输入图推断
    const preserveFromInputModes = mode === 'inpainting' || mode === 'add-remove' || mode === 'recolor' || mode === 'smart-expansion' || mode === 'product-refinement' || mode === 'clothing-3d' || mode === 'clothing-flatlay' || mode === 'body-shape' || mode === 'scene-generation' || mode === 'watermark-remove'
    const useRequestOutput = typeof aspectRatio === 'string' && aspectRatio.trim() && typeof clarity === 'string' && clarity.trim()
    let aspectRatioVal, resolvedClarity, modelId, imageSizeVal
    if (useRequestOutput) {
      modelId = getImageModelId(modelName || 'Nano Banana 2')
      const { clarity: c } = normalizeClarityForModel(modelName || 'Nano Banana 2', clarity || '1K 标准')
      resolvedClarity = c
      imageSizeVal = CLARITY_TO_SIZE[resolvedClarity] || '1K'
      aspectRatioVal = String(ASPECT_RATIO_MAP[aspectRatio] || '1:1')
    } else if (preserveFromInputModes) {
      try {
        const buf = Buffer.from(parsedImages[0].data, 'base64')
        const dim = imageSize(buf)
        let w = dim?.width || 0, h = dim?.height || 0
        aspectRatioVal = getAspectRatioFromDimensions(w, h)
        if (isSmartExpansion) {
          const ratio = Number(expansionRatio) || 1.5
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
          resolvedClarity = getClarityFromDimensions(w, h)
          if (ratio >= 1.5 && resolvedClarity === '1K 标准') resolvedClarity = '2K 高清'
        } else {
          resolvedClarity = getClarityFromDimensions(w, h)
        }
        const productRefinementModel = (modelName === 'Nano Banana Pro' || modelName === 'Nano Banana 2') ? modelName : 'Nano Banana Pro'
        modelId = isProductRefinement
          ? getImageModelId(productRefinementModel)
          : (isSmartExpansion || isClothing3D || isClothingFlatlay || isBodyShape || isSceneGeneration || isWatermarkRemove || Math.max(w, h) > 1024) ? getImageModelId('Nano Banana 2') : getImageModelId('Nano Banana')
      } catch (e) {
        aspectRatioVal = '1:1'
        resolvedClarity = '1K 标准'
        const productRefinementModel = (modelName === 'Nano Banana Pro' || modelName === 'Nano Banana 2') ? modelName : 'Nano Banana Pro'
        modelId = isProductRefinement ? getImageModelId(productRefinementModel) : ((isSmartExpansion || isClothing3D || isClothingFlatlay || isBodyShape || isSceneGeneration || isWatermarkRemove) ? getImageModelId('Nano Banana 2') : getImageModelId('Nano Banana'))
      }
      imageSizeVal = CLARITY_TO_SIZE[resolvedClarity] || '1K'
    } else {
      modelId = getImageModelId(modelName || 'Nano Banana 2')
      const { clarity: c } = normalizeClarityForModel(modelName || 'Nano Banana 2', clarity || '1K 标准')
      resolvedClarity = c
      imageSizeVal = CLARITY_TO_SIZE[resolvedClarity] || '1K'
      aspectRatioVal = String(ASPECT_RATIO_MAP[aspectRatio] || '1:1')
    }
    const is25Image = modelId === 'gemini-2.5-flash-image'
    const imageConfig = is25Image
      ? { aspectRatio: aspectRatioVal }
      : { aspectRatio: aspectRatioVal, imageSize: String(imageSizeVal) }
    const modelDisplayName = useRequestOutput ? (modelName || 'Nano Banana 2') : (preserveFromInputModes ? (modelId.includes('pro') ? 'Nano Banana Pro' : modelId.includes('3.1') ? 'Nano Banana 2' : 'Nano Banana') : (modelName || 'Nano Banana 2'))

    console.log('[后端 API] 修改图片 mode:', mode, '模型:', modelId, useRequestOutput ? '(使用前端输出设置)' : preserveFromInputModes ? '(保留原图比例/清晰度)' : '', 'imageConfig:', JSON.stringify(imageConfig))

    const ai = new GoogleGenAI({ apiKey })
    const isHeavy = modelId.includes('pro') || modelId.includes('3.1')
    const maxTries = isHeavy ? 3 : 2
    const genConfig = { responseModalities: ['TEXT', 'IMAGE'], imageConfig }

    // 所有模式统一使用单次 generateContent：图片 + 指令一并发送
    // 多轮 chat 方案因 Nano Banana 2 的 thought_signature 机制报 400，已放弃
    const desc = (textDescription || '').trim()
    const colorLabel = (colorName || 'custom').trim()
    const ratio = Number(expansionRatio) || 1.5
    const pct = Math.round((ratio - 1) * 100)

    // 扩图两轮调用：第一步用 Gemini 分析原图提取关键词，第二步注入模板生图
    let expansionPrompt
    if (isSmartExpansion) {
      let keywords = ''
      try {
        const recognitionQuery = 'Identify the main subject, the specific background elements, and the lighting style of this image. Answer in 5-10 keywords only, comma-separated. No sentences.'
        const analysisResp = await ai.models.generateContent({
          model: ANALYSIS_MODEL_ID,
          contents: [
            { inlineData: { mimeType: parsedImages[0].mimeType, data: parsedImages[0].data } },
            { text: recognitionQuery },
          ],
        })
        const text = analysisResp?.text ?? (analysisResp?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
        keywords = String(text || '').trim().replace(/\n+/g, ', ').slice(0, 300)
        if (keywords) {
          console.log('[后端 API] 扩图视觉分析关键词:', keywords)
        }
      } catch (e) {
        console.log('[后端 API] 扩图视觉分析失败，使用通用 prompt:', e.message)
      }
      const contentBlock = keywords
        ? `[CONTENT TO ADD] Extend the following elements: ${keywords}. Continue naturally beyond the edges. If the subject is cropped (e.g. shoulders, limbs), complete the person's body and clothing. If background has bokeh, maintain shallow depth of field in extended areas.`
        : `[CONTENT TO ADD] Fill the expanded area with coherent content that matches the foreground subject. If the subject is cropped (e.g. shoulders, limbs), complete the person's body and clothing naturally. If the background has shallow depth of field or bokeh, maintain that blur effect in the extended areas.`
      expansionPrompt = `[TASK] Outpaint and extend the boundaries of the image seamlessly. The image you see is the CENTER of a larger canvas. You MUST output a visibly LARGER image — add approximately ${pct}% more content on EACH side (top, bottom, left, right).

${contentBlock}

[STYLE CONSISTENCY] Strictly maintain the original artistic style, lighting direction, color palette, and lens characteristics.

[QUALITY CONTROL] Seamless transition, consistent lighting, matching textures, high resolution, no visible seams. Photorealistic. No text or logos. Same aspect ratio.`
    }
    // 提升质感：官方系统指令，NB2 侧重清晰度 / NB Pro 侧重物理质感
    const productRefinementModel = (modelName === 'Nano Banana Pro' || modelName === 'Nano Banana 2') ? modelName : 'Nano Banana Pro'
    const refinementPromptNB2 = `You are an efficient image clarity enhancement expert. Your task is to transform this blurry or low-quality image into a clear, bright, modern photographic work.

CORE LOGIC:
1. Sharpen edges: Eliminate blurriness, enhance object contour definition.
2. Color optimization: Increase dynamic range — deeper shadows, more transparent highlights.
3. Noise reduction: Remove noise and speckles while preserving necessary texture.
4. Style guidance: Lean toward clean commercial photography; make objects look brand new.

OUTPUT: High saturation, high contrast. CRITICAL: Keep the EXACT same background, framing, composition, and proportion as the input — do NOT change background, crop, or product size/position. Only enhance the subject's texture. No text or logos. Photorealistic.`

    const refinementPromptNBPro = `You are a top industrial photographer and physical material simulation master. Your task is to deeply reshape the physical texture of this image, making objects look tangible.

CORE LOGIC:
1. Micro-texture (tactile realism): Generate microscopic details — metal grains, fiber strands, subtle texture — that match the specified or inferred material.
2. Physical lighting: Simulate complex global illumination, rim light, subsurface scattering; enhance volume and weight.
3. Surface state: When user specifies a material, the surface must be CLEAN and factory-fresh — NO rust, NO grime, NO dust, NO wear, NO fingerprints. Remove any existing dirt or aging from the input image. If no material is specified, you may add subtle wear only for materials that typically show patina (e.g. leather).
4. Depth control: Apply professional shallow depth of field; perfect separation of subject from background.

OUTPUT: Ultra-high detail, extreme realism, withstands 4K magnification. CRITICAL: Keep the EXACT same background, framing, composition, and proportion as the input — do NOT change background, crop, zoom, or product size/position. Only reshape the subject's surface texture. No text or logos. Photorealistic.`

    let refinementPrompt = productRefinementModel === 'Nano Banana Pro' ? refinementPromptNBPro : refinementPromptNB2
    const userMaterial = typeof materialPrompt === 'string' ? materialPrompt.trim() : ''
    if (userMaterial) {
      const isPlastic = /\b(plastic|resin|acrylic|matte\s+satin|translucent\s+frosted|high-gloss\s+polished)\b/i.test(userMaterial)
      const plasticBoost = isPlastic
        ? ' CRITICAL for plastic realism: emphasize Subsurface Scattering (SSS), Soft-touch tactile texture, and Beveled edges.'
        : ''
      const materialTransform = `CRITICAL: The subject MUST appear as clean, premium ${userMaterial}. REPLACE the current surface entirely — remove any rust, dirt, grime, wear, or aging from the input. The result must look like a factory-new product with pristine ${userMaterial} finish.`
      refinementPrompt = `${refinementPrompt} ${materialTransform}${plasticBoost} Apply macro-photography style and material-appropriate lighting. Ensure the texture matches ${userMaterial} seamlessly. CRITICAL: Do NOT alter the background or framing — preserve the input's exact composition, crop, and proportion.`
    }
    const clothing3DPrompt = `You are a top e-commerce fashion product photographer. Transform this flat-lay garment image into a realistic 3D clothing product photo.

[DESIGN PRESERVATION — HIGHEST PRIORITY]
Strictly preserve the garment's EXACT original design: colors, prints, patterns, stripes, logos, graphics, text, embroidery, stitching details. Nothing may be altered, simplified, or omitted. Warp these elements naturally to follow the 3D body contours.

[3D FORM]
Make the garment look as if worn on an invisible person (ghost mannequin effect):
- Shoulders must show realistic rounded contours with natural volume
- Chest/torso must display three-dimensional depth and body shape
- Sleeves must be round, open, and naturally inflated — NOT flat or pressed
- Collar/neckline must hold its natural shape as if on a real neck
- The garment should NOT look flat or laid out — it must have clear volume and weight
- Match the SAME viewing angle as the input image (typically front view)

[FABRIC REALISM]
Add natural, subtle fabric behavior matching the material type:
- Soft fabrics (cotton, jersey): gentle draping, small natural creases at fold points
- Stiff fabrics (denim, canvas): structured form with minimal creasing
- Knit fabrics: visible stretch texture following the body shape
- Do NOT over-wrinkle; keep it clean and commercial

[LIGHTING & SHADOW]
Professional e-commerce studio lighting:
- Soft, even main light from slightly above
- Gentle fill light to reduce harsh shadows
- Subtle rim/edge light to separate garment from background and enhance 3D depth
- Natural shadow underneath and at fold areas to reinforce volume

[BACKGROUND]
Clean, pure light gray background (#F0F0F0 to #E8E8E8). No gradients, no patterns, no floor reflections.${prompt ? `

[ADDITIONAL INSTRUCTIONS]
${prompt.trim()}` : ''}

[OUTPUT]
Photorealistic, commercial-quality e-commerce product photo. No visible mannequin, body, or skin. No added text, watermarks, or logos. The garment floats in perfect 3D form.`

    const surfaceLabel = typeof surface === 'string' ? surface.trim() : ''
    const clothingFlatlayPrompt = `You are a professional fashion flat-lay photographer specializing in Knolling-style product photography.

[TASK]
Lay this garment flat on ${surfaceLabel || 'a clean wooden table'} and create a premium flat-lay (top-down / bird's-eye view) product photo with carefully arranged accessories.

[GARMENT PRESERVATION — HIGHEST PRIORITY]
- Strictly preserve the garment's EXACT original design: colors, prints, patterns, stripes, logos, graphics, text, embroidery, buttons, zippers — NOTHING may be altered, simplified, or omitted
- Keep the garment's original laying orientation and shape — do NOT rotate, flip, or reshape it
- The garment must be neatly spread out flat, centered in the frame, with no bunching or excessive wrinkling

[SURFACE & BACKGROUND]
- Surface: ${surfaceLabel || 'natural wooden table'}
- The surface must look realistic with authentic texture (wood grain, fabric weave, marble veining, etc.)
- The garment rests naturally on this surface — show realistic contact shadows
- Create a cozy, minimal, premium atmosphere

[ACCESSORIES — KNOLLING STYLE]
- Place a small number of complementary accessories around the garment (3-5 items max)
- Choose accessories that match the garment's style: e.g. sunglasses, watch, wallet, jewelry, shoes, hat, bag, perfume bottle, phone, coffee cup, plant sprig, book
- KNOLLING RULES: each item placed at clean parallel/perpendicular angles, evenly spaced, maintaining clear distance from the garment
- Each accessory type appears ONLY ONCE — no duplicates
- Accessories should complement, not overpower — the garment remains the clear hero

[PHOTOGRAPHY]
- Camera angle: perfectly top-down (flat lay / bird's-eye view), 90° overhead
- No perspective distortion — everything should appear flat and parallel to the camera sensor
- Even, soft, diffused lighting — NO harsh shadows, NO dramatic lighting effects
- High-end commercial quality, clean and minimal composition${prompt ? `

[ADDITIONAL INSTRUCTIONS]
${prompt.trim()}` : ''}

[OUTPUT]
Photorealistic, editorial-quality flat-lay photo. Premium feel, comfortable and minimal aesthetic. No text, watermarks, or logos added. No hands or body parts visible.`

    const weightKg = Number(targetWeight) || 0
    const heightCm = Number(targetHeight) || 170
    const bmi = weightKg > 0 ? (weightKg / ((heightCm / 100) ** 2)).toFixed(1) : 0
    let bodyDesc = ''
    if (weightKg > 0) {
      if (bmi < 18.5) bodyDesc = `VERY SLIM body — ${weightKg}kg/${heightCm}cm (BMI ${bmi}). Make the person visibly thin: narrow shoulders, slender arms, thin legs, flat stomach, slim waist, angular jawline, visible collarbones.`
      else if (bmi < 22) bodyDesc = `SLIM ATHLETIC body — ${weightKg}kg/${heightCm}cm (BMI ${bmi}). Lean and toned: moderate shoulders, slim arms, defined waist, slim legs, slightly angular face.`
      else if (bmi < 25) bodyDesc = `AVERAGE body — ${weightKg}kg/${heightCm}cm (BMI ${bmi}). Normal healthy build: proportionate shoulders, normal arm thickness, moderate waist, oval face.`
      else if (bmi < 28) bodyDesc = `CURVY/SLIGHTLY OVERWEIGHT body — ${weightKg}kg/${heightCm}cm (BMI ${bmi}). Noticeably wider: broader shoulders and hips, thicker arms, soft belly, fuller thighs, rounder face with softer jawline.`
      else if (bmi < 33) bodyDesc = `PLUS-SIZE/OVERWEIGHT body — ${weightKg}kg/${heightCm}cm (BMI ${bmi}). Significantly wider body: wide shoulders and hips, thick upper arms, prominent belly and midsection, thick thighs, round full face, possible double chin.`
      else bodyDesc = `OBESE/VERY HEAVY body — ${weightKg}kg/${heightCm}cm (BMI ${bmi}). Very large body: very wide frame, very thick arms and legs, large protruding belly, wide hips, very round face with double chin, skin folds at elbows and neck.`
    }
    const bodyShapePrompt = `Edit this photo. Make the person's body ${bodyDesc}

ABSOLUTE RULES — NEVER BREAK THESE:
1. THE CLOTHING MUST BE 100% IDENTICAL. Same exact dress/shirt/pants, same exact color, same exact pattern, same exact print, same exact fabric. Do NOT change, replace, or redesign the clothing in ANY way. This is the #1 most important rule.
2. The body MUST visibly change to match the target weight. If the target is heavy, the person must look significantly larger. If the target is slim, the person must look significantly thinner. The change must be OBVIOUS, not subtle.
3. Keep the exact same background, location, lighting, and atmosphere.
4. Keep the exact same pose and camera angle.
5. Keep the same face identity, hairstyle, hair color, and skin tone. Only adjust face fullness to match the body weight.
6. Keep the same shoes, accessories, and props.${prompt ? `\n7. ${prompt.trim()}` : ''}

The result must look like a real photograph. No distortion artifacts.`

    const sceneProductName = (productName || '').trim()
    const sceneDesc = (sceneDescription || '').trim()
    const sceneStyle = (styleDescription || '').trim()
    const sceneGenerationPrompt = `You are a world-class commercial photographer specializing in e-commerce lifestyle imagery.

[TASK]
Place the provided product (${sceneProductName}) into a realistic scene: ${sceneDesc}.

[PRODUCT PRESERVATION — HIGHEST PRIORITY]
- The product must remain EXACTLY as it appears in the input image: same shape, same color, same texture, same proportions, same design details, same logos or prints
- Do NOT modify, simplify, redesign, or stylize the product in ANY way
- The product must be naturally and logically integrated into the scene (correct scale, perspective, contact shadows, reflections)

[SCENE CONSTRUCTION]
- Build the scene around the product so it looks like the product was photographed IN that environment
- Ensure correct spatial relationships: the product must rest on or interact with surfaces naturally (a chair must sit on a floor, a cup must rest on a table, etc.)
- Add contextual elements and props that enhance the scene (furniture, decor, people interacting with the product, etc.)
- If people are included, they must interact with the product naturally and realistically
- Lighting must be physically consistent: shadows, reflections, and highlights should match across the entire scene

[STYLE & ATMOSPHERE]
${sceneStyle ? `The overall visual style and mood: ${sceneStyle}.` : 'Create a warm, inviting, and commercially appealing atmosphere.'}
The image should be suitable for cross-border e-commerce product marketing — aspirational yet authentic.

[TECHNICAL QUALITY]
- Photorealistic output, indistinguishable from a real photograph
- Professional commercial photography quality with balanced composition
- Natural depth of field appropriate for the scene
- No text, watermarks, or logos added to the image
- No artifacts, distortions, or uncanny valley effects`

    const watermarkRemovePrompt = `You are an expert at image inpainting and content-aware fill. The user has provided this image for editing and requests that overlay elements be removed.

[TASK]
Restore the image by inpainting over any visible overlay elements: text, logos, stamps, or semi-transparent regions that obscure the underlying photo. Treat this as a restoration task: fill those areas so they match the surrounding background, texture, and lighting seamlessly. The output should look like a single, coherent photograph with no visible overlays or patches.

[RULES]
1. Identify regions that clearly look like added overlays (repeating text, corner logos, stamps, translucent branding).
2. Inpaint those regions only: use the surrounding pixels to guide natural, photorealistic fill. Match texture, color, and lighting.
3. Leave the rest of the image unchanged: same composition, subject, and style.
4. Output must be photorealistic with no visible seams or artifacts. Preserve the exact aspect ratio and resolution of the input.`

    const finalPrompt = isRecolor
      ? `Recolor the ${desc} in this image to ${targetColor.trim()} (${colorLabel}). CRITICAL: Keep the exact same shape, structure, texture, and material of the ${desc} — ONLY change its color. The rest of the image must stay completely unchanged. Output a photorealistic result. Do not add any text or logos.`
      : isSmartExpansion
      ? expansionPrompt
      : isProductRefinement
      ? refinementPrompt
      : isClothing3D
      ? clothing3DPrompt
      : isClothingFlatlay
      ? clothingFlatlayPrompt
      : isBodyShape
      ? bodyShapePrompt
      : isSceneGeneration
      ? sceneGenerationPrompt
      : isWatermarkRemove
      ? watermarkRemovePrompt
      : prompt.trim()
    const contents = [
      ...parsedImages.map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.data } })),
      { text: finalPrompt },
    ]

    let response, lastErr
    for (let t = 1; t <= maxTries; t++) {
      try {
        response = await ai.models.generateContent({
          model: modelId,
          contents,
          config: genConfig,
        })
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        const cause = e?.cause || e
        const is503 = e?.status === 503 || /high demand|503|UNAVAILABLE/i.test(e.message || '')
        const isNet = /fetch failed|UND_ERR/i.test(e.message || '') || cause?.code?.startsWith('UND_ERR')
        if ((is503 || isNet) && t < maxTries) {
          const delay = is503 ? 8000 * t : 3000 * t
          console.log(`[后端 API] 修改图片第 ${t} 次失败，${delay / 1000}s 后重试…`)
          await new Promise((r) => setTimeout(r, delay))
        } else throw e
      }
    }
    if (lastErr) throw lastErr

    const parts = response?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p) => p.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text)
      return res.status(500).json({ error: textPart?.text || '模型未返回图片，请调整指令后重试' })
    }
    const { mimeType, data } = imagePart.inlineData
    const resultDataUrl = `data:${mimeType || 'image/png'};base64,${data}`

    // 积分扣减 + 自动存图库（登录用户）
    const auth = req.headers.authorization
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
    const pointsUsed = getPointsPerImage(modelDisplayName, resolvedClarity || '1K 标准')
    let newBalance = null
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET)
        const email = payload.email
        const balance = getBalance(email)
        if (balance < pointsUsed) {
          return res.status(402).json({ error: '积分不足', required: pointsUsed, balance })
        }
        deductPoints(email, pointsUsed, `修改图片 (${modelDisplayName}, ${resolvedClarity || '1K 标准'}, ${mode})`)
        newBalance = getBalance(email)
        const imgId = `edit-${Date.now()}`
        const modeLabel = {
          'add-remove': '添加/移除元素', inpainting: '局部重绘', recolor: '一键换色',
          'smart-expansion': '智能扩图', 'product-refinement': '提升质感',
          'style-transfer': '风格迁移', composition: '高级合成', 'hi-fidelity': '高保真细节',
          'bring-to-life': '让草图变生动', 'character-360': '角色一致性',
          'text-replace': '文字替换', 'text-translate': '文字翻译', 'scene-generation': '生成场景',
          'watermark-remove': '去除水印',
        }[mode] || mode
        try {
          saveImageToGallery(email, imgId, `修改图片·${modeLabel}`, resultDataUrl, pointsUsed, modelDisplayName || null, resolvedClarity || null)
        } catch (e) {
          console.error('[后端 API] 修改图片存图库失败', e.message)
        }
      } catch (e) {
        if (e.message === '积分不足') throw e
        // token 验证失败（未登录）静默忽略，不存图库也不扣积分
      }
    }

    return res.json({ image: resultDataUrl, pointsUsed: token ? pointsUsed : null, newBalance })
  } catch (e) {
    console.error('[后端 API] 修改图片失败', e.message)
    const cause = e?.cause || e
    let msg = e.message || '修改失败，请稍后重试'
    if (e.status === 403) msg = '无访问权限（403），请检查 API Key'
    else if (e.status === 503 || /high demand/i.test(msg)) msg = '模型当前高负载（503），请稍后重试'
    else if (/fetch failed|UND_ERR/i.test(msg) || cause?.code?.startsWith('UND_ERR')) msg = `网络连接失败（${cause?.code || 'fetch failed'}），请检查代理`
    return res.status(500).json({ error: msg })
  }
})

// ────────────────────────────────────────────────────────────────
// 风格复刻：参考图 + 产品图 → 两阶段（分析风格 → 生图）
// ────────────────────────────────────────────────────────────────
app.post('/api/style-clone', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { referenceImages, productImages, optionalPrompt, model: modelName, aspectRatio, clarity, quantity, mode } = req.body || {}
    const refArr = Array.isArray(referenceImages) ? referenceImages : []
    const productArr = Array.isArray(productImages) ? productImages : []
    if (refArr.length === 0) return res.status(400).json({ error: '请上传至少 1 张参考设计图' })
    if (productArr.length === 0) return res.status(400).json({ error: '请上传至少 1 张产品素材图' })

    const parsedRefs = refArr.slice(0, 14).map((img) => parseDataUrl(img)).filter(Boolean)
    const parsedProducts = productArr.map((img) => parseDataUrl(img)).filter(Boolean)
    if (parsedRefs.length === 0) return res.status(400).json({ error: '参考图格式无效' })
    if (parsedProducts.length === 0) return res.status(400).json({ error: '产品图格式无效' })

    const count = Math.min(15, Math.max(1, parseInt(quantity, 10) || 1))
    const modelId = getImageModelId(modelName || 'Nano Banana Pro')
    const { clarity: resolvedClarity } = normalizeClarityForModel(modelName || 'Nano Banana Pro', clarity || '1K 标准')
    const imageSizeVal = CLARITY_TO_SIZE[resolvedClarity] || '1K'
    const aspectRatioVal = String(ASPECT_RATIO_MAP[aspectRatio] || '1:1')
    const pointsPerImg = getPointsPerImage(modelName || 'Nano Banana Pro', resolvedClarity)
    const totalPoints = count * pointsPerImg
    const email = req.user.email
    const balance = getBalance(email)
    if (balance < totalPoints) return res.status(402).json({ error: '积分不足', required: totalPoints, balance })

    const ai = new GoogleGenAI({ apiKey })
    const is25Image = modelId === 'gemini-2.5-flash-image'
    const imageConfig = is25Image
      ? { aspectRatio: aspectRatioVal }
      : { aspectRatio: aspectRatioVal, imageSize: String(imageSizeVal) }
    const genConfig = { responseModalities: ['TEXT', 'IMAGE'], imageConfig }

    let styleDescription = ''
    try {
      const analysisPrompt = `Analyze the provided reference image(s) to extract their precise artistic style. Describe in detail:
1. Color palette and dominant tones
2. Lighting and composition style
3. Visual texture (e.g. watercolor, photorealistic, digital art)
4. Overall mood and atmosphere

Output a concise style description in 2-4 sentences. This will be used to replicate the style in new images.`
      const analysisContents = [
        ...parsedRefs.map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.data } })),
        { text: analysisPrompt },
      ]
      const analysisResp = await ai.models.generateContent({
        model: ANALYSIS_MODEL_ID,
        contents: analysisContents,
      })
      const text = analysisResp?.text ?? (analysisResp?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
      styleDescription = String(text || '').trim().slice(0, 800)
      if (styleDescription) console.log('[风格复刻] 风格描述:', styleDescription.slice(0, 150) + '...')
    } catch (e) {
      console.log('[风格复刻] 风格分析失败，使用通用描述:', e.message)
      styleDescription = 'Professional e-commerce product photography style: clean composition, high contrast, premium lighting, modern aesthetic.'
    }

    const baseStylePrompt = `CRITICAL - Style replication: You MUST strictly adhere to and replicate the EXACT visual aesthetic described below. The new image must maintain consistency in tone, texture, and execution.

STYLE TO REPLICATE: ${styleDescription}

Generate a new, high-resolution e-commerce detail image. Use the product/subject from the attached image. The output must strictly adopt the same visual style as described above.`

    const userPrompt = (optionalPrompt || '').trim()
    const fullPrompt = userPrompt ? `${baseStylePrompt}\n\nADDITIONAL USER INSTRUCTIONS: ${userPrompt}` : baseStylePrompt

    const results = []
    const maxTries = 3
    for (let i = 0; i < count; i++) {
      const productIdx = mode === 'batch' ? i % parsedProducts.length : 0
      const product = parsedProducts[productIdx]
      const contents = [
        { inlineData: { mimeType: product.mimeType, data: product.data } },
        { text: fullPrompt },
      ]
      let lastErr
      for (let t = 1; t <= maxTries; t++) {
        try {
          const resp = await ai.models.generateContent({
            model: modelId,
            contents,
            config: genConfig,
          })
          const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
          if (part?.inlineData?.data) {
            const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
            results.push(dataUrl)
            const imgId = `style-clone-${Date.now()}-${i}`
            try {
              saveImageToGallery(email, imgId, `风格复刻${i + 1}`, dataUrl, pointsPerImg, modelName || null, resolvedClarity)
            } catch (e) { console.error('[风格复刻] 存图库失败', e.message) }
            lastErr = null
            break
          }
        } catch (e) {
          lastErr = e
          if (t < maxTries) {
            const delay = 3000 * t
            console.log(`[风格复刻] 第 ${i + 1} 张失败，${delay / 1000}s 后重试…`)
            await new Promise((r) => setTimeout(r, delay))
          }
        }
      }
      if (lastErr) {
        console.error('[风格复刻] 生成失败:', lastErr.message)
        throw new Error(`第 ${i + 1} 张生成失败: ${lastErr.message || '请重试'}`)
      }
    }

    deductPoints(email, totalPoints, `风格复刻 (${count}张, ${modelName || 'Nano Banana Pro'})`)
    return res.json({ images: results, pointsUsed: totalPoints, newBalance: getBalance(email) })
  } catch (e) {
    console.error('[风格复刻] 失败:', e.message)
    let msg = e.message || '风格复刻失败，请稍后重试'
    if (e.status === 402) return res.status(402).json({ error: msg })
    return res.status(500).json({ error: msg })
  }
})

// A+ 支持的 17 种亚马逊标准模块 ID；每 listing 最多选 5 个
const APLUS_MODULE_IDS = [
  'header', 'single_highlights', 'image_dark_overlay', 'image_white_overlay', 'comparison_chart',
  'multiple_images', 'product_description', 'company_logo', 'single_image_sidebar', 'standard_text',
  'quad_images', 'tech_specs', 'single_right_image', 'three_images', 'single_left_image',
  'single_image_specs', 'brand_story',
]
function normalizeAplusModules(modules) {
  if (!Array.isArray(modules) || modules.length === 0) return ['header', 'three_images', 'brand_story']
  const set = new Set(modules.filter((m) => APLUS_MODULE_IDS.includes(m)))
  return Array.from(set).slice(0, 5)
}

// ────────────────────────────────────────────────────────────────
// 亚马逊 A+ — Step 1：仅生成文案（快速，无积分消耗）
// ────────────────────────────────────────────────────────────────
app.post('/api/amazon-aplus/analyze', async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { brand, product, features: featuresInput, story, style, language, modules: reqModules } = req.body
    if (!brand?.trim() || !product?.trim()) return res.status(400).json({ error: '请填写品牌名和产品名' })
    const rawFeatures = Array.isArray(featuresInput) ? featuresInput : (typeof featuresInput === 'string' ? featuresInput.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (rawFeatures.length < 1) return res.status(400).json({ error: '请填写至少 1 条核心卖点' })
    const features = rawFeatures.length >= 3 ? rawFeatures.slice(0, 5) : [...rawFeatures, ...rawFeatures, ...rawFeatures].slice(0, 5)
    const modules = normalizeAplusModules(reqModules)

    const lang = language || 'English'
    console.log(`[A+ 文案] 开始生成 | 品牌: ${brand} | 产品: ${product} | 模块: ${modules.join(', ')} | 语言: ${lang}`)

    const ai = new GoogleGenAI({ apiKey })
    const jsonParts = []
    if (modules.includes('header')) jsonParts.push('"heroTagline": "≤12 words", "heroSubtext": "≤20 words"')
    if (modules.includes('single_highlights')) jsonParts.push('"highlightTitle": "≤50 chars", "highlights": ["≤80 chars"] (exactly 4)')
    if (modules.includes('image_dark_overlay')) jsonParts.push('"overlayDarkHeadline": "≤50 chars", "overlayDarkText": "≤100 chars"')
    if (modules.includes('image_white_overlay')) jsonParts.push('"overlayWhiteHeadline": "≤50 chars", "overlayWhiteText": "≤100 chars"')
    if (modules.includes('comparison_chart')) jsonParts.push('"comparisonRows": [{"feature":"≤80","value1":"≤80","value2":"≤80"},...] (up to 10 rows)')
    if (modules.includes('product_description')) jsonParts.push('"productDescriptionText": "≤2000 chars"')
    if (modules.includes('company_logo')) jsonParts.push('"logoCaption": "≤30 chars" (optional)')
    if (modules.includes('single_image_sidebar')) jsonParts.push('"sidebarTitle": "≤50 chars", "sidebarBody": "≤400 chars"')
    if (modules.includes('standard_text')) jsonParts.push('"standardTextBody": "≤500 chars"')
    if (modules.includes('quad_images') || modules.includes('multiple_images')) jsonParts.push('"features": [{"title":"≤100","desc":"≤100"},...] (exactly 4)')
    if (modules.includes('three_images') && !modules.includes('quad_images') && !modules.includes('multiple_images')) jsonParts.push('"features": [{"title":"≤100","desc":"≤300"},...] (exactly 3)')
    if (modules.includes('tech_specs')) jsonParts.push('"techSpecs": [{"name":"≤20","value":"≤100"},...] (up to 10)')
    if (modules.includes('single_right_image')) jsonParts.push('"singleRightTitle": "≤50 chars", "singleRightBody": "≤160 chars"')
    if (modules.includes('single_left_image')) jsonParts.push('"singleLeftTitle": "≤50 chars", "singleLeftBody": "≤450 chars"')
    if (modules.includes('single_image_specs')) jsonParts.push('"singleSpecsTitle": "≤50 chars", "singleSpecsBullets": ["≤80 chars",...] (up to 5)')
    if (modules.includes('brand_story')) jsonParts.push('"brandStoryTitle": "≤8 words", "brandStoryBody": "60-80 words"')
    const copyPrompt = `You are an Amazon A+ content copywriter. Generate marketing copy in ${lang} for:
Brand: ${brand}
Product: ${product}
Key Features: ${features.join(' | ')}
Brand Story: ${story || '(not provided)'}
Style: ${style === 'luxury' ? 'premium luxury' : style === 'lifestyle' ? 'warm lifestyle' : 'clean minimal'}

A+ compliance: No competitors; no "best seller"/"top-rated"; no guarantee/warranty; no links or contact; benefit-focused; no medical claims; no ™®€ or emojis. All text in ${lang} only.

Return ONLY valid JSON (no markdown) with these keys for selected modules: { ${jsonParts.join(', ')} }`
    const copyResp = await ai.models.generateContent({
      model: ANALYSIS_MODEL_ID,
      contents: [{ text: copyPrompt }],
    })
    const copyRaw = copyResp?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || ''
    const copy = extractAnalyzeJson(copyRaw, true) || {}
    if (modules.includes('header') && !copy.heroTagline) copy.heroTagline = `${product} by ${brand}`
    if (modules.includes('header') && !copy.heroSubtext) copy.heroSubtext = features[0]
    if (modules.includes('single_highlights') && !copy.highlights) copy.highlights = features.slice(0, 4).map((f) => f.slice(0, 80))
    if (modules.includes('single_highlights') && !copy.highlightTitle) copy.highlightTitle = product
    if ((modules.includes('three_images') || modules.includes('quad_images') || modules.includes('multiple_images')) && !copy.features) {
      const n = (modules.includes('quad_images') || modules.includes('multiple_images')) ? 4 : 3
      copy.features = features.slice(0, n).map((f) => ({ title: f.slice(0, 30), desc: f }))
    }
    if (modules.includes('tech_specs') && !copy.techSpecs) copy.techSpecs = [{ name: 'Material', value: 'See description' }, { name: 'Dimensions', value: 'See description' }]
    if (modules.includes('brand_story') && !copy.brandStoryTitle) copy.brandStoryTitle = `About ${brand}`
    if (modules.includes('brand_story') && !copy.brandStoryBody) copy.brandStoryBody = story || `${brand} delivers quality products.`
    if (modules.includes('image_dark_overlay') && !copy.overlayDarkHeadline) copy.overlayDarkHeadline = product
    if (modules.includes('image_white_overlay') && !copy.overlayWhiteHeadline) copy.overlayWhiteHeadline = product
    if (modules.includes('comparison_chart') && !copy.comparisonRows) copy.comparisonRows = [{ feature: 'Quality', value1: '✓', value2: '✓' }]
    if (modules.includes('product_description') && !copy.productDescriptionText) copy.productDescriptionText = story || features.join('. ')
    if (modules.includes('single_image_sidebar') && !copy.sidebarTitle) copy.sidebarTitle = product
    if (modules.includes('single_image_sidebar') && !copy.sidebarBody) copy.sidebarBody = features[0] || ''
    if (modules.includes('standard_text') && !copy.standardTextBody) copy.standardTextBody = features.join('. ')
    if (modules.includes('single_right_image') && !copy.singleRightTitle) copy.singleRightTitle = product
    if (modules.includes('single_right_image') && !copy.singleRightBody) copy.singleRightBody = features[0] || ''
    if (modules.includes('single_left_image') && !copy.singleLeftTitle) copy.singleLeftTitle = product
    if (modules.includes('single_left_image') && !copy.singleLeftBody) copy.singleLeftBody = features[0] || ''
    if (modules.includes('single_image_specs') && !copy.singleSpecsTitle) copy.singleSpecsTitle = product
    if (modules.includes('single_image_specs') && !copy.singleSpecsBullets) copy.singleSpecsBullets = features.slice(0, 5).map((f) => f.slice(0, 80))
    copy._modules = modules
    console.log(`[A+ 文案] 生成完成 ✓ | 模块: ${modules.join(', ')}`)
    return res.json({ copy, modules })
  } catch (e) {
    console.error('[A+ 文案] 生成失败', e.message)
    return res.status(500).json({ error: e.message || '文案生成失败，请稍后重试' })
  }
})

// ────────────────────────────────────────────────────────────────
// 亚马逊 A+ — Step 2：根据确认的文案生成图片（消耗积分）
// ────────────────────────────────────────────────────────────────
app.post('/api/amazon-aplus/generate', async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { brand, product, features: featuresInput, copy, productImage, style, model: modelName, language, modules: reqModules } = req.body
    if (!brand?.trim() || !product?.trim()) return res.status(400).json({ error: '请填写品牌名和产品名' })
    const rawFeatures = Array.isArray(featuresInput) ? featuresInput : (typeof featuresInput === 'string' ? featuresInput.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (rawFeatures.length < 1) return res.status(400).json({ error: '请填写至少 1 条核心卖点' })
    const features = rawFeatures.length >= 3 ? rawFeatures.slice(0, 5) : [...rawFeatures, ...rawFeatures, ...rawFeatures].slice(0, 5)
    const modules = normalizeAplusModules(reqModules)

    const imageCountByModule = {
      header: 1, single_highlights: 1, image_dark_overlay: 1, image_white_overlay: 1, comparison_chart: 0,
      multiple_images: 4, product_description: 0, company_logo: 1, single_image_sidebar: 1, standard_text: 0,
      quad_images: 4, tech_specs: 0, single_right_image: 1, three_images: 3, single_left_image: 1,
      single_image_specs: 1, brand_story: 0,
    }
    const totalImages = modules.reduce((sum, m) => sum + (imageCountByModule[m] || 0), 0)
    const pointsPerImg = getPointsPerImage(modelName || 'Nano Banana 2', '1K 标准')
    const pointsUsed = pointsPerImg * totalImages
    const auth = req.headers.authorization
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token && totalImages > 0) {
      try {
        const payload = jwt.verify(token, JWT_SECRET)
        const email = payload.email
        const balance = getBalance(email)
        if (balance < pointsUsed) return res.status(402).json({ error: '积分不足', required: pointsUsed, balance })
      } catch (e) {
        if (e.message === '积分不足') throw e
      }
    }

    const lang = language || 'English'
    const ai = new GoogleGenAI({ apiKey })
    const imageModelId = getImageModelId(modelName || 'Nano Banana 2')
    console.log(`[A+ 图片] 开始生成 | 品牌: ${brand} | 产品: ${product} | 模块: ${modules.join(', ')} | 共 ${totalImages} 张`)
    const is25Image = imageModelId === 'gemini-2.5-flash-image'
    const imageConfig1x1 = is25Image ? { aspectRatio: '1:1' } : { aspectRatio: '1:1', imageSize: '1K' }
    const imageConfig16x9 = is25Image ? { aspectRatio: '16:9' } : { aspectRatio: '16:9', imageSize: '1K' }
    const genCfg1x1 = { responseModalities: ['TEXT', 'IMAGE'], imageConfig: imageConfig1x1 }
    const genCfg16x9 = { responseModalities: ['TEXT', 'IMAGE'], imageConfig: imageConfig16x9 }
    const styleDesc = {
      minimal:   'clean white studio background, minimalist professional product photography, bright even lighting',
      lifestyle: 'warm natural lifestyle setting, cozy home environment, natural soft window lighting',
      luxury:    'dark moody premium background, dramatic side lighting, gold and matte black accents, high-end editorial aesthetic',
    }[style] || 'clean white studio background'

    const productRef = productImage ? parseDataUrl(productImage) : null
    const refParts = productRef ? [{ inlineData: { mimeType: productRef.mimeType, data: productRef.data } }] : []
    const makeImagePrompt = (desc) => [...refParts, { text: desc }]
    const noTextRule = `CRITICAL RULE (highest priority): This must be a pure product PHOTO with absolutely NO text, NO words, NO letters, NO characters of any language. The product name and brand below are CONTEXT ONLY — do NOT render them in the image. Pure clean commercial photography, zero text.`

    let aplusCurrent = 0
    const generateImg = async (label, prompt, cfg) => {
      aplusCurrent++
      console.log(`[A+ 图片] 正在生成第 ${aplusCurrent}/${totalImages} 张（${label}）`)
      try {
        const resp = await ai.models.generateContent({
          model: imageModelId,
          contents: makeImagePrompt(prompt),
          config: cfg,
        })
        const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
        if (!part) return null
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      } catch (e) {
        console.error(`[A+ 图片] 「${label}」失败:`, e.message)
        return null
      }
    }

    const moduleImages = {}
    const namedImages = []

    for (const mod of modules) {
      if (mod === 'header') {
        const prompt = `${noTextRule} --- Amazon A+ hero banner. Product: ${product} by ${brand}. Style: ${styleDesc}. Wide elegant product shot, high resolution.`
        const img = await generateImg('Header 横幅', prompt, genCfg16x9)
        moduleImages.header = img
        if (img) namedImages.push({ label: 'A+ Header', data: img })
      } else if (mod === 'single_highlights') {
        const prompt = `${noTextRule} --- Amazon A+ single image with highlights. Product: ${product} by ${brand}. Style: ${styleDesc}. Square, clean centered composition.`
        const img = await generateImg('单图+亮点', prompt, genCfg1x1)
        moduleImages.single_highlights = img
        if (img) namedImages.push({ label: 'A+ 单图亮点', data: img })
      } else if (mod === 'three_images') {
        const feats = (copy?.features || features).slice(0, 3)
        const arr = []
        for (let i = 0; i < 3; i++) {
          const f = feats[i]?.title || feats[i] || features[i] || features[0]
          const p = `${noTextRule} --- Amazon A+ feature. Product: ${product} by ${brand}. Feature: ${f}. Style: ${styleDesc}. Square.`
          arr.push(await generateImg(`三图-${i + 1}`, p, genCfg1x1))
        }
        moduleImages.three_images = arr
        arr.forEach((data, i) => { if (data) namedImages.push({ label: `A+ 三图${i + 1}`, data }) })
      } else if (mod === 'quad_images') {
        const feats = (copy?.features || features).slice(0, 4)
        const arr = []
        for (let i = 0; i < 4; i++) {
          const f = feats[i]?.title || feats[i] || features[i] || features[0]
          const p = `${noTextRule} --- Amazon A+ feature. Product: ${product} by ${brand}. Feature: ${f}. Style: ${styleDesc}. Square.`
          arr.push(await generateImg(`四图-${i + 1}`, p, genCfg1x1))
        }
        moduleImages.quad_images = arr
        arr.forEach((data, i) => { if (data) namedImages.push({ label: `A+ 四图${i + 1}`, data }) })
      } else if (mod === 'image_dark_overlay') {
        const p = `${noTextRule} --- Amazon A+ banner, moody/dark area for text overlay. Product: ${product} by ${brand}. Style: ${styleDesc}. Wide 16:9.`
        const img = await generateImg('深色叠加图', p, genCfg16x9)
        moduleImages.image_dark_overlay = img
        if (img) namedImages.push({ label: 'A+ 深色叠加', data: img })
      } else if (mod === 'image_white_overlay') {
        const p = `${noTextRule} --- Amazon A+ banner, bright area for text overlay. Product: ${product} by ${brand}. Style: ${styleDesc}. Wide 16:9.`
        const img = await generateImg('浅色叠加图', p, genCfg16x9)
        moduleImages.image_white_overlay = img
        if (img) namedImages.push({ label: 'A+ 浅色叠加', data: img })
      } else if (mod === 'multiple_images') {
        const feats = (copy?.features || features).slice(0, 4)
        const arr = []
        for (let i = 0; i < 4; i++) {
          const f = feats[i]?.title || feats[i] || features[i] || features[0]
          const p = `${noTextRule} --- Amazon A+ multi-image. Product: ${product} by ${brand}. Feature: ${f}. Style: ${styleDesc}. Square.`
          arr.push(await generateImg(`多图-${i + 1}`, p, genCfg1x1))
        }
        moduleImages.multiple_images = arr
        arr.forEach((data, i) => { if (data) namedImages.push({ label: `A+ 多图${i + 1}`, data }) })
      } else if (mod === 'company_logo') {
        const p = `${noTextRule} --- Amazon A+ brand/logo style. Product context: ${product} by ${brand}. Clean, professional, wide format 16:9.`
        const img = await generateImg('品牌 Logo', p, genCfg16x9)
        moduleImages.company_logo = img
        if (img) namedImages.push({ label: 'A+ Logo', data: img })
      } else if (mod === 'single_image_sidebar') {
        const p = `${noTextRule} --- Amazon A+ single image for sidebar. Product: ${product} by ${brand}. Style: ${styleDesc}. Square.`
        const img = await generateImg('单图侧栏', p, genCfg1x1)
        moduleImages.single_image_sidebar = img
        if (img) namedImages.push({ label: 'A+ 单图侧栏', data: img })
      } else if (mod === 'single_right_image') {
        const p = `${noTextRule} --- Amazon A+ single right image. Product: ${product} by ${brand}. Style: ${styleDesc}. Square.`
        const img = await generateImg('右图', p, genCfg1x1)
        moduleImages.single_right_image = img
        if (img) namedImages.push({ label: 'A+ 右图', data: img })
      } else if (mod === 'single_left_image') {
        const p = `${noTextRule} --- Amazon A+ single left image. Product: ${product} by ${brand}. Style: ${styleDesc}. Square.`
        const img = await generateImg('左图', p, genCfg1x1)
        moduleImages.single_left_image = img
        if (img) namedImages.push({ label: 'A+ 左图', data: img })
      } else if (mod === 'single_image_specs') {
        const p = `${noTextRule} --- Amazon A+ single image with specs. Product: ${product} by ${brand}. Style: ${styleDesc}. Square.`
        const img = await generateImg('单图+规格', p, genCfg1x1)
        moduleImages.single_image_specs = img
        if (img) namedImages.push({ label: 'A+ 单图规格', data: img })
      }
    }

    const successCount = namedImages.filter((x) => x.data).length
    const actualPoints = pointsPerImg * successCount
    let newBalance = null
    const aplusImageIds = []
    if (token && successCount > 0) {
      try {
        const payload = jwt.verify(token, JWT_SECRET)
        const email = payload.email
        deductPoints(email, actualPoints, `A+ 页面 (${successCount} 张, ${modelName || 'Nano Banana 2'})`)
        newBalance = getBalance(email)
        const ts = Date.now()
        namedImages.forEach(({ label, data }, i) => {
          if (!data) return
          const id = `aplus-${ts}-${i}`
          try {
            saveImageToGallery(email, id, `${product}·${label}`, data, pointsPerImg, modelName || null, '1K 标准')
            aplusImageIds.push(id)
          } catch (e) {}
        })
      } catch (e) {}
    }

    const heroImage = moduleImages.header || null
    const featureImages = moduleImages.three_images || moduleImages.quad_images || []
    console.log('[A+ 图片] 完成 ✓ 成功', successCount, '张')
    return res.json({
      copy,
      modules,
      moduleImages,
      heroImage,
      featureImages,
      pointsUsed: token ? actualPoints : null,
      newBalance,
      aplusImageIds: aplusImageIds.length ? aplusImageIds : null,
    })
  } catch (e) {
    console.error('[A+ 图片] 生成失败', e.message)
    return res.status(500).json({ error: e.message || 'A+ 页面生成失败，请稍后重试' })
  }
})

// ── AI 运营助手 · 亚马逊 Listing 生成（方案 C：仅生图扣积分，文字不扣）────────────────
// Step 1：分析产品图 + 表单，返回结构化 productSummary（供 Step 2 使用）
app.post('/api/ai-assistant/amazon/analyze', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { images, category1, category2, brand, sellingPoints, market, lang, keywords, notes } = req.body || {}
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请上传至少一张产品图' })
    const points = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (points.length < 2) return res.status(400).json({ error: '请填写至少 2 条核心卖点' })
    if (!brand?.trim()) return res.status(400).json({ error: '请填写品牌名' })
    const firstImage = images[0]
    const parsed = parseDataUrl(firstImage)
    if (!parsed) return res.status(400).json({ error: '图片格式无效，请重新上传' })

    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()
    const prompt = `You are a senior Amazon listing strategist. Analyze the product image and user inputs to build a comprehensive product intelligence report. This report will drive the next step (title, bullets, description generation) with deep A9/Cosmo/Rufus/GEO optimization.

User inputs:
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Core selling points (one per line): ${points.join(' | ')}
- Target market: ${marketLabel}
- Output language: ${langLabel}
${keywords?.trim() ? `- Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Special notes/certifications: ${notes.trim()}` : ''}

Your tasks:

1. PRODUCT IDENTIFICATION: From the image + inputs, identify the product and write a concise summary.

2. KEY SPECS EXTRACTION (Rufus + GEO): Extract every concrete, verifiable spec you can find or infer — dimensions, weight, material, capacity, color, quantity, certifications. Be precise (e.g. "12 oz / 350ml" not just "medium size"). Use ${marketLabel}-appropriate units.

3. HIGH-VOLUME KEYWORDS (A9): Based on the product category and ${marketLabel} market, list 10-15 search terms that real shoppers would type. Include:
   - Core product term (e.g. "water bottle", "yoga mat")
   - Long-tail variants (e.g. "insulated water bottle for gym")
   - Material/feature terms (e.g. "stainless steel", "leak proof")
   - Use-case terms (e.g. "travel", "office", "kids")
   - Synonyms and alternate names
   ${keywords?.trim() ? `- Incorporate these reference keywords where relevant: ${keywords.trim()}` : ''}

4. BUYER QUESTIONS (Rufus): List the top 5 questions that buyers typically ask before purchasing this type of product. Think about concerns like durability, safety, compatibility, ease of use, maintenance, etc.

5. BUYER PERSONAS (Cosmo): Identify 3-4 distinct buyer personas with specific usage scenarios. Format: "[Who] + [scenario/need]" (e.g. "Gym-goers who need a durable, leak-proof bottle for workouts").

Output a JSON object only (no markdown fences). ALL text in ${langLabel}:
{
  "productName": "short product name",
  "productSummary": "2-4 sentences: what it is, key features, target use, key differentiators",
  "keyAttributes": ["specific attr with data, e.g. 'Material: 18/8 stainless steel'", "Capacity: 500ml / 17oz", "..."],
  "suggestedCategory": "${(category1 || '')} > ${(category2 || '')}",
  "topKeywords": ["keyword1", "keyword2", "...10-15 high-volume search terms"],
  "buyerQuestions": ["question1", "question2", "question3", "question4", "question5"],
  "buyerPersonas": ["persona1 + scenario", "persona2 + scenario", "persona3 + scenario"]
}`

    const contents = [
      { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
      { text: prompt },
    ]
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.productSummary) {
      return res.status(500).json({ error: '产品分析解析失败，请重试' })
    }
    console.log('[Amazon Listing] 分析完成 | 产品:', out.productName, '| keywords:', (out.topKeywords || []).length)
    return res.json({
      productName: out.productName || '',
      productSummary: out.productSummary || '',
      keyAttributes: Array.isArray(out.keyAttributes) ? out.keyAttributes : [],
      suggestedCategory: out.suggestedCategory || `${category1 || ''} > ${category2 || ''}`,
      topKeywords: Array.isArray(out.topKeywords) ? out.topKeywords : [],
      buyerQuestions: Array.isArray(out.buyerQuestions) ? out.buyerQuestions : [],
      buyerPersonas: Array.isArray(out.buyerPersonas) ? out.buyerPersonas : [],
    })
  } catch (e) {
    console.error('[Amazon Listing] analyze 失败', e.message)
    return res.status(500).json({ error: e.message || '产品分析失败，请稍后重试' })
  }
})

// Step 2：根据分析结果生成标题、后台关键词、五点、描述（符合亚马逊规则，不扣积分）
app.post('/api/ai-assistant/amazon/generate-listing', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { analyzeResult, category1, category2, brand, sellingPoints, market, lang, keywords, notes } = req.body || {}
    if (!analyzeResult?.productSummary) return res.status(400).json({ error: '请先完成产品分析' })
    const points = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (points.length < 2) return res.status(400).json({ error: '请提供至少 2 条核心卖点' })
    if (!brand?.trim()) return res.status(400).json({ error: '请提供品牌名' })

    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()
    const topKeywords = Array.isArray(analyzeResult.topKeywords) ? analyzeResult.topKeywords : []
    const buyerQuestions = Array.isArray(analyzeResult.buyerQuestions) ? analyzeResult.buyerQuestions : []
    const buyerPersonas = Array.isArray(analyzeResult.buyerPersonas) ? analyzeResult.buyerPersonas : []

    const prompt = `You are a senior Amazon listing strategist. Generate a full listing in ${langLabel} using the product intelligence data below. Every section must be driven by the analyzed keywords, buyer questions, and personas — not generic filler.

=== PRODUCT INTELLIGENCE (from analysis step) ===

Product: ${analyzeResult.productName || ''}
Summary: ${analyzeResult.productSummary}
Key specs: ${(analyzeResult.keyAttributes || []).join(' | ')}
Category: ${category1 || ''} > ${category2 || ''}
Brand: ${brand.trim()}
Selling points: ${points.join(' | ')}
${topKeywords.length ? `High-volume search keywords: ${topKeywords.join(', ')}` : ''}
${buyerQuestions.length ? `Top buyer questions: ${buyerQuestions.map((q, i) => `Q${i + 1}. ${q}`).join(' | ')}` : ''}
${buyerPersonas.length ? `Buyer personas: ${buyerPersonas.join(' | ')}` : ''}
${keywords?.trim() ? `Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `Notes: ${notes.trim()}` : ''}

Target market: ${marketLabel}
Output language: ${langLabel}

=== TITLE STRATEGY (A9) ===

Structure: [Brand] + [Core Product Term] + [Top 2-3 Attributes] + [Use Case or Differentiator]
- Front-load the highest-volume keyword from the search keywords list in the first 50-80 characters
- Weave in 3-5 additional search keywords naturally (no stuffing, no word repeated >2 times)
- ≤200 characters. No ALL CAPS (except brand). No forbidden characters (! $ ? _ { } ^ ¬ ¦)

=== BULLETS STRATEGY (5 bullets, each ≤500 chars, prefer ≤255) ===

Each bullet has a specific role. Follow this assignment:

Bullet 1 [A9 + Cosmo]: Lead with the #1 benefit and a primary use scenario from the buyer personas. Weave in 2-3 high-volume keywords naturally. Start with a benefit or scenario, NOT the product name.

Bullet 2 [Rufus + GEO]: Answer buyer question Q1 ("${buyerQuestions[0] || 'most common concern'}") with concrete specs from key specs. Include precise measurements in ${marketLabel}-appropriate units.

Bullet 3 [Rufus + GEO]: Answer buyer question Q2 ("${buyerQuestions[1] || 'second concern'}") with specific data — material, dimensions, weight, capacity, certifications. No vague claims without numbers.

Bullet 4 [Cosmo]: Describe a specific usage scenario from buyer personas. Use natural, conversational language (e.g. "Whether you're...", "Perfect for..."). Include 1-2 long-tail keywords.

Bullet 5 [Rufus]: Answer buyer question Q3 ("${buyerQuestions[2] || 'third concern'}") OR cover what's in the box / care instructions / compatibility with specifics.

Rules for ALL bullets:
- No price, promotion, or off-site links; no medical/unsupported claims
- No special characters (™ ® €) or emojis; no content repetition across bullets
- No ASIN, "N/A", company info, contact details, refund/guarantee language
- Each bullet starts with a benefit or scenario, never with the product name

=== DESCRIPTION STRATEGY (≤2000 chars) ===

- Paint 2-3 usage scenarios from buyer personas that bullets didn't fully cover
- Reinforce key benefits with DIFFERENT wording (no copy-paste from bullets)
- Include remaining search keywords that didn't fit in title/bullets
- No off-site links, contact info, competitor comparisons, or "best seller" claims

=== SEARCH TERMS STRATEGY (≤250 bytes) ===

- ONLY words NOT already in the optimized title or bullets
- Synonyms, alternate spellings, related terms from the search keywords list
- Space-separated (no commas needed). No competitor brands, no ASINs
- Prioritize: terms that cover buyer questions/scenarios not yet addressed in visible listing

=== COMPLIANCE (MUST follow) ===

- Promotional: No "best seller", "top rated", "free shipping", "on sale", "guarantee", "order now", "Amazon's Choice", "certified" (unless actually certified)
- IP/Brand: No competitor brands. Use "compatible with [Brand]" not "[Brand] Case". Use generic terms: "hook and loop" not "Velcro", "bodysuit" not "Onesie", "lip balm" not "Chapstick", "cotton swab" not "Q-tip"
- Medical: No "cure", "heal", "treat", "prevent", "FDA approved" without proof
- Pesticide: No "anti-bacterial", "disinfect", "sanitize" without EPA registration. Avoid "non-toxic"; prefer "BPA Free"
- Green: No "eco-friendly", "biodegradable", "sustainable" without certification. Use concrete claims like "Made of 100% natural bamboo"

Output ONLY valid JSON (no markdown fences). ALL text in ${langLabel}:
{
  "title": "optimized title ≤200 chars",
  "searchTerms": "backend keywords ≤250 bytes",
  "bullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"],
  "description": "product description ≤2000 chars"
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.title) {
      return res.status(500).json({ error: 'Listing 生成解析失败，请重试' })
    }
    // 强制截断并清洗标题以符合亚马逊限制（2025：禁止 ! $ ? _ { } ^ ¬ ¦ 等，除非为品牌名一部分）
    const forbiddenTitleChars = /[!$?_{}\^¬¦]/g
    const title = String(out.title || '').replace(forbiddenTitleChars, '').replace(/\s+/g, ' ').trim().slice(0, 200)
    let searchTerms = String(out.searchTerms || '').trim()
    while (Buffer.byteLength(searchTerms, 'utf8') > 250 && searchTerms.length > 0) {
      searchTerms = searchTerms.slice(0, -1)
    }
    const bullets = Array.isArray(out.bullets) ? out.bullets.slice(0, 5).map(b => stripMarkdown(b).slice(0, 500)) : []
    while (bullets.length < 5) bullets.push('')
    const description = stripMarkdown(String(out.description || '')).slice(0, 2000)
    console.log('[Amazon Listing] 生成完成 | title length:', title.length)
    return res.json({ title, searchTerms, bullets, description })
  } catch (e) {
    console.error('[Amazon Listing] generate-listing 失败', e.message)
    return res.status(500).json({ error: e.message || 'Listing 生成失败，请稍后重试' })
  }
})

// ── 优化 Listing：诊断现有 Listing + 一键优化（不扣积分）───────────────────────
app.post('/api/ai-assistant/amazon/optimize-listing', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { title, bullets, description, searchTerms, market, lang } = req.body || {}
    if (!title?.trim()) return res.status(400).json({ error: '请粘贴现有标题' })
    if (!bullets?.trim()) return res.status(400).json({ error: '请粘贴五点描述' })

    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()

    const prompt = `You are a senior Amazon listing strategist. You must perform a DEEP, multi-step optimization — not a surface-level rewrite.

LANGUAGE RULES (CRITICAL — follow exactly):
1. First, detect the language of the INPUT listing below (look at the title and bullets). Set "inputLanguage" in the JSON to the detected language name (e.g. "English", "中文", "Deutsch").
2. "diagnosis" section: Write ALL text (summary, issue descriptions, compliance flags) in the DETECTED INPUT LANGUAGE. If input is English, diagnosis must be in English. If input is Chinese, diagnosis must be in Chinese. This lets the seller match issues to their original wording.
3. "diagnosisZh" section: Write the SAME content as "diagnosis" but translated into 简体中文. Same scores, same number of issues, just in Chinese. If the input is already in Chinese, "diagnosisZh" should still be provided (it will be identical or nearly identical to "diagnosis").
4. "optimized" section: Write entirely in ${langLabel} (the target output language). If input language differs from ${langLabel}, translate while optimizing.
5. "analysis" section: Write in ${langLabel}.

=== STEP 1: PRODUCT INTELLIGENCE (do this analysis internally, output in "analysis") ===

From the existing listing, identify:
A. Product category & subcategory (e.g. "Kitchen > Water Bottles")
B. Brand name (extract from title)
C. Core product term — the 1-2 word generic name buyers would search (e.g. "water bottle", "yoga mat")
D. 10-15 high-volume search keywords that real ${marketLabel} shoppers would type for this product type. Think like a buyer: include the core term, long-tail variants, use-case terms, material/feature terms, and synonyms. Example for a water bottle: "insulated water bottle", "stainless steel water bottle", "water bottle for gym", "leak proof water bottle", "BPA free water bottle", "thermos bottle", etc.
E. Top 5 buyer questions — the most common concerns/questions buyers have before purchasing this type of product (e.g. "Does it keep drinks cold?", "Is it dishwasher safe?", "Will it fit in a cup holder?")
F. 3-4 buyer personas — who buys this product and in what scenario (e.g. "office workers who want to stay hydrated", "gym-goers who need a durable bottle", "parents packing kids' lunchboxes")
G. Key differentiating specs — extract any concrete specs (dimensions, weight, material, capacity, certifications) mentioned or implied in the listing

=== STEP 2: DIAGNOSE THE EXISTING LISTING ===

Score each section 1–10 and list specific problems. Evaluate against these concrete criteria:

Title diagnosis:
- Are any of the top search keywords from Step 1D present? Which are missing?
- Are brand + core product term in the first 50-80 characters?
- Any forbidden characters (! $ ? _ { } ^ ¬ ¦)? ALL CAPS (except brand)? Word repeated >2 times?
- Is it ≤200 characters?

Bullets diagnosis:
- [A9] Are the top search keywords distributed across bullets, or concentrated/missing?
- [Cosmo] Does each bullet describe a real scenario or use case in natural language, or is it keyword-stuffed?
- [Rufus] Does each bullet answer one of the top buyer questions from Step 1E with concrete specs/data?
- [GEO] Are measurements in correct units for ${marketLabel}? Are specs precise (not vague like "lightweight" without a number)?
- Are there prohibited claims (medical/eco/promotional)?

Description diagnosis:
- Does it duplicate bullets or add new value (usage scenarios, brand story)?
- ≤2000 characters? Any off-site links or contact info?

Search terms diagnosis (if provided):
- Any words repeated from title/bullets? Any competitor brands?
- ≤250 bytes?

Compliance deep scan — check EVERY item below. For each violation found, output a structured object with level, category, location, text, and suggestion.

Levels:
- "error": Will cause listing suppression or rejection. Must fix before publishing.
- "warning": Violates best practices or soft rules. Strongly recommended to fix.
- "info": Optimization suggestion, not a rule violation.

Check categories:

1. Title format rules:
   - [error] Title >200 characters
   - [error] Forbidden characters: ! $ ? _ { } ^ ¬ ¦ (unless part of brand name)
   - [warning] ALL CAPS words (except brand name)
   - [warning] Same word repeated >2 times (except articles/prepositions)
   - [info] Core product term not in first 80 characters

2. Bullet format rules:
   - [warning] Any bullet >500 characters
   - [info] Any bullet >255 characters (some categories enforce 255 limit)
   - [error] Content duplicated across bullets
   - [warning] Bullet starts with product name or keyword instead of benefit/scenario

3. Description rules:
   - [warning] Description >2000 characters
   - [error] Contains off-site links, URLs, or contact info
   - [error] Duplicates bullet content verbatim

4. Promotional claims [error]:
   - "best seller", "top rated", "free shipping", "on sale", "satisfaction guarantee", "money back", "order now", "Amazon's Choice", "certified" (unless actually certified), "#1", "award-winning" (without proof)

5. IP / Brand [error]:
   - Competitor brand names used incorrectly (should be "compatible with [Brand]" or "for [Brand]")
   - Trademarked generics: "Velcro"→"hook and loop", "Chapstick"→"lip balm", "Q-tip"→"cotton swab", "Onesie"→"bodysuit", "Popsicle"→"ice pop", "Jacuzzi"→"hot tub", "Band-Aid"→"adhesive bandage"

6. Medical claims [error]:
   - "cure", "heal", "treat", "prevent", "relief", "FDA approved", "FDA cleared", "clinically proven", "doctor recommended" without proof
   - Disease names (cancer, diabetes, arthritis, etc.) without medical device registration

7. Pesticide / Biocide [error]:
   - "anti-bacterial", "anti-microbial", "anti-fungal", "disinfect", "sanitize", "sterilize" without EPA/BPR registration
   - "non-toxic" (vague safety claim) → prefer "BPA Free" or specific material safety data
   - Absolute safety claims: "safe", "healthy", "harmless" without qualification

8. Environmental claims [error]:
   - "eco-friendly", "environmentally friendly", "green", "biodegradable", "compostable", "sustainable", "carbon neutral" without certification
   - Fix: use concrete claims like "Made of 100% natural bamboo", "Recycled paper packaging"

9. Other [warning]:
   - Contact info (email, phone, website)
   - "Leave a review", "feedback appreciated"
   - "New", "Newest", "Latest" (unless truly new product launch)
   - HTML tags or special markup
   - Emoji or special symbols (™ ® © €)
   - "N/A", "TBD", "not applicable", ASIN references

=== STEP 3: WRITE THE OPTIMIZED LISTING using Step 1 intelligence ===

Title optimization strategy:
- Structure: [Brand] + [Core Product Term] + [Top 2-3 Attributes/Keywords] + [Use Case or Differentiator]
- Front-load the highest-volume keyword from Step 1D in the first 50-80 characters
- Weave in 3-5 additional keywords from Step 1D naturally (no stuffing)
- ≤200 characters, no forbidden characters

Bullets optimization strategy (5 bullets, each ≤500 chars, prefer ≤255):
- Bullet 1 [A9+Cosmo]: Lead with the #1 benefit + primary use scenario from Step 1F. Include 2-3 keywords from Step 1D naturally.
- Bullet 2 [Rufus]: Answer buyer question #1 from Step 1E with concrete specs from Step 1G. Structure: "[Benefit/Feature] — [specific data]".
- Bullet 3 [Rufus+GEO]: Answer buyer question #2 with precise measurements in ${marketLabel}-appropriate units. Include material, dimensions, weight, or capacity.
- Bullet 4 [Cosmo]: Describe a specific usage scenario from Step 1F. Use natural, conversational language. Include 1-2 long-tail keywords.
- Bullet 5 [Rufus]: Answer buyer question #3 or cover what's in the box / warranty / care instructions with specifics.
- Each bullet must start with a benefit or scenario, NOT a keyword. Avoid starting every bullet with the product name.

Description optimization strategy:
- Paint 2-3 usage scenarios from Step 1F that bullets didn't cover
- Reinforce key benefits with different wording (no copy-paste from bullets)
- Include remaining keywords from Step 1D that didn't fit in title/bullets
- ≤2000 characters

Search terms optimization strategy:
- ONLY include words NOT already in the optimized title or bullets
- Use synonyms, Spanish/alternate spellings, related terms from Step 1D
- No commas needed (Amazon treats spaces as separators)
- No competitor brands, no ASINs
- ≤250 bytes

EXISTING LISTING:

Title: ${title.trim()}

Bullets:
${bullets.trim()}

${description?.trim() ? `Description:\n${description.trim()}` : '(No description provided)'}

${searchTerms?.trim() ? `Search terms:\n${searchTerms.trim()}` : '(No search terms provided)'}

Target market: ${marketLabel}
Output language: ${langLabel}

Output ONLY valid JSON (no markdown fences).

EXAMPLE for an English input listing with target language ${langLabel}:
{
  "inputLanguage": "English",
  "analysis": {
    "productCategory": "category > subcategory",
    "brand": "brand name",
    "coreProductTerm": "core term in ${langLabel}",
    "topKeywords": ["10-15 keywords in ${langLabel}"],
    "buyerQuestions": ["5 questions in ${langLabel}"],
    "buyerPersonas": ["3-4 personas in ${langLabel}"],
    "keySpecs": ["spec: value"]
  },
  "diagnosis": {
    "titleScore": 7,
    "titleIssues": ["This issue is written in English because input was English", "Another English issue"],
    "bulletsScore": 6,
    "bulletsIssues": ["English issue about bullets"],
    "descriptionScore": 5,
    "descriptionIssues": ["English issue"],
    "searchTermsScore": 4,
    "searchTermsIssues": ["English issue"],
    "complianceFlags": [{"level": "error", "category": "Promotional", "location": "Bullet 5", "text": "'Satisfaction Guarantee'", "suggestion": "Remove or replace with specific quality data"}],
    "overallScore": 6,
    "summary": "English summary because input was English"
  },
  "diagnosisZh": {
    "titleScore": 7,
    "titleIssues": ["这个问题用中文写，因为这是中文翻译版", "另一个中文问题"],
    "bulletsScore": 6,
    "bulletsIssues": ["关于五点的中文问题"],
    "descriptionScore": 5,
    "descriptionIssues": ["中文问题"],
    "searchTermsScore": 4,
    "searchTermsIssues": ["中文问题"],
    "complianceFlags": [{"level": "error", "category": "促销用语", "location": "五点第5条", "text": "'满意保证'", "suggestion": "删除或替换为具体质量数据"}],
    "overallScore": 6,
    "summary": "中文总结"
  },
  "optimized": {
    "title": "title in ${langLabel}",
    "bullets": ["5 bullets in ${langLabel}"],
    "description": "description in ${langLabel}",
    "searchTerms": "keywords in ${langLabel}"
  }
}

Remember: "diagnosis" language MUST match "inputLanguage". "diagnosisZh" is ALWAYS in 简体中文.`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.diagnosis || !out.optimized) {
      return res.status(500).json({ error: '优化结果解析失败，请重试' })
    }

    // 清洗优化后的标题
    const forbiddenTitleChars = /[!$?_{}\^¬¦]/g
    const optimizedTitle = String(out.optimized.title || '').replace(forbiddenTitleChars, '').replace(/\s+/g, ' ').trim().slice(0, 200)
    let optimizedSearchTerms = String(out.optimized.searchTerms || '').trim()
    while (Buffer.byteLength(optimizedSearchTerms, 'utf8') > 250 && optimizedSearchTerms.length > 0) {
      optimizedSearchTerms = optimizedSearchTerms.slice(0, -1)
    }
    const optimizedBullets = Array.isArray(out.optimized.bullets) ? out.optimized.bullets.slice(0, 5).map(b => stripMarkdown(b).slice(0, 500)) : []
    while (optimizedBullets.length < 5) optimizedBullets.push('')
    const optimizedDescription = stripMarkdown(String(out.optimized.description || '')).slice(0, 2000)

    console.log('[Amazon Listing] 优化完成 | overall score:', out.diagnosis.overallScore, '| inputLang:', out.inputLanguage, '| keywords:', (out.analysis?.topKeywords || []).length)
    return res.json({
      inputLanguage: out.inputLanguage || null,
      analysis: out.analysis || null,
      diagnosis: out.diagnosis,
      diagnosisZh: out.diagnosisZh || null,
      optimized: {
        title: optimizedTitle,
        bullets: optimizedBullets,
        description: optimizedDescription,
        searchTerms: optimizedSearchTerms,
      },
    })
  } catch (e) {
    console.error('[Amazon Listing] optimize-listing 失败', e.message)
    return res.status(500).json({ error: e.message || '优化失败，请稍后重试' })
  }
})

// ── A/B 文案变体：基于同一分析数据生成不同风格的 Listing 版本（不扣积分）──
app.post('/api/ai-assistant/amazon/generate-variants', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { currentListing, analysis, market, lang, variantCount } = req.body || {}
    if (!currentListing?.title) return res.status(400).json({ error: '请提供当前 Listing' })
    const count = Math.min(Math.max(parseInt(variantCount) || 2, 1), 3)
    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()

    const analysisBlock = analysis ? `
Product intelligence:
- Category: ${analysis.productCategory || ''}
- Brand: ${analysis.brand || ''}
- Core term: ${analysis.coreProductTerm || ''}
- Top keywords: ${(analysis.topKeywords || []).join(', ')}
- Buyer questions: ${(analysis.buyerQuestions || []).join(' | ')}
- Buyer personas: ${(analysis.buyerPersonas || []).join(' | ')}
- Key specs: ${(analysis.keySpecs || analysis.keyAttributes || []).join(' | ')}` : ''

    const prompt = `You are a senior Amazon listing copywriter. The seller already has a Version A listing. Generate ${count} alternative version(s) with DIFFERENT angles/styles, while maintaining the same product facts and Amazon compliance.

CURRENT VERSION A (do NOT repeat this — create something distinctly different):
Title: ${currentListing.title}
Bullets:
${(currentListing.bullets || []).join('\n')}
${currentListing.description ? `Description: ${currentListing.description}` : ''}
${currentListing.searchTerms ? `Search terms: ${currentListing.searchTerms}` : ''}
${analysisBlock}

Target market: ${marketLabel}
Output language: ${langLabel} (ALL output MUST be in ${langLabel})

VARIANT STYLE GUIDELINES:
- Each variant must use a DIFFERENT strategic angle. Choose from these approaches and label each variant:
  * "功能参数型" / "Spec-Driven": Lead with concrete specs, measurements, certifications. Best for technical/comparison shoppers.
  * "场景情感型" / "Scenario-Driven": Lead with usage scenarios, emotional benefits, lifestyle positioning. Best for impulse/gift buyers.
  * "问题解决型" / "Problem-Solution": Each bullet opens with a common pain point, then presents the product as the solution.
  * "对比差异型" / "Differentiator": Emphasizes what makes this product unique vs alternatives (without naming competitors).
- Each variant must still follow all Amazon rules (title ≤200 chars, bullets ≤500 chars each, description ≤2000 chars, search terms ≤250 bytes, no prohibited content).
- Each variant should cover DIFFERENT keywords from the top keywords list to maximize A/B testing value.
- The search terms in each variant should be complementary (cover different synonym sets).

Output ONLY valid JSON (no markdown fences). ALL text in ${langLabel}:
{
  "variants": [
    {
      "style": "style label in ${langLabel}",
      "styleDescription": "1 sentence explaining the angle in ${langLabel}",
      "title": "variant title ≤200 chars",
      "bullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"],
      "description": "variant description ≤2000 chars",
      "searchTerms": "variant search terms ≤250 bytes"
    }
  ]
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out?.variants || !Array.isArray(out.variants) || out.variants.length === 0) {
      return res.status(500).json({ error: '变体生成解析失败，请重试' })
    }

    const forbiddenTitleChars = /[!$?_{}\^¬¦]/g
    const variants = out.variants.slice(0, count).map(v => {
      const title = String(v.title || '').replace(forbiddenTitleChars, '').replace(/\s+/g, ' ').trim().slice(0, 200)
      let searchTerms = String(v.searchTerms || '').trim()
      while (Buffer.byteLength(searchTerms, 'utf8') > 250 && searchTerms.length > 0) searchTerms = searchTerms.slice(0, -1)
      const bullets = Array.isArray(v.bullets) ? v.bullets.slice(0, 5).map(b => stripMarkdown(b).slice(0, 500)) : []
      while (bullets.length < 5) bullets.push('')
      return {
        style: v.style || '',
        styleDescription: v.styleDescription || '',
        title,
        bullets,
        description: stripMarkdown(String(v.description || '')).slice(0, 2000),
        searchTerms,
      }
    })

    console.log('[Amazon Listing] 变体生成完成 | count:', variants.length, '| styles:', variants.map(v => v.style).join(', '))
    return res.json({ variants })
  } catch (e) {
    console.error('[Amazon Listing] generate-variants 失败', e.message)
    return res.status(500).json({ error: e.message || '变体生成失败，请稍后重试' })
  }
})

// ── 智能粘贴：从粘贴文本中提取 Listing 字段（不扣积分）─────────────────────
app.post('/api/ai-assistant/smart-paste', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { text, platform } = req.body || {}
    if (!text?.trim() || text.trim().length < 20) return res.status(400).json({ error: '粘贴内容太短，请复制完整的 Listing 页面内容' })

    const platformHint = platform === 'ebay' ? 'eBay' : platform === 'aliexpress' ? 'AliExpress' : 'Amazon'
    const prompt = `You are an expert at extracting structured listing data from raw pasted text. The user copied an entire ${platformHint} product listing page and pasted it below. Extract the listing fields.

IMPORTANT:
- The pasted text may contain navigation menus, ads, reviews, sidebar content, etc. IGNORE everything that is NOT part of the product listing itself.
- Extract ONLY the actual listing content (title, bullet points / item specifics / product attributes, description, brand).
- If a field cannot be found, return an empty string or empty array — do NOT fabricate content.
- Keep the extracted text in its ORIGINAL language — do NOT translate.
- For bullets: extract each bullet point as a separate string. On Amazon these are the "About this item" bullet points. On eBay/AliExpress there are no bullets — skip this field.
- For itemSpecifics (eBay) or productAttributes (AliExpress): extract key-value pairs from the specifications/details table.
- For searchTerms (Amazon only): this is NOT visible on the listing page, so always return empty string.

RAW PASTED TEXT:
---
${text.trim().slice(0, 15000)}
---

Output ONLY valid JSON (no markdown fences):
{
  "platform": "${platformHint}",
  "title": "the product title exactly as it appears",
  "brand": "brand name or empty string",
  "bullets": ["bullet1", "bullet2", "..."],
  "description": "product description text",
  "itemSpecifics": [{"name":"key","value":"val"}],
  "productAttributes": [{"name":"key","value":"val"}],
  "price": "price if visible, or empty string",
  "asin": "ASIN if visible (Amazon), or empty string"
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const raw = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(raw, true)
    if (!out || (!out.title && !out.description)) {
      return res.status(500).json({ error: '未能从粘贴内容中识别到 Listing 信息，请确认复制了完整的商品页面' })
    }
    console.log('[SmartPaste] 提取完成 | platform:', out.platform, '| title length:', (out.title || '').length)
    return res.json({
      platform: out.platform || platformHint,
      title: String(out.title || '').trim(),
      brand: String(out.brand || '').trim(),
      bullets: Array.isArray(out.bullets) ? out.bullets.map(b => String(b).trim()).filter(Boolean) : [],
      description: String(out.description || '').trim(),
      itemSpecifics: Array.isArray(out.itemSpecifics) ? out.itemSpecifics.filter(s => s.name && s.value) : [],
      productAttributes: Array.isArray(out.productAttributes) ? out.productAttributes.filter(a => a.name && a.value) : [],
      price: String(out.price || '').trim(),
      asin: String(out.asin || '').trim(),
    })
  } catch (e) {
    console.error('[SmartPaste] 失败', e.message)
    return res.status(500).json({ error: e.message || '智能识别失败，请稍后重试' })
  }
})

// ── 竞品对比：分析自己与竞品 Listing 的差异（不扣积分）─────────────────────
app.post('/api/ai-assistant/amazon/competitor-compare', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { myListing, competitors, market, lang } = req.body || {}
    if (!myListing?.title) return res.status(400).json({ error: '请填写你的 Listing 标题' })
    if (!Array.isArray(competitors) || competitors.length === 0 || !competitors[0]?.title) {
      return res.status(400).json({ error: '请至少填写一个竞品 Listing' })
    }
    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()

    const competitorBlocks = competitors.slice(0, 5).map((c, i) => `
COMPETITOR ${i + 1}:
Title: ${c.title || ''}
Bullets:
${c.bullets || ''}
${c.description ? `Description: ${c.description}` : ''}`).join('\n')

    const prompt = `You are an Amazon competitive intelligence analyst. Compare the seller's listing against ${competitors.length} competitor listing(s) and provide actionable insights.

MY LISTING:
Title: ${myListing.title}
Bullets:
${myListing.bullets || ''}
${myListing.description ? `Description: ${myListing.description}` : ''}
${competitorBlocks}

Target market: ${marketLabel}
ALL output MUST be in ${langLabel}.

Perform these analyses:

1. KEYWORD GAP: Extract keywords from all listings. Identify:
   - Keywords I have that competitors don't (my advantage)
   - Keywords competitors have that I'm missing (opportunity)
   - Keywords we all share (table stakes — must keep)

2. SELLING POINT MATRIX: For each key benefit/feature mentioned across all listings, mark who covers it. Identify:
   - My unique selling points (differentiators)
   - Competitor-only selling points I should consider adding
   - Shared selling points (must-haves)

3. TITLE STRUCTURE: Compare title strategies:
   - Keyword placement and priority differences
   - What competitors front-load vs what I front-load
   - Which title would likely rank better for the top search terms

4. BULLET STRATEGY: Compare bullet approaches:
   - Which buyer questions does each listing answer?
   - Where are competitors using better Rufus/Cosmo/GEO tactics?
   - Content gaps in my bullets

5. ACTION PLAN: Provide 5-8 specific, prioritized recommendations to improve my listing based on competitive gaps. Each recommendation should reference which competitor inspired it.

Output ONLY valid JSON (no markdown fences):
{
  "keywordGap": {
    "myAdvantage": ["keywords only in my listing"],
    "myOpportunity": ["keywords competitors have that I'm missing"],
    "shared": ["keywords everyone uses"]
  },
  "sellingPointMatrix": [
    { "feature": "feature name", "mine": true, "competitors": [true, false] }
  ],
  "titleAnalysis": {
    "myStrength": "what my title does well",
    "myWeakness": "what my title lacks vs competitors",
    "bestPractice": "which title element to adopt"
  },
  "bulletAnalysis": {
    "myStrength": "what my bullets do well",
    "gaps": ["gap1", "gap2"],
    "competitorTactics": ["tactic competitors use that I should adopt"]
  },
  "actionPlan": [
    { "priority": 1, "action": "specific recommendation", "reason": "why, referencing competitor" }
  ]
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.actionPlan) {
      return res.status(500).json({ error: '竞品分析解析失败，请重试' })
    }
    console.log('[Amazon Listing] 竞品对比完成 | actions:', (out.actionPlan || []).length)
    return res.json(out)
  } catch (e) {
    console.error('[Amazon Listing] competitor-compare 失败', e.message)
    return res.status(500).json({ error: e.message || '竞品分析失败，请稍后重试' })
  }
})

// ── 关键词研究：基于产品品类的系统化关键词策略（不扣积分）──────────────────
app.post('/api/ai-assistant/amazon/keyword-research', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { productName, category, market, lang, existingKeywords } = req.body || {}
    if (!productName?.trim()) return res.status(400).json({ error: '请填写产品名称' })
    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()

    const prompt = `You are an Amazon keyword research specialist. Generate a comprehensive keyword strategy for the following product in the ${marketLabel} market.

Product: ${productName.trim()}
${category?.trim() ? `Category: ${category.trim()}` : ''}
${existingKeywords?.trim() ? `Existing keywords already in use: ${existingKeywords.trim()}` : ''}
Output language: ${langLabel}
ALL output MUST be in ${langLabel}.

Perform deep keyword research:

1. CORE TERMS (1-3): The highest-volume generic search terms for this product type. These are the terms that shoppers type most frequently.

2. LONG-TAIL KEYWORDS (15-20): Organized by search intent:
   - Feature/Spec keywords: terms about material, size, color, capacity, etc.
   - Scenario/Use-case keywords: terms describing when/where/how the product is used
   - Audience keywords: terms targeting specific buyer groups (kids, office, gym, etc.)
   - Problem/Solution keywords: terms describing problems the product solves
   - Comparison keywords: terms buyers use when comparing options (best, vs, alternative)

3. BACKEND SUGGESTIONS (10-15): Keywords that should go in Search Terms field:
   - Synonyms and alternate spellings not covered by core/long-tail
   - Common misspellings that real buyers might type
   - Related/complementary product terms
   - Do NOT repeat words from core terms or long-tail groups

4. TITLE STRATEGY: Recommend how to arrange keywords in a title:
   - Which 2-3 keywords should appear in the first 80 characters
   - Suggested title structure template
   - Total keyword coverage estimate

5. SEASONAL/TREND NOTES: Any seasonal patterns, trending terms, or time-sensitive considerations for this product type.

${existingKeywords?.trim() ? `6. GAP ANALYSIS: Compare existing keywords against your research. Identify what's missing and what's redundant.` : ''}

Output ONLY valid JSON (no markdown fences):
{
  "coreTerms": [
    { "term": "core keyword", "reasoning": "why this is a core term" }
  ],
  "longTailGroups": [
    {
      "group": "Feature/Spec",
      "icon": "🔧",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
    },
    {
      "group": "Scenario/Use-case",
      "icon": "🎯",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
    },
    {
      "group": "Audience",
      "icon": "👥",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    },
    {
      "group": "Problem/Solution",
      "icon": "💡",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    },
    {
      "group": "Comparison",
      "icon": "⚖️",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "backendSuggestions": ["keyword1", "keyword2", "..."],
  "titleStrategy": {
    "priorityKeywords": ["top 2-3 keywords for first 80 chars"],
    "templateSuggestion": "[Brand] + [Core Term] + [Key Attribute] + [Use Case]",
    "coverageNotes": "explanation of keyword coverage"
  },
  "trends": "seasonal/trend notes or null if not applicable"${existingKeywords?.trim() ? `,
  "gapAnalysis": {
    "missing": ["keywords you should add"],
    "redundant": ["keywords that are redundant or low value"],
    "wellCovered": ["keywords that are well placed"]
  }` : ''}
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.coreTerms) {
      return res.status(500).json({ error: '关键词研究解析失败，请重试' })
    }
    console.log('[Amazon Listing] 关键词研究完成 | core:', (out.coreTerms || []).length, '| groups:', (out.longTailGroups || []).length)
    return res.json(out)
  } catch (e) {
    console.error('[Amazon Listing] keyword-research 失败', e.message)
    return res.status(500).json({ error: e.message || '关键词研究失败，请稍后重试' })
  }
})

// Step 3：生成亚马逊产品图（白底主图 / 场景图 / 特写图，各 0～4 张，扣积分）
app.post('/api/ai-assistant/amazon/generate-product-images', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { productImage, productName, brand, model: modelName, mainCount, sceneCount, closeUpCount, sellingPoints, sellingPointCount, sellingPointShowText, interactionCount, lang, count: reqCount } = req.body || {}
    if (!productImage) return res.status(400).json({ error: '请提供产品图' })
    const parsed = parseDataUrl(productImage)
    if (!parsed) return res.status(400).json({ error: '产品图格式无效' })

    const sellingPointsArr = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(x => x.trim()).filter(Boolean) : [])
    let sp = Math.min(Math.max(0, parseInt(sellingPointCount, 10) || 0), sellingPointsArr.length)

    // 优先使用 mainCount/sceneCount/closeUpCount（新三档选择）
    const hasNewParams = mainCount != null || sceneCount != null || closeUpCount != null
    let m = Math.min(4, Math.max(0, parseInt(mainCount, 10) || 0))
    let s = Math.min(4, Math.max(0, parseInt(sceneCount, 10) || 0))
    let c = Math.min(4, Math.max(0, parseInt(closeUpCount, 10) || 0))
    let itr = Math.min(4, Math.max(0, parseInt(interactionCount, 10) || 0))
    if (m + s + c + sp + itr === 0) {
      if (hasNewParams || sellingPointCount != null) {
        return res.status(400).json({ error: '请至少选择一类图片并设置数量≥1' })
      }
      if (reqCount != null) {
        m = Math.min(9, Math.max(1, parseInt(reqCount, 10) || 1))
      } else {
        return res.status(400).json({ error: '请至少选择一类图片并设置数量≥1' })
      }
    }
    console.log('[Amazon Listing] Step 3 请求数量', { mainCount, sceneCount, closeUpCount, sellingPointCount, interactionCount, m, s, c, sp, itr, total: m + s + c + sp + itr })
    const count = m + s + c + sp + itr
    const pointsPerImg = getPointsPerImage(modelName || 'Nano Banana 2', '1K 标准')
    const totalPoints = count * pointsPerImg
    const email = req.user.email
    const balance = getBalance(email)
    if (balance < totalPoints) return res.status(402).json({ error: '积分不足', required: totalPoints, balance })

    const ai = new GoogleGenAI({ apiKey })
    const imageModelId = getImageModelId(modelName || 'Nano Banana 2')
    const is25Image = imageModelId === 'gemini-2.5-flash-image'
    const imageConfig = is25Image ? { aspectRatio: '1:1' } : { aspectRatio: '1:1', imageSize: '1K' }
    const genCfg = { responseModalities: ['TEXT', 'IMAGE'], imageConfig }
    const noTextRule = `CRITICAL: This must be a pure product PHOTO with absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks. Product name and brand below are CONTEXT ONLY — do NOT render them in the image.`

    const baseContents = [{ inlineData: { mimeType: parsed.mimeType, data: parsed.data } }]
    const productCtx = `Product: ${productName || 'product'}. Brand context: ${brand || ''}.`

    const mainImages = []
    const sceneImages = []
    const closeUpImages = []
    const sellingPointImages = []
    const sellingPointLabels = []
    const interactionImages = []
    const mainImageIds = []
    const sceneImageIds = []
    const closeUpImageIds = []
    const sellingPointImageIds = []
    const interactionImageIds = []
    let mainImageId = null

    const mainPrompt = `${noTextRule} --- Amazon main image: Pure white background only (RGB 255,255,255, #FFFFFF). ${productCtx} Product must fill approximately 85% of the frame, centered. Professional product photography, high resolution, clean studio lighting. Single product only, no props or text.`
    const scenePrompt = `${noTextRule} --- Amazon scene/lifestyle image: Same product in a realistic use case or lifestyle setting. Product on a clean surface or in a natural environment (e.g. desk, kitchen, living room). Show product in context. Professional product photography, high resolution. No text, no logos. ${productCtx}`
    const closeUpPrompt = `${noTextRule} --- Amazon detail/close-up image: Same product. Create a NEW image—extreme close-up or macro shot showing product details, texture, materials, craftsmanship with ENHANCED visual quality. Highlight key features. Pure white or soft gradient studio background. Professional product photography, high resolution. No text, no logos. ${productCtx}

CRITICAL - Reference image usage: Use the reference ONLY for the product's appearance (shape, color, material). Do NOT copy its background, table, room, or any unrelated elements. Generate a completely new, clean composition with enhanced detail and texture—do NOT simply return or reproduce the reference image.

CRITICAL - Clean product only: (1) Pure white or soft gradient studio background (no walls, furniture, or clutter). (2) Product surface must be DRY—no water, no droplets. (3) For close-up, show a product detail (e.g. leg joint, surface texture, material weave) with the product isolated or in proper studio context.`

    let idx = 0
    for (let i = 0; i < m; i++) {
      idx++
      const contents = [...baseContents, { text: mainPrompt }]
      console.log(`[Amazon Listing] Step 3 | 第 ${idx}/${count} 张（白底主图）| 模型:`, imageModelId)
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张（白底主图）生成未返回图片，请重试` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      mainImages.push(dataUrl)
      const id = i === 0 ? `amazon-main-${Date.now()}` : `amazon-main-${Date.now()}-${i}`
      if (i === 0) mainImageId = id
      mainImageIds.push(id)
      try { saveImageToGallery(email, id, `${productName || '产品'}·白底主图${i + 1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
    }
    for (let i = 0; i < s; i++) {
      idx++
      const contents = [...baseContents, { text: scenePrompt }]
      console.log(`[Amazon Listing] Step 3 | 第 ${idx}/${count} 张（场景图）| 模型:`, imageModelId)
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张（场景图）生成未返回图片，请重试` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      sceneImages.push(dataUrl)
      const sid = `amazon-scene-${Date.now()}-${i}`
      sceneImageIds.push(sid)
      try { saveImageToGallery(email, sid, `${productName || '产品'}·场景图${i + 1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
    }
    for (let i = 0; i < c; i++) {
      idx++
      const contents = [...baseContents, { text: closeUpPrompt }]
      console.log(`[Amazon Listing] Step 3 | 第 ${idx}/${count} 张（特写图）| 模型:`, imageModelId)
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张（特写图）生成未返回图片，请重试` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      closeUpImages.push(dataUrl)
      const cid = `amazon-closeup-${Date.now()}-${i}`
      closeUpImageIds.push(cid)
      try { saveImageToGallery(email, cid, `${productName || '产品'}·特写图${i + 1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
    }
    const langName = { zh: 'Chinese', en: 'English', de: 'German', fr: 'French', ja: 'Japanese', es: 'Spanish' }[lang] || 'English'
    for (let i = 0; i < sp; i++) {
      idx++
      const pointText = sellingPointsArr[i] || ''
      const textRule = sellingPointShowText
        ? `CRITICAL - Text on image: This image MUST display the selling point text clearly and elegantly. The text must be in ${langName}. The content is: "${pointText}". If the point is in another language, translate it to ${langName} for display. Place the text with sufficient margins (8–12% from edges), readable typography, no clipping.`
        : noTextRule
      const noTextSuffix = sellingPointShowText ? '' : ' No text, no logos.'
      const sellingPointPrompt = `${textRule} --- Amazon selling-point image: Same product. This image must visually showcase THIS specific selling point: "${pointText}". ${productCtx} Create a professional product photo that illustrates the benefit or feature—e.g. if the point is about stackability, show stacked units; if about durability, show texture or structure; if about portability, show in-hand or compact. Pure white or soft gradient studio background. Professional product photography, high resolution.${noTextSuffix} Reference image for product look only; do not copy background. Product surface dry, no water or droplets. Physically correct placement (e.g. stool on floor, not on table).`
      const contents = [...baseContents, { text: sellingPointPrompt }]
      console.log(`[Amazon Listing] Step 3 | 第 ${idx}/${count} 张（卖点图 ${i + 1}）| 模型:`, imageModelId)
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张（卖点图 ${i + 1}）生成未返回图片，请重试` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      sellingPointImages.push(dataUrl)
      sellingPointLabels.push(pointText)
      const spid = `amazon-sellingpoint-${Date.now()}-${i}`
      sellingPointImageIds.push(spid)
      try { saveImageToGallery(email, spid, `${productName || '产品'}·卖点${i + 1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
    }
    const interactionPrompt = `${noTextRule} --- Human-product interaction image: Show a real person naturally using, holding, or interacting with this product in a realistic setting. ${productCtx} The person should be partially visible (hands, arms, or upper body)—focus on the interaction, not the person's face. Show genuine usage: e.g. sitting on a stool, holding a tool, wearing an accessory, using a kitchen gadget. Natural indoor or lifestyle environment with soft lighting. Professional product photography, high resolution. No text, no logos. Reference image is for product appearance ONLY—generate a completely new scene with a person.`
    for (let i = 0; i < itr; i++) {
      idx++
      const contents = [...baseContents, { text: interactionPrompt }]
      console.log(`[Amazon Listing] Step 3 | 第 ${idx}/${count} 张（交互图 ${i + 1}）| 模型:`, imageModelId)
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张（交互图 ${i + 1}）生成未返回图片，请重试` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      interactionImages.push(dataUrl)
      const iid = `amazon-interaction-${Date.now()}-${i}`
      interactionImageIds.push(iid)
      try { saveImageToGallery(email, iid, `${productName || '产品'}·交互图${i + 1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
    }

    deductPoints(email, totalPoints, `亚马逊产品图 ${count} 张 (${modelName || 'Nano Banana 2'})`)
    const newBalance = getBalance(email)
    const mainImage = mainImages[0] || null
    const additionalImages = [...mainImages.slice(1), ...sceneImages, ...closeUpImages, ...sellingPointImages, ...interactionImages]
    console.log('[Amazon Listing] Step 3 产品图完成 ✓ 共', count, '张')
    return res.json({ mainImage, mainImages, sceneImages, closeUpImages, sellingPointImages, sellingPointLabels, interactionImages, mainImageIds, sceneImageIds, closeUpImageIds, sellingPointImageIds, interactionImageIds, additionalImages, pointsUsed: totalPoints, newBalance, mainImageId: mainImageId || null })
  } catch (e) {
    console.error('[Amazon Listing] generate-product-images 失败', e.message)
    return res.status(500).json({ error: e.message || '产品图生成失败，请稍后重试' })
  }
})

// 保存当前 Listing 到历史（方案一：独立表）
app.post('/api/ai-assistant/amazon/save-listing', requireAuth, (req, res) => {
  try {
    const { name, title, searchTerms, bullets, description, analyzeResult, aplusCopy, mainImageId, aplusImageIds, productImageIds } = req.body || {}
    if (!title || title.trim() === '') return res.status(400).json({ error: '请提供标题' })
    const email = req.user.email
    const created_at = Date.now()
    const bulletsStr = Array.isArray(bullets) ? JSON.stringify(bullets) : (typeof bullets === 'string' ? bullets : '[]')
    const aplusIdsStr = Array.isArray(aplusImageIds) ? JSON.stringify(aplusImageIds) : null
    const productIdsStr = productImageIds && typeof productImageIds === 'object' ? JSON.stringify(productImageIds) : null
    getDb()
      .prepare(
        `INSERT INTO amazon_listing_snapshots (user_email, created_at, name, title, search_terms, bullets, description, analyze_result, aplus_copy, main_image_id, aplus_image_ids, product_image_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        email,
        created_at,
        (name || '').trim().slice(0, 200),
        String(title).trim().slice(0, 500),
        String(searchTerms || '').trim().slice(0, 1000),
        bulletsStr,
        String(description || '').slice(0, 5000),
        analyzeResult != null ? JSON.stringify(analyzeResult) : null,
        aplusCopy != null ? JSON.stringify(aplusCopy) : null,
        mainImageId || null,
        aplusIdsStr,
        productIdsStr
      )
    const row = getDb().prepare('SELECT id, created_at, name, title FROM amazon_listing_snapshots WHERE user_email = ? AND created_at = ?').get(email, created_at)
    console.log('[Amazon Listing] 已保存到历史 id:', row?.id)
    return res.json({ id: row?.id, created_at })
  } catch (e) {
    console.error('[Amazon Listing] save-listing 失败', e.message)
    return res.status(500).json({ error: e.message || '保存失败' })
  }
})

// 列出当前用户的 Listing 历史
app.get('/api/ai-assistant/amazon/listings', requireAuth, (req, res) => {
  try {
    const email = req.user.email
    const rows = getDb()
      .prepare('SELECT id, created_at, name, title, search_terms, bullets, description FROM amazon_listing_snapshots WHERE user_email = ? ORDER BY created_at DESC LIMIT 200')
      .all(email)
    const list = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      name: r.name || '',
      title: r.title || '',
      titlePreview: (r.title || '').slice(0, 60) + ((r.title || '').length > 60 ? '…' : ''),
    }))
    return res.json({ list })
  } catch (e) {
    console.error('[Amazon Listing] listings 列表失败', e.message)
    return res.status(500).json({ error: '获取列表失败' })
  }
})

// 获取单条 Listing 详情（用于查看/复制）
app.get('/api/ai-assistant/amazon/listings/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ error: '无效的 id' })
    const row = getDb().prepare('SELECT * FROM amazon_listing_snapshots WHERE id = ? AND user_email = ?').get(id, req.user.email)
    if (!row) return res.status(404).json({ error: '未找到该记录' })
    let bullets = []
    try {
      bullets = JSON.parse(row.bullets || '[]')
    } catch (_) {}
    let productImageIds = null
    try {
      productImageIds = row.product_image_ids ? JSON.parse(row.product_image_ids) : null
    } catch (_) {}
    if (!productImageIds && row.main_image_id) {
      productImageIds = { mainImageIds: [row.main_image_id], sceneImageIds: [], closeUpImageIds: [], sellingPointImageIds: [] }
    }
    return res.json({
      id: row.id,
      createdAt: row.created_at,
      name: row.name || '',
      title: row.title || '',
      searchTerms: row.search_terms || '',
      bullets,
      description: row.description || '',
      analyzeResult: row.analyze_result ? JSON.parse(row.analyze_result) : null,
      aplusCopy: row.aplus_copy ? JSON.parse(row.aplus_copy) : null,
      mainImageId: row.main_image_id || null,
      aplusImageIds: row.aplus_image_ids ? JSON.parse(row.aplus_image_ids) : null,
      productImageIds,
    })
  } catch (e) {
    console.error('[Amazon Listing] listing 详情失败', e.message)
    return res.status(500).json({ error: '获取详情失败' })
  }
})

// 删除单条 Listing 历史
app.delete('/api/ai-assistant/amazon/listings/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ error: '无效的 id' })
    const stmt = getDb().prepare('DELETE FROM amazon_listing_snapshots WHERE id = ? AND user_email = ?')
    const result = stmt.run(id, req.user.email)
    if (result.changes === 0) return res.status(404).json({ error: '未找到该记录或无权删除' })
    return res.json({ ok: true })
  } catch (e) {
    console.error('[Amazon Listing] delete listing 失败', e.message)
    return res.status(500).json({ error: '删除失败' })
  }
})

// ── AI 运营助手 · eBay Listing 生成 ────────────────────────────────────────────
app.post('/api/ai-assistant/ebay/analyze', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { images, category1, category2, brand, sellingPoints, market, lang, keywords, notes } = req.body || {}
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请上传至少一张产品图' })
    const points = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (points.length < 2) return res.status(400).json({ error: '请填写至少 2 条核心卖点' })
    if (!brand?.trim()) return res.status(400).json({ error: '请填写品牌名' })
    const firstImage = images[0]
    const parsed = parseDataUrl(firstImage)
    if (!parsed) return res.status(400).json({ error: '图片格式无效，请重新上传' })

    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()
    const prompt = `You are an eBay listing expert and Cassini search specialist. Analyze the product image and user inputs to perform DEEP PRODUCT INTELLIGENCE for eBay listing generation.

User inputs:
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Core selling points: ${points.join(' | ')}
- Target market: ${marketLabel}
- Output language: ${langLabel}
${keywords?.trim() ? `- Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Special notes/certifications: ${notes.trim()}` : ''}

Perform these analyses:
1. PRODUCT IDENTIFICATION: name, category, brand
2. KEY SPECS EXTRACTION: dimensions, weight, material, certifications from the image or notes — these drive Item Specifics and Cassini filtering
3. HIGH-VOLUME CASSINI KEYWORDS (8-12): the search terms eBay buyers actually type for this product type in the ${marketLabel} market. Include brand+product combos, feature keywords, and use-case keywords. These will drive title and Item Specifics optimization.
4. BUYER QUESTIONS (3-5): common questions eBay buyers ask about this product type. These will drive description content.
5. BUYER PERSONAS (2-3): who buys this product and in what scenario. These will inform description tone and selling angles.

Output a JSON object only (no markdown):
{
  "productName": "short product name in output language",
  "productSummary": "2-4 sentences describing the product, key features, and target use (in output language)",
  "keyAttributes": ["specific attr with data, e.g. 'Stainless Steel 304', '500ml capacity'"],
  "suggestedCategory": "${(category1 || '')} > ${(category2 || '')}",
  "topKeywords": ["cassini keyword1", "cassini keyword2", "...up to 12"],
  "buyerQuestions": ["question1", "question2", "...up to 5"],
  "buyerPersonas": ["persona1 + scenario", "persona2 + scenario"]
}`

    const contents = [
      { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
      { text: prompt },
    ]
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.productSummary) return res.status(500).json({ error: '产品分析解析失败，请重试' })
    console.log('[eBay Listing] 分析完成 | 产品:', out.productName, '| keywords:', (out.topKeywords || []).length)
    return res.json({ productName: out.productName || '', productSummary: out.productSummary || '', keyAttributes: Array.isArray(out.keyAttributes) ? out.keyAttributes : [], suggestedCategory: out.suggestedCategory || `${category1 || ''} > ${category2 || ''}`, topKeywords: Array.isArray(out.topKeywords) ? out.topKeywords : [], buyerQuestions: Array.isArray(out.buyerQuestions) ? out.buyerQuestions : [], buyerPersonas: Array.isArray(out.buyerPersonas) ? out.buyerPersonas : [] })
  } catch (e) {
    console.error('[eBay Listing] analyze 失败', e.message)
    return res.status(500).json({ error: e.message || '产品分析失败，请稍后重试' })
  }
})

app.post('/api/ai-assistant/ebay/generate-listing', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { analyzeResult, category1, category2, brand, sellingPoints, market, lang, keywords, notes } = req.body || {}
    if (!analyzeResult?.productSummary) return res.status(400).json({ error: '请先完成产品分析' })
    const points = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (points.length < 2) return res.status(400).json({ error: '请提供至少 2 条核心卖点' })
    if (!brand?.trim()) return res.status(400).json({ error: '请提供品牌名' })

    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()
    const prompt = `You are an eBay listing copywriter and Cassini optimization expert. Generate a strategy-driven listing in ${langLabel} for eBay ${marketLabel} market.

=== PRODUCT INTELLIGENCE (from analysis step) ===
- Product name: ${analyzeResult.productName || ''}
- Summary: ${analyzeResult.productSummary}
- Key attributes: ${(analyzeResult.keyAttributes || []).join(', ')}
- Top Cassini keywords: ${(analyzeResult.topKeywords || []).join(', ')}
- Buyer questions: ${(analyzeResult.buyerQuestions || []).join(' | ')}
- Buyer personas: ${(analyzeResult.buyerPersonas || []).join(' | ')}
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Selling points: ${points.join(' | ')}
${keywords?.trim() ? `- Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Notes: ${notes.trim()}` : ''}

=== TITLE STRATEGY (Cassini-optimized, ≤80 chars) ===
- Structure: [Brand] + [Core Product Term] + [Top 2-3 Attributes/Keywords]
- Front-load the highest-volume keyword from topKeywords in the first 3-4 words
- Weave in 3-5 additional keywords naturally — eBay has NO backend search terms
- If brand is "Unbranded", omit it and use space for keywords
- No ALL CAPS (except brand acronyms), no special symbols unless part of brand

=== ITEM SPECIFICS STRATEGY (15-25 key-value pairs) ===
- MUST include: Brand, MPN ("Does not apply" if unknown), Type, Material, Color, Size/Dimensions, UPC/EAN ("Does not apply" if unknown)
- Add category-specific specifics to maximize Cassini filtered search visibility
- Embed keywords from topKeywords into relevant specifics (e.g. Features, Style, Use)
- For EU: add "Country/Region of Manufacture" for GPSR compliance
- If certifications provided in notes, add Certification specific

=== DESCRIPTION STRATEGY (800-1500 chars, plain text, NO HTML) ===
- Open with the #1 benefit that addresses buyer question #1 from buyerQuestions
- Paragraph 2: key features and specifications from keyAttributes with concrete data
- Paragraph 3: usage scenario from buyerPersonas — paint a picture of the buyer using the product
- Paragraph 4: what's in the box / warranty / care instructions
- Naturally embed keywords from topKeywords without stuffing
- No competitor mentions, no off-site links, no contact info

=== COMPLIANCE ===
- Never claim certifications not provided by the user
- No promotional claims: "best seller", "#1", "guaranteed"

Output ONLY valid JSON (no markdown):
{
  "title": "eBay title, ≤80 chars, in ${langLabel}",
  "itemSpecifics": [{"name":"Brand","value":"..."},{"name":"Type","value":"..."},{"name":"Material","value":"..."},...],
  "description": "product description, 800-1500 chars, plain text, in ${langLabel}"
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.title) return res.status(500).json({ error: 'Listing 生成解析失败，请重试' })
    const title = String(out.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const itemSpecifics = Array.isArray(out.itemSpecifics) ? out.itemSpecifics.slice(0, 30).map(s => ({ name: String(s.name || ''), value: String(s.value || '') })) : []
    const description = stripMarkdown(String(out.description || '').replace(/<[^>]*>/g, '')).slice(0, 5000)
    console.log('[eBay Listing] 生成完成 | title length:', title.length, '| itemSpecifics:', itemSpecifics.length)
    return res.json({ title, itemSpecifics, description })
  } catch (e) {
    console.error('[eBay Listing] generate-listing 失败', e.message)
    return res.status(500).json({ error: e.message || 'Listing 生成失败，请稍后重试' })
  }
})

app.post('/api/ai-assistant/ebay/generate-product-images', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { productImage, productName, brand, model: modelName, mainCount, sceneCount, closeUpCount, sellingPoints, sellingPointCount, sellingPointShowText, interactionCount, lang } = req.body || {}
    if (!productImage) return res.status(400).json({ error: '请提供产品图' })
    const parsed = parseDataUrl(productImage)
    if (!parsed) return res.status(400).json({ error: '产品图格式无效' })

    const sellingPointsArr = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(x => x.trim()).filter(Boolean) : [])
    let sp = Math.min(Math.max(0, parseInt(sellingPointCount, 10) || 0), sellingPointsArr.length)
    let m = Math.min(4, Math.max(0, parseInt(mainCount, 10) || 0))
    let s = Math.min(4, Math.max(0, parseInt(sceneCount, 10) || 0))
    let c = Math.min(4, Math.max(0, parseInt(closeUpCount, 10) || 0))
    let itr = Math.min(4, Math.max(0, parseInt(interactionCount, 10) || 0))
    if (m + s + c + sp + itr === 0) return res.status(400).json({ error: '请至少选择一类图片并设置数量≥1' })

    const count = m + s + c + sp + itr
    const pointsPerImg = getPointsPerImage(modelName || 'Nano Banana 2', '1K 标准')
    const totalPoints = count * pointsPerImg
    const email = req.user.email
    const balance = getBalance(email)
    if (balance < totalPoints) return res.status(402).json({ error: '积分不足', required: totalPoints, balance })

    const ai = new GoogleGenAI({ apiKey })
    const imageModelId = getImageModelId(modelName || 'Nano Banana 2')
    const is25Image = imageModelId === 'gemini-2.5-flash-image'
    const imageConfig = is25Image ? { aspectRatio: '1:1' } : { aspectRatio: '1:1', imageSize: '1K' }
    const genCfg = { responseModalities: ['TEXT', 'IMAGE'], imageConfig }
    const noTextRule = `CRITICAL: Pure product PHOTO with NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks.`
    const baseContents = [{ inlineData: { mimeType: parsed.mimeType, data: parsed.data } }]
    const productCtx = `Product: ${productName || 'product'}. Brand context: ${brand || ''}.`

    const mainImages = [], sceneImages = [], closeUpImages = [], sellingPointImages = [], sellingPointLabels = [], interactionImages = []
    const mainImageIds = [], sceneImageIds = [], closeUpImageIds = [], sellingPointImageIds = [], interactionImageIds = []
    let mainImageId = null, idx = 0

    for (let i = 0; i < m; i++) {
      idx++; const contents = [...baseContents, { text: `${noTextRule} --- eBay product image: Pure white background (RGB 255,255,255). ${productCtx} Product fills ~85% frame, centered. Professional studio lighting.` }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      mainImages.push(dataUrl); const id = `ebay-main-${Date.now()}-${i}`; if (i === 0) mainImageId = id; mainImageIds.push(id)
      try { saveImageToGallery(email, id, `${productName || '产品'}·eBay主图${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    for (let i = 0; i < s; i++) {
      idx++; const contents = [...baseContents, { text: `${noTextRule} --- eBay scene image: Product in realistic lifestyle setting. ${productCtx} Professional photography. No text.` }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      sceneImages.push(dataUrl); const sid = `ebay-scene-${Date.now()}-${i}`; sceneImageIds.push(sid)
      try { saveImageToGallery(email, sid, `${productName || '产品'}·eBay场景${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    for (let i = 0; i < c; i++) {
      idx++; const closeUpPrompt = `${noTextRule} --- eBay detail/close-up image: Same product. Create a NEW image. Extreme close-up or macro shot showing product details, texture, materials, craftsmanship. Highlight key features. Pure white or soft gradient studio background. Professional product photography, high resolution. No text, no logos. ${productCtx} CRITICAL: Use the reference ONLY for the product's appearance. Do NOT copy its background, table, room, or any unrelated elements. Generate a completely new, clean composition with enhanced detail and texture.`
      const contents = [...baseContents, { text: closeUpPrompt }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      closeUpImages.push(dataUrl); const cid = `ebay-closeup-${Date.now()}-${i}`; closeUpImageIds.push(cid)
      try { saveImageToGallery(email, cid, `${productName || '产品'}·eBay特写${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    const langName = { zh: 'Chinese', en: 'English', de: 'German', fr: 'French', ja: 'Japanese', es: 'Spanish' }[lang] || 'English'
    for (let i = 0; i < sp; i++) {
      idx++; const pointText = sellingPointsArr[i] || ''
      const textRule = sellingPointShowText
        ? `CRITICAL - Text on image: This image MUST display the selling point text clearly and elegantly. The text MUST be in ${langName}. The content is: "${pointText}". If the original text is in another language, translate it to ${langName} first, then render the translated text. Place the text with sufficient margins (8–12% from edges), large readable typography, high contrast, no clipping.`
        : noTextRule
      const noTextSuffix = sellingPointShowText ? '' : ' No text, no logos.'
      const contents = [...baseContents, { text: `${textRule} --- eBay selling-point image: Same product. This image must visually showcase THIS specific selling point: "${pointText}". ${productCtx} Create a NEW professional product photo that illustrates the benefit or feature—e.g. if the point is about stackability, show multiple stacked units; if about durability, show texture or structure close-up; if about portability, show in-hand or compact size comparison. Pure white or soft gradient studio background. Professional product photography, high resolution.${noTextSuffix} Reference image is for product appearance ONLY—do NOT simply copy or overlay text on the reference image. Generate a completely new composition. Product surface dry, no water or droplets. Physically correct placement (e.g. stool on floor, not floating).` }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      sellingPointImages.push(dataUrl); sellingPointLabels.push(pointText)
      const spid = `ebay-sp-${Date.now()}-${i}`; sellingPointImageIds.push(spid)
      try { saveImageToGallery(email, spid, `${productName || '产品'}·eBay卖点${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    const interactionPrompt = `${noTextRule} --- Human-product interaction image: Show a real person naturally using, holding, or interacting with this product in a realistic setting. ${productCtx} The person should be partially visible (hands, arms, or upper body)—focus on the interaction, not the person's face. Show genuine usage: e.g. sitting on a stool, holding a tool, wearing an accessory, using a kitchen gadget. Natural indoor or lifestyle environment with soft lighting. Professional product photography, high resolution. No text, no logos. Reference image is for product appearance ONLY—generate a completely new scene with a person.`
    for (let i = 0; i < itr; i++) {
      idx++; const contents = [...baseContents, { text: interactionPrompt }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      interactionImages.push(dataUrl); const iid = `ebay-interaction-${Date.now()}-${i}`; interactionImageIds.push(iid)
      try { saveImageToGallery(email, iid, `${productName || '产品'}·eBay交互图${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }

    deductPoints(email, totalPoints, `eBay产品图 ${count} 张 (${modelName || 'Nano Banana 2'})`)
    const newBalance = getBalance(email)
    return res.json({ mainImage: mainImages[0] || null, mainImages, sceneImages, closeUpImages, sellingPointImages, sellingPointLabels, interactionImages, mainImageIds, sceneImageIds, closeUpImageIds, sellingPointImageIds, interactionImageIds, pointsUsed: totalPoints, newBalance, mainImageId })
  } catch (e) {
    console.error('[eBay Listing] generate-product-images 失败', e.message)
    return res.status(500).json({ error: e.message || '产品图生成失败' })
  }
})

app.post('/api/ai-assistant/ebay/save-listing', requireAuth, (req, res) => {
  try {
    const { name, title, itemSpecifics, description, analyzeResult, mainImageId, productImageIds } = req.body || {}
    if (!title || title.trim() === '') return res.status(400).json({ error: '请提供标题' })
    const email = req.user.email; const created_at = Date.now()
    const specsStr = Array.isArray(itemSpecifics) ? JSON.stringify(itemSpecifics) : '[]'
    const productIdsStr = productImageIds && typeof productImageIds === 'object' ? JSON.stringify(productImageIds) : null
    getDb().prepare(`INSERT INTO ebay_listing_snapshots (user_email, created_at, name, title, item_specifics, description, analyze_result, main_image_id, product_image_ids) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(email, created_at, (name||'').trim().slice(0,200), String(title).trim().slice(0,500), specsStr, String(description||'').slice(0,5000), analyzeResult ? JSON.stringify(analyzeResult) : null, mainImageId||null, productIdsStr)
    const row = getDb().prepare('SELECT id, created_at FROM ebay_listing_snapshots WHERE user_email = ? AND created_at = ?').get(email, created_at)
    return res.json({ id: row?.id, created_at })
  } catch (e) { console.error('[eBay Listing] save 失败', e.message); return res.status(500).json({ error: '保存失败' }) }
})

app.get('/api/ai-assistant/ebay/listings', requireAuth, (req, res) => {
  try {
    const rows = getDb().prepare('SELECT id, created_at, name, title FROM ebay_listing_snapshots WHERE user_email = ? ORDER BY created_at DESC LIMIT 200').all(req.user.email)
    return res.json({ list: rows.map(r => ({ id: r.id, createdAt: r.created_at, name: r.name||'', title: r.title||'', titlePreview: (r.title||'').slice(0,60)+((r.title||'').length>60?'…':'') })) })
  } catch (e) { return res.status(500).json({ error: '获取列表失败' }) }
})

app.get('/api/ai-assistant/ebay/listings/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (Number.isNaN(id)) return res.status(400).json({ error: '无效 id' })
    const row = getDb().prepare('SELECT * FROM ebay_listing_snapshots WHERE id = ? AND user_email = ?').get(id, req.user.email)
    if (!row) return res.status(404).json({ error: '未找到' })
    let itemSpecifics = []; try { itemSpecifics = JSON.parse(row.item_specifics || '[]') } catch (_) {}
    let productImageIds = null; try { productImageIds = row.product_image_ids ? JSON.parse(row.product_image_ids) : null } catch (_) {}
    return res.json({ id: row.id, createdAt: row.created_at, name: row.name||'', title: row.title||'', itemSpecifics, description: row.description||'', analyzeResult: row.analyze_result ? JSON.parse(row.analyze_result) : null, mainImageId: row.main_image_id||null, productImageIds })
  } catch (e) { return res.status(500).json({ error: '获取详情失败' }) }
})

app.delete('/api/ai-assistant/ebay/listings/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (Number.isNaN(id)) return res.status(400).json({ error: '无效 id' })
    const result = getDb().prepare('DELETE FROM ebay_listing_snapshots WHERE id = ? AND user_email = ?').run(id, req.user.email)
    if (result.changes === 0) return res.status(404).json({ error: '未找到' })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ error: '删除失败' }) }
})

// ── AI 运营助手 · eBay Listing 优化 ──────────────────────────────────────────
app.post('/api/ai-assistant/ebay/optimize-listing', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { title, itemSpecifics, description, market, lang } = req.body || {}
    if (!title?.trim() && !description?.trim()) return res.status(400).json({ error: '请粘贴标题或描述' })
    const langLabel = { zh: '中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語', es: 'Español' }[lang] || 'English'
    const marketLabel = (market || 'us').toUpperCase()
    const specsText = Array.isArray(itemSpecifics) && itemSpecifics.length > 0
      ? itemSpecifics.map(s => `${s.name}: ${s.value}`).join('\n')
      : (typeof itemSpecifics === 'string' ? itemSpecifics : '')

    const prompt = `You are an eBay listing optimization expert for the ${marketLabel} market. Analyze the existing listing below, diagnose problems, and output an optimized version.

LANGUAGE RULES (CRITICAL — follow exactly):
1. First, detect the language of the INPUT listing below. Store this as "inputLanguage".
2. "diagnosis" section: Write ALL text in the DETECTED INPUT LANGUAGE.
3. "diagnosisZh" section: Write the SAME content as "diagnosis" but translated into 简体中文. If input is already Chinese, still output diagnosisZh (identical content is fine).
4. "optimized" section: Write entirely in ${langLabel}. If the input language differs from ${langLabel}, translate while optimizing.
5. "analysis" section: Write in ${langLabel}.

=== EXISTING LISTING ===
Title: ${title || '(empty)'}
${specsText ? `Item Specifics:\n${specsText}` : ''}
${description ? `Description:\n${description}` : ''}

=== STEP 1: PRODUCT INTELLIGENCE ===
A. Identify product category, brand (or "Unbranded"), core product term
B. Extract key specs from Item Specifics and description (dimensions, weight, material, etc.)
C. List the top 8-12 high-volume Cassini search keywords for this product type on eBay ${marketLabel}
D. List 3-5 common buyer questions for this product type
E. Note which Item Specifics are missing but important for this category

=== STEP 2: DIAGNOSE ===
Score each area 1-10 and explain issues:

Title diagnosis:
- Length (≤80 chars)? Keyword placement (core keywords in first 3-4 words)?
- Brand handling? Forbidden characters? ALL CAPS words?
- Keyword coverage vs Step 1C keywords?

Item Specifics diagnosis:
- How many provided? Are critical ones missing (Brand, MPN, Type, Material, Color, Size)?
- Item Specifics = Cassini filtered search visibility. Missing = invisible in filtered results.
- For EU: GPSR compliance (manufacturer info, Country/Region of Manufacture)?

Description diagnosis:
- Length (500-2000 chars ideal)? Does it answer buyer questions from Step 1D?
- HTML tags present (should be plain text)?
- External links, contact info, competitor mentions?

Compliance deep scan (output structured objects with level/category/location/text/suggestion):
- [error] Title >80 chars, forbidden chars, ALL CAPS
- [error] Competitor brand misuse, fake certifications
- [error] Medical/pesticide/environmental claims without proof
- [error] Off-site links, contact info in description
- [warning] Missing critical Item Specifics (Brand, MPN, Type)
- [warning] Description contains HTML tags
- [warning] Same keyword repeated >2 times in title
- [info] Title not using full 80 chars, missing high-volume keywords

=== STEP 3: WRITE OPTIMIZED LISTING ===

Title strategy (Cassini-optimized):
- Structure: [Brand] + [Core Product Term] + [Key Attributes/Keywords]
- Front-load highest-volume keyword in first 3-4 words
- Use full 80 chars wisely — eBay has NO backend search terms
- If brand is "Unbranded", omit it and use space for keywords

Item Specifics strategy:
- Minimum 15 key-value pairs; fill ALL relevant standard eBay specifics
- Include: Brand, MPN, Type, Material, Color, Size/Dimensions, Weight, UPC/EAN, Condition, Features
- Add category-specific specifics (e.g. Wattage for electronics, Thread Count for textiles)
- For EU market: add Country/Region of Manufacture for GPSR compliance

Description strategy:
- 800-1500 chars, plain text, NO HTML
- Open with product highlight, then specs, then usage scenarios
- Naturally embed keywords from Step 1C
- Answer buyer questions from Step 1D

Output ONLY valid JSON (no markdown fences):
{
  "inputLanguage": "detected language name",
  "analysis": {
    "productCategory": "category",
    "brand": "brand or Unbranded",
    "coreProductTerm": "main search term",
    "topKeywords": ["keyword1","keyword2","..."],
    "buyerQuestions": ["q1","q2","..."],
    "missingSpecifics": ["specific1","specific2","..."]
  },
  "diagnosis": {
    "overallScore": 7,
    "summary": "1-2 sentence summary of main issues (in input language)",
    "issues": [
      { "area": "Title|Item Specifics|Description", "score": 8, "problem": "...", "suggestion": "..." }
    ],
    "complianceFlags": [
      { "level": "error|warning|info", "category": "...", "location": "...", "text": "...", "suggestion": "..." }
    ]
  },
  "diagnosisZh": { "overallScore": 7, "summary": "...(Chinese)...", "issues": [...], "complianceFlags": [...] },
  "optimized": {
    "title": "optimized eBay title ≤80 chars",
    "itemSpecifics": [{"name":"Brand","value":"..."},{"name":"Type","value":"..."},...],
    "description": "optimized description 800-1500 chars, plain text"
  }
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.optimized) return res.status(500).json({ error: '优化解析失败，请重试' })

    const optimizedTitle = String(out.optimized.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const optimizedSpecs = Array.isArray(out.optimized.itemSpecifics) ? out.optimized.itemSpecifics.slice(0, 30).map(s => ({ name: String(s.name || ''), value: String(s.value || '') })) : []
    const optimizedDesc = stripMarkdown(String(out.optimized.description || '').replace(/<[^>]*>/g, '')).slice(0, 5000)

    console.log('[eBay Listing] 优化完成 | score:', out.diagnosis?.overallScore, '| compliance:', (out.diagnosis?.complianceFlags || []).length)
    return res.json({
      inputLanguage: out.inputLanguage || null,
      analysis: out.analysis || null,
      diagnosis: out.diagnosis,
      diagnosisZh: out.diagnosisZh || null,
      optimized: { title: optimizedTitle, itemSpecifics: optimizedSpecs, description: optimizedDesc },
    })
  } catch (e) {
    console.error('[eBay Listing] optimize-listing 失败', e.message)
    return res.status(500).json({ error: e.message || 'eBay Listing 优化失败，请稍后重试' })
  }
})

// ── AI 运营助手 · 速卖通 Listing 生成 ─────────────────────────────────────────
app.post('/api/ai-assistant/aliexpress/analyze', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { images, category1, category2, brand, sellingPoints, market, lang, keywords, notes } = req.body || {}
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请上传至少一张产品图' })
    const points = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (points.length < 2) return res.status(400).json({ error: '请填写至少 2 条核心卖点' })
    if (!brand?.trim()) return res.status(400).json({ error: '请填写品牌名' })
    const firstImage = images[0]
    const parsed = parseDataUrl(firstImage)
    if (!parsed) return res.status(400).json({ error: '图片格式无效，请重新上传' })

    const langLabel = { zh: '中文', en: 'English', ru: 'Русский', pt: 'Português', es: 'Español', fr: 'Français', de: 'Deutsch', ko: '한국어', ja: '日本語' }[lang] || 'English'
    const marketLabel = (market || 'global').toUpperCase()
    const prompt = `You are an AliExpress listing expert and search optimization specialist. Analyze the product image and user inputs to perform DEEP PRODUCT INTELLIGENCE for AliExpress listing generation.

User inputs:
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Core selling points: ${points.join(' | ')}
- Target market: ${marketLabel}
- Output language: ${langLabel}
${keywords?.trim() ? `- Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Special notes/certifications: ${notes.trim()}` : ''}

AliExpress search facts: Title carries 32.7% search weight. First 60 chars are most important (mobile truncation). Keyword repetition is penalized 15-40%.

Perform these analyses:
1. PRODUCT IDENTIFICATION: name, category, brand (use "无品牌" if unbranded)
2. KEY SPECS EXTRACTION: dimensions, weight, material, certifications — these drive product attributes and search filtering
3. HIGH-VOLUME SEARCH KEYWORDS (8-12): terms AliExpress buyers actually search for this product type in the ${marketLabel} market. Include feature keywords, use-case keywords, audience keywords. Each keyword unique — NO repetition.
4. BUYER QUESTIONS (3-5): common questions AliExpress buyers ask about this product
5. BUYER PERSONAS (2-3): who buys this product and in what scenario

Output a JSON object only (no markdown):
{
  "productName": "short product name in output language",
  "productSummary": "2-4 sentences describing the product, key features, and target use (in output language)",
  "keyAttributes": ["specific attr with data, e.g. 'Stainless Steel 304', '500ml capacity'"],
  "suggestedCategory": "${(category1 || '')} > ${(category2 || '')}",
  "topKeywords": ["search keyword1", "keyword2", "...up to 12"],
  "buyerQuestions": ["question1", "question2", "...up to 5"],
  "buyerPersonas": ["persona1 + scenario", "persona2 + scenario"]
}`

    const contents = [{ inlineData: { mimeType: parsed.mimeType, data: parsed.data } }, { text: prompt }]
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.productSummary) return res.status(500).json({ error: '产品分析解析失败，请重试' })
    console.log('[AliExpress Listing] 分析完成 | 产品:', out.productName, '| keywords:', (out.topKeywords || []).length)
    return res.json({ productName: out.productName || '', productSummary: out.productSummary || '', keyAttributes: Array.isArray(out.keyAttributes) ? out.keyAttributes : [], suggestedCategory: out.suggestedCategory || `${category1 || ''} > ${category2 || ''}`, topKeywords: Array.isArray(out.topKeywords) ? out.topKeywords : [], buyerQuestions: Array.isArray(out.buyerQuestions) ? out.buyerQuestions : [], buyerPersonas: Array.isArray(out.buyerPersonas) ? out.buyerPersonas : [] })
  } catch (e) {
    console.error('[AliExpress Listing] analyze 失败', e.message)
    return res.status(500).json({ error: e.message || '产品分析失败' })
  }
})

app.post('/api/ai-assistant/aliexpress/generate-listing', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { analyzeResult, category1, category2, brand, sellingPoints, market, lang, keywords, notes } = req.body || {}
    if (!analyzeResult?.productSummary) return res.status(400).json({ error: '请先完成产品分析' })
    const points = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(s => s.trim()).filter(Boolean) : [])
    if (points.length < 2) return res.status(400).json({ error: '请提供至少 2 条核心卖点' })
    if (!brand?.trim()) return res.status(400).json({ error: '请提供品牌名' })

    const langLabel = { zh: '中文', en: 'English', ru: 'Русский', pt: 'Português', es: 'Español', fr: 'Français', de: 'Deutsch', ko: '한국어', ja: '日本語' }[lang] || 'English'
    const marketLabel = (market || 'global').toUpperCase()
    const prompt = `You are an AliExpress listing copywriter and search optimization expert. Generate a strategy-driven listing in ${langLabel} for AliExpress ${marketLabel} market.

=== PRODUCT INTELLIGENCE (from analysis step) ===
- Product name: ${analyzeResult.productName || ''}
- Summary: ${analyzeResult.productSummary}
- Key attributes: ${(analyzeResult.keyAttributes || []).join(', ')}
- Top search keywords: ${(analyzeResult.topKeywords || []).join(', ')}
- Buyer questions: ${(analyzeResult.buyerQuestions || []).join(' | ')}
- Buyer personas: ${(analyzeResult.buyerPersonas || []).join(' | ')}
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Selling points: ${points.join(' | ')}
${keywords?.trim() ? `- Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Notes: ${notes.trim()}` : ''}

=== TITLE STRATEGY (AliExpress search optimized, ≤128 chars) ===
- Title = 32.7% of search relevance — the #1 ranking factor
- First 60 chars (mobile truncation): [Brand if applicable] + [Core Product Term] + [#1 keyword from topKeywords]
- Remaining chars: weave in 4-6 more keywords from topKeywords naturally
- Each keyword appears ONLY ONCE — repetition is penalized 15-40%
- If brand is "NONE"/"无品牌"/"Unbranded", omit brand and use space for keywords
- No ALL CAPS except brand acronyms

=== PRODUCT ATTRIBUTES STRATEGY (15-25 key-value pairs) ===
- MUST include: Brand ("无品牌" if unbranded), Material, Type, Color, Size, Weight, Origin
- Add: Features, Applicable Scenarios, Season, Target Audience, Style
- Embed keywords from topKeywords into relevant attribute values
- For EU: add Certification attribute with actual certifications only
- Never fabricate brand name — unbranded = "无品牌" or "NONE"

=== DESCRIPTION STRATEGY (800-2000 chars, mobile-optimized, NO HTML) ===
- Paragraph 1: Hook — lead with #1 benefit addressing buyer question #1 from buyerQuestions
- Paragraph 2: Key features + specs from keyAttributes with concrete data
- Paragraph 3: Usage scenario from buyerPersonas — paint buyer using the product
- Paragraph 4: Package contents + care/maintenance tips
- Short paragraphs for mobile readability
- Naturally embed keywords from topKeywords — no stuffing
- No competitor mentions, no external links, no contact info

=== COMPLIANCE ===
- Never claim certifications not explicitly provided
- EU: CE is mandatory. UK: UKCA since Jan 2023
- No promotional claims: "best seller", "#1", "guaranteed"

Output ONLY valid JSON (no markdown):
{
  "title": "AliExpress title, ≤128 chars, in ${langLabel}",
  "productAttributes": [{"name":"Brand","value":"..."},{"name":"Material","value":"..."},{"name":"Type","value":"..."},...],
  "description": "product description, 800-2000 chars, plain text, in ${langLabel}"
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.title) return res.status(500).json({ error: 'Listing 生成解析失败，请重试' })
    const title = String(out.title || '').replace(/\s+/g, ' ').trim().slice(0, 128)
    const productAttributes = Array.isArray(out.productAttributes) ? out.productAttributes.slice(0, 30).map(s => ({ name: String(s.name || ''), value: String(s.value || '') })) : []
    const description = stripMarkdown(String(out.description || '').replace(/<[^>]*>/g, '')).slice(0, 5000)
    console.log('[AliExpress Listing] 生成完成 | title length:', title.length, '| attrs:', productAttributes.length)
    return res.json({ title, productAttributes, description })
  } catch (e) {
    console.error('[AliExpress Listing] generate-listing 失败', e.message)
    return res.status(500).json({ error: e.message || 'Listing 生成失败' })
  }
})

app.post('/api/ai-assistant/aliexpress/generate-product-images', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { productImage, productName, brand, model: modelName, mainCount, sceneCount, closeUpCount, sellingPoints, sellingPointCount, sellingPointShowText, interactionCount, lang } = req.body || {}
    if (!productImage) return res.status(400).json({ error: '请提供产品图' })
    const parsed = parseDataUrl(productImage)
    if (!parsed) return res.status(400).json({ error: '产品图格式无效' })

    const sellingPointsArr = Array.isArray(sellingPoints) ? sellingPoints : (typeof sellingPoints === 'string' ? sellingPoints.split(/\n/).map(x => x.trim()).filter(Boolean) : [])
    let sp = Math.min(Math.max(0, parseInt(sellingPointCount, 10) || 0), sellingPointsArr.length)
    let m = Math.min(4, Math.max(0, parseInt(mainCount, 10) || 0))
    let s = Math.min(4, Math.max(0, parseInt(sceneCount, 10) || 0))
    let c = Math.min(4, Math.max(0, parseInt(closeUpCount, 10) || 0))
    let itr = Math.min(4, Math.max(0, parseInt(interactionCount, 10) || 0))
    if (m + s + c + sp + itr === 0) return res.status(400).json({ error: '请至少选择一类图片并设置数量≥1' })

    const count = m + s + c + sp + itr
    const pointsPerImg = getPointsPerImage(modelName || 'Nano Banana 2', '1K 标准')
    const totalPoints = count * pointsPerImg
    const email = req.user.email
    const balance = getBalance(email)
    if (balance < totalPoints) return res.status(402).json({ error: '积分不足', required: totalPoints, balance })

    const ai = new GoogleGenAI({ apiKey })
    const imageModelId = getImageModelId(modelName || 'Nano Banana 2')
    const is25Image = imageModelId === 'gemini-2.5-flash-image'
    const imageConfig = is25Image ? { aspectRatio: '1:1' } : { aspectRatio: '1:1', imageSize: '1K' }
    const genCfg = { responseModalities: ['TEXT', 'IMAGE'], imageConfig }
    const noTextRule = `CRITICAL: Pure product PHOTO with NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks.`
    const baseContents = [{ inlineData: { mimeType: parsed.mimeType, data: parsed.data } }]
    const productCtx = `Product: ${productName || 'product'}. Brand context: ${brand || ''}.`

    const mainImages = [], sceneImages = [], closeUpImages = [], sellingPointImages = [], sellingPointLabels = [], interactionImages = []
    const mainImageIds = [], sceneImageIds = [], closeUpImageIds = [], sellingPointImageIds = [], interactionImageIds = []
    let mainImageId = null, idx = 0

    for (let i = 0; i < m; i++) {
      idx++; const contents = [...baseContents, { text: `${noTextRule} --- AliExpress main image: Pure white background. ${productCtx} Product fills ~85% frame, centered. Professional studio photo. Square format preferred.` }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      mainImages.push(dataUrl); const id = `ali-main-${Date.now()}-${i}`; if (i === 0) mainImageId = id; mainImageIds.push(id)
      try { saveImageToGallery(email, id, `${productName || '产品'}·速卖通主图${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    for (let i = 0; i < s; i++) {
      idx++; const contents = [...baseContents, { text: `${noTextRule} --- AliExpress scene image: Product in lifestyle setting. ${productCtx} Professional photography. No text.` }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      sceneImages.push(dataUrl); const sid = `ali-scene-${Date.now()}-${i}`; sceneImageIds.push(sid)
      try { saveImageToGallery(email, sid, `${productName || '产品'}·速卖通场景${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    for (let i = 0; i < c; i++) {
      idx++; const closeUpPrompt = `${noTextRule} --- AliExpress detail/close-up image: Same product. Create a NEW image. Extreme close-up or macro shot showing product details, texture, materials, quality, craftsmanship. Highlight key features. Pure white or soft gradient studio background. Professional product photography, high resolution. No text, no logos. ${productCtx} CRITICAL: Use the reference ONLY for the product's appearance. Do NOT copy its background, table, room, or any unrelated elements. Generate a completely new, clean composition with enhanced detail and texture.`
      const contents = [...baseContents, { text: closeUpPrompt }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      closeUpImages.push(dataUrl); const cid = `ali-closeup-${Date.now()}-${i}`; closeUpImageIds.push(cid)
      try { saveImageToGallery(email, cid, `${productName || '产品'}·速卖通特写${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    const langName = { zh: 'Chinese', en: 'English', ru: 'Russian', pt: 'Portuguese', es: 'Spanish', fr: 'French', de: 'German', ko: 'Korean', ja: 'Japanese' }[lang] || 'English'
    for (let i = 0; i < sp; i++) {
      idx++; const pointText = sellingPointsArr[i] || ''
      const textRule = sellingPointShowText
        ? `CRITICAL - Text on image: This image MUST display the selling point text clearly and elegantly. The text MUST be in ${langName}. The content is: "${pointText}". If the original text is in another language, translate it to ${langName} first, then render the translated text. Place the text with sufficient margins (8–12% from edges), large readable typography, high contrast, no clipping.`
        : noTextRule
      const noTextSuffix = sellingPointShowText ? '' : ' No text, no logos.'
      const contents = [...baseContents, { text: `${textRule} --- AliExpress selling-point image: Same product. This image must visually showcase THIS specific selling point: "${pointText}". ${productCtx} Create a NEW professional product photo that illustrates the benefit or feature—e.g. if the point is about stackability, show multiple stacked units; if about durability, show texture or structure close-up; if about portability, show in-hand or compact size comparison. Pure white or soft gradient studio background. Professional product photography, high resolution.${noTextSuffix} Reference image is for product appearance ONLY—do NOT simply copy or overlay text on the reference image. Generate a completely new composition. Product surface dry, no water or droplets. Physically correct placement (e.g. stool on floor, not floating).` }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      sellingPointImages.push(dataUrl); sellingPointLabels.push(pointText)
      const spid = `ali-sp-${Date.now()}-${i}`; sellingPointImageIds.push(spid)
      try { saveImageToGallery(email, spid, `${productName || '产品'}·速卖通卖点${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }
    const interactionPrompt = `${noTextRule} --- Human-product interaction image: Show a real person naturally using, holding, or interacting with this product in a realistic setting. ${productCtx} The person should be partially visible (hands, arms, or upper body)—focus on the interaction, not the person's face. Show genuine usage: e.g. sitting on a stool, holding a tool, wearing an accessory, using a kitchen gadget. Natural indoor or lifestyle environment with soft lighting. Professional product photography, high resolution. No text, no logos. Reference image is for product appearance ONLY—generate a completely new scene with a person.`
    for (let i = 0; i < itr; i++) {
      idx++; const contents = [...baseContents, { text: interactionPrompt }]
      const resp = await ai.models.generateContent({ model: imageModelId, contents, config: genCfg })
      const part = resp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!part) return res.status(500).json({ error: `第 ${idx} 张生成失败` })
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      interactionImages.push(dataUrl); const iid = `ali-interaction-${Date.now()}-${i}`; interactionImageIds.push(iid)
      try { saveImageToGallery(email, iid, `${productName || '产品'}·速卖通交互图${i+1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准') } catch (e) { console.error(e.message) }
    }

    deductPoints(email, totalPoints, `速卖通产品图 ${count} 张 (${modelName || 'Nano Banana 2'})`)
    const newBalance = getBalance(email)
    return res.json({ mainImage: mainImages[0] || null, mainImages, sceneImages, closeUpImages, sellingPointImages, sellingPointLabels, interactionImages, mainImageIds, sceneImageIds, closeUpImageIds, sellingPointImageIds, interactionImageIds, pointsUsed: totalPoints, newBalance, mainImageId })
  } catch (e) {
    console.error('[AliExpress Listing] generate-product-images 失败', e.message)
    return res.status(500).json({ error: e.message || '产品图生成失败' })
  }
})

app.post('/api/ai-assistant/aliexpress/save-listing', requireAuth, (req, res) => {
  try {
    const { name, title, productAttributes, description, analyzeResult, mainImageId, productImageIds } = req.body || {}
    if (!title || title.trim() === '') return res.status(400).json({ error: '请提供标题' })
    const email = req.user.email; const created_at = Date.now()
    const attrsStr = Array.isArray(productAttributes) ? JSON.stringify(productAttributes) : '[]'
    const productIdsStr = productImageIds && typeof productImageIds === 'object' ? JSON.stringify(productImageIds) : null
    getDb().prepare(`INSERT INTO aliexpress_listing_snapshots (user_email, created_at, name, title, product_attributes, description, analyze_result, main_image_id, product_image_ids) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(email, created_at, (name||'').trim().slice(0,200), String(title).trim().slice(0,500), attrsStr, String(description||'').slice(0,5000), analyzeResult ? JSON.stringify(analyzeResult) : null, mainImageId||null, productIdsStr)
    const row = getDb().prepare('SELECT id, created_at FROM aliexpress_listing_snapshots WHERE user_email = ? AND created_at = ?').get(email, created_at)
    return res.json({ id: row?.id, created_at })
  } catch (e) { console.error('[AliExpress Listing] save 失败', e.message); return res.status(500).json({ error: '保存失败' }) }
})

app.get('/api/ai-assistant/aliexpress/listings', requireAuth, (req, res) => {
  try {
    const rows = getDb().prepare('SELECT id, created_at, name, title FROM aliexpress_listing_snapshots WHERE user_email = ? ORDER BY created_at DESC LIMIT 200').all(req.user.email)
    return res.json({ list: rows.map(r => ({ id: r.id, createdAt: r.created_at, name: r.name||'', title: r.title||'', titlePreview: (r.title||'').slice(0,60)+((r.title||'').length>60?'…':'') })) })
  } catch (e) { return res.status(500).json({ error: '获取列表失败' }) }
})

app.get('/api/ai-assistant/aliexpress/listings/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (Number.isNaN(id)) return res.status(400).json({ error: '无效 id' })
    const row = getDb().prepare('SELECT * FROM aliexpress_listing_snapshots WHERE id = ? AND user_email = ?').get(id, req.user.email)
    if (!row) return res.status(404).json({ error: '未找到' })
    let productAttributes = []; try { productAttributes = JSON.parse(row.product_attributes || '[]') } catch (_) {}
    let productImageIds = null; try { productImageIds = row.product_image_ids ? JSON.parse(row.product_image_ids) : null } catch (_) {}
    return res.json({ id: row.id, createdAt: row.created_at, name: row.name||'', title: row.title||'', productAttributes, description: row.description||'', analyzeResult: row.analyze_result ? JSON.parse(row.analyze_result) : null, mainImageId: row.main_image_id||null, productImageIds })
  } catch (e) { return res.status(500).json({ error: '获取详情失败' }) }
})

app.delete('/api/ai-assistant/aliexpress/listings/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (Number.isNaN(id)) return res.status(400).json({ error: '无效 id' })
    const result = getDb().prepare('DELETE FROM aliexpress_listing_snapshots WHERE id = ? AND user_email = ?').run(id, req.user.email)
    if (result.changes === 0) return res.status(404).json({ error: '未找到' })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ error: '删除失败' }) }
})

// ── AI 运营助手 · 速卖通 Listing 优化 ────────────────────────────────────────
app.post('/api/ai-assistant/aliexpress/optimize-listing', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { title, productAttributes, description, market, lang } = req.body || {}
    if (!title?.trim() && !description?.trim()) return res.status(400).json({ error: '请粘贴标题或描述' })
    const langLabel = { zh: '中文', en: 'English', ru: 'Русский', pt: 'Português', es: 'Español', fr: 'Français', de: 'Deutsch', ko: '한국어', ja: '日本語' }[lang] || 'English'
    const marketLabel = (market || 'global').toUpperCase()
    const attrsText = Array.isArray(productAttributes) && productAttributes.length > 0
      ? productAttributes.map(a => `${a.name}: ${a.value}`).join('\n')
      : (typeof productAttributes === 'string' ? productAttributes : '')

    const prompt = `You are an AliExpress listing optimization expert for the ${marketLabel} market. Analyze the existing listing, diagnose problems, and output an optimized version.

LANGUAGE RULES (CRITICAL — follow exactly):
1. First, detect the language of the INPUT listing below. Store this as "inputLanguage".
2. "diagnosis" section: Write ALL text in the DETECTED INPUT LANGUAGE.
3. "diagnosisZh" section: Write the SAME content as "diagnosis" but translated into 简体中文. If input is already Chinese, still output diagnosisZh (identical content is fine).
4. "optimized" section: Write entirely in ${langLabel}. If the input language differs from ${langLabel}, translate while optimizing.
5. "analysis" section: Write in ${langLabel}.

=== EXISTING LISTING ===
Title: ${title || '(empty)'}
${attrsText ? `Product Attributes:\n${attrsText}` : ''}
${description ? `Description:\n${description}` : ''}

=== STEP 1: PRODUCT INTELLIGENCE ===
A. Identify product category, brand (or "无品牌"), core product term
B. Extract key specs from attributes and description
C. List the top 8-12 high-volume AliExpress search keywords for this product type
D. List 3-5 common buyer questions for this product type
E. Note which product attributes are missing but important for this category

AliExpress search algorithm facts:
- Title carries 32.7% of search relevance weight — it's the #1 ranking factor
- First 60 characters carry the highest weight (mobile truncation point)
- Keyword repetition is penalized (15-40% ranking drop)
- Product attributes directly affect category filtering visibility
- NO backend search terms — all keywords MUST be in title + attributes

=== STEP 2: DIAGNOSE ===
Score each area 1-10:

Title diagnosis:
- Length (≤128 chars)? Are first 60 chars optimized for mobile?
- Core product keywords placed early enough?
- Keyword repetition (penalized by algorithm)?
- Brand handling (if unbranded, is space wasted on "无品牌")?

Product Attributes diagnosis:
- How many provided? Missing critical ones (Brand, Material, Type, Color, Size)?
- Attributes directly power category filtering — missing = invisible in filtered results
- For EU market: CE certification attribute needed?

Description diagnosis:
- Length (500-3000 chars ideal)? Mobile-friendly short paragraphs?
- Does it answer buyer questions from Step 1D?
- Package contents listed? Specifications included?
- External links, contact info (forbidden)?

Compliance deep scan (structured objects):
- [error] Title >128 chars, keyword stuffing (same word >2 times)
- [error] Fake brand name for unbranded product
- [error] Medical/pesticide/environmental claims without certification
- [error] External links, contact info, competitor mentions
- [error] Claiming CE/UKCA/CPC certification not provided
- [warning] Missing critical attributes (Brand, Material, Type)
- [warning] Description >3000 chars or <300 chars
- [warning] Title first 60 chars don't contain core product keyword
- [info] Not using full 128-char title space, missing high-volume keywords

=== STEP 3: WRITE OPTIMIZED LISTING ===

Title strategy (AliExpress search optimized):
- First 60 chars: [Brand if applicable] + [Core Product Term] + [#1 keyword]
- Remaining chars: additional keywords, attributes, use cases
- ≤128 chars total, each keyword appears only once
- If unbranded: omit brand, start with core product term

Product Attributes strategy:
- Minimum 15 key-value pairs
- Include: Brand, Material, Type, Color, Size, Weight, Origin, Features, Applicable Scenarios, Target Audience, Season
- For EU: add Certification attribute with actual certifications
- Category-specific attributes (e.g. Battery for electronics, Fabric Type for clothing)

Description strategy:
- 800-2000 chars, mobile-optimized short paragraphs
- Structure: hook → key features → specifications → package contents → usage tips
- Naturally embed keywords from Step 1C
- Answer buyer questions from Step 1D

Output ONLY valid JSON (no markdown fences):
{
  "inputLanguage": "detected language name",
  "analysis": {
    "productCategory": "category",
    "brand": "brand or 无品牌",
    "coreProductTerm": "main search term",
    "topKeywords": ["keyword1","keyword2","..."],
    "buyerQuestions": ["q1","q2","..."],
    "missingAttributes": ["attr1","attr2","..."]
  },
  "diagnosis": {
    "overallScore": 7,
    "summary": "1-2 sentence summary (in input language)",
    "issues": [
      { "area": "Title|Product Attributes|Description", "score": 8, "problem": "...", "suggestion": "..." }
    ],
    "complianceFlags": [
      { "level": "error|warning|info", "category": "...", "location": "...", "text": "...", "suggestion": "..." }
    ]
  },
  "diagnosisZh": { "overallScore": 7, "summary": "...(Chinese)...", "issues": [...], "complianceFlags": [...] },
  "optimized": {
    "title": "optimized AliExpress title ≤128 chars",
    "productAttributes": [{"name":"Brand","value":"..."},{"name":"Material","value":"..."},...],
    "description": "optimized description 800-2000 chars"
  }
}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
    const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
    const out = extractAnalyzeJson(text, true)
    if (!out || !out.optimized) return res.status(500).json({ error: '优化解析失败，请重试' })

    const optimizedTitle = String(out.optimized.title || '').replace(/\s+/g, ' ').trim().slice(0, 128)
    const optimizedAttrs = Array.isArray(out.optimized.productAttributes) ? out.optimized.productAttributes.slice(0, 30).map(a => ({ name: String(a.name || ''), value: String(a.value || '') })) : []
    const optimizedDesc = stripMarkdown(String(out.optimized.description || '').replace(/<[^>]*>/g, '')).slice(0, 5000)

    console.log('[AliExpress Listing] 优化完成 | score:', out.diagnosis?.overallScore, '| compliance:', (out.diagnosis?.complianceFlags || []).length)
    return res.json({
      inputLanguage: out.inputLanguage || null,
      analysis: out.analysis || null,
      diagnosis: out.diagnosis,
      diagnosisZh: out.diagnosisZh || null,
      optimized: { title: optimizedTitle, productAttributes: optimizedAttrs, description: optimizedDesc },
    })
  } catch (e) {
    console.error('[AliExpress Listing] optimize-listing 失败', e.message)
    return res.status(500).json({ error: e.message || '速卖通 Listing 优化失败，请稍后重试' })
  }
})

// ── 管理员 API ────────────────────────────────────────────────────────────────

// 客户列表（含余额、订阅到期时间、总消耗）
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const users = getDb().prepare('SELECT email, role, created_at FROM users ORDER BY created_at DESC').all()
    const result = users.map((u) => {
      const info = getSubscriptionInfo(u.email)
      const spentRow = getDb()
        .prepare('SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM points_transactions WHERE user_email = ? AND amount < 0')
        .get(u.email)
      return {
        email: u.email,
        role: u.role,
        createdAt: u.created_at,
        balance: info.balance,
        expiresAt: info.expiresAt,
        lastGrantedAt: info.lastGrantedAt,
        totalSpent: spentRow?.total ?? 0,
      }
    })
    return res.json({ users: result })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '获取客户列表失败' })
  }
})

// 给指定客户充值积分并设置有效期
app.post('/api/admin/users/:email/grant', requireAdmin, (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase()
    const amount = parseInt(req.body?.amount, 10)
    const days = parseInt(req.body?.days, 10) || 30
    if (!amount || amount <= 0) return res.status(400).json({ error: '请填写有效积分数量' })
    const user = dbFindUser(targetEmail)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    const newBalance = grantPoints(targetEmail, amount, days)
    console.log(`[Admin] ${req.user.email} 给 ${targetEmail} 充值 ${amount} 积分，有效期 ${days} 天，剩余: ${newBalance}`)
    return res.json({ balance: newBalance, expiresAt: Date.now() + days * 24 * 60 * 60 * 1000 })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '充值失败' })
  }
})

// 删除客户（同时清除积分、流水、该用户的仓库图片与文件，重注册后积分为 0）
app.delete('/api/admin/users/:email', requireAdmin, (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase()
    if (targetEmail === req.user.email) return res.status(400).json({ error: '不能删除自己的账号' })
    const user = dbFindUser(targetEmail)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    const db = getDb()
    // 删除该用户所有仓库记录，并删本地文件与 COS 对象
    const galleryRows = db.prepare('SELECT file_path, cos_key FROM gallery WHERE user_email = ?').all(targetEmail)
    for (const row of galleryRows) {
      const fullPath = join(__dirname, row.file_path)
      if (existsSync(fullPath)) try { unlinkSync(fullPath) } catch (e) { console.error('[Admin] 删本地图失败', row.file_path, e.message) }
      if (row.cos_key && isCosEnabled()) deleteFromCos(row.cos_key).catch((e) => console.error('[Admin] 删 COS 对象失败', row.cos_key, e.message))
    }
    db.prepare('DELETE FROM gallery WHERE user_email = ?').run(targetEmail)
    db.prepare('DELETE FROM users WHERE email = ?').run(targetEmail)
    db.prepare('DELETE FROM user_points WHERE user_email = ?').run(targetEmail)
    db.prepare('DELETE FROM points_transactions WHERE user_email = ?').run(targetEmail)
    console.log(`[Admin] ${req.user.email} 删除了用户 ${targetEmail}（含 ${galleryRows.length} 张仓库图）`)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '删除失败' })
  }
})

// 一次性清理「用户已删除但仓库记录/文件仍在」的孤儿数据（管理员专用）
app.post('/api/admin/cleanup-orphan-gallery', requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const existingEmails = new Set(db.prepare('SELECT email FROM users').all().map((r) => r.email))
    const allGallery = db.prepare('SELECT id, user_email, file_path, cos_key FROM gallery').all()
    const orphanRows = allGallery.filter((r) => !existingEmails.has(r.user_email))
    let deleted = 0
    for (const row of orphanRows) {
      const fullPath = join(__dirname, row.file_path)
      if (existsSync(fullPath)) try { unlinkSync(fullPath) } catch (e) { console.error('[Admin] 删孤儿图失败', row.file_path, e.message) }
      if (row.cos_key && isCosEnabled()) deleteFromCos(row.cos_key).catch((e) => console.error('[Admin] 删孤儿 COS 失败', row.cos_key, e.message))
      db.prepare('DELETE FROM gallery WHERE id = ? AND user_email = ?').run(row.id, row.user_email)
      deleted++
    }
    if (deleted > 0) console.log(`[Admin] ${req.user.email} 清理了 ${deleted} 条孤儿仓库记录`)
    return res.json({ ok: true, deleted })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '清理失败' })
  }
})

// 查看某客户的积分流水
app.get('/api/admin/users/:email/transactions', requireAdmin, (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase()
    const items = getTransactions(targetEmail, 200)
    return res.json({ items })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '获取流水失败' })
  }
})

// 修改用户角色（升/降 admin）
app.patch('/api/admin/users/:email/role', requireAdmin, (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase()
    const { role } = req.body
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: '无效角色' })
    if (targetEmail === req.user.email) return res.status(400).json({ error: '不能修改自己的角色' })
    const user = dbFindUser(targetEmail)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    getDb().prepare('UPDATE users SET role = ? WHERE email = ?').run(role, targetEmail)
    return res.json({ ok: true, role })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '修改角色失败' })
  }
})

// 启动时迁移用户数据并确保管理员账号
dbMigrateFromJson()
dbEnsureAdmin()

app.listen(PORT, () => {
  console.log('')
  console.log('  [后端 API] Server running at http://localhost:' + PORT)
  console.log('  (这是后端，不要关；前端在另一个终端 npm run dev)')
  console.log('')
})
