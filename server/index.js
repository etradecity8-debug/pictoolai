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
import { createHash } from 'crypto'
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
  getSubscriptionInfo,
} from './points.js'

setGetDb(getDb)

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'pictoolai-dev-secret-change-in-production'

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

// 积分：充值（测试用，登录后可给自己充值）
app.post('/api/points/credit', requireAuth, (req, res) => {
  try {
    const amount = Math.max(0, parseInt(req.body?.amount, 10) || 0)
    if (amount <= 0) return res.status(400).json({ error: '请填写有效充值数量' })
    addBalance(req.user.email, amount)
    addTransaction(req.user.email, amount, '充值')
    const balance = getBalance(req.user.email)
    return res.json({ balance })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '充值失败' })
  }
})

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

/** 将一张图片写入仓库（文件 + 数据库），pointsUsed/model/clarity 可选，生图扣积分时传入 */
function saveImageToGallery(email, id, title, dataUrl, pointsUsed = null, model = null, clarity = null) {
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
  getDb().prepare('INSERT INTO gallery (id, user_email, title, file_path, saved_at, points_used, model, clarity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, email, title || '未命名', filePath, savedAt, pointsUsed != null ? pointsUsed : null, model || null, clarity || null)
}

// 保存图片到仓库：dataUrl 转为文件，元数据写入 SQLite
app.post('/api/gallery', requireAuth, (req, res) => {
  try {
    const { image: dataUrl, title } = req.body || {}
    const parsed = parseDataUrl(dataUrl)
    if (!parsed || !parsed.data) {
      return res.status(400).json({ error: '请提供有效的图片数据' })
    }
    const email = req.user.email
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    saveImageToGallery(email, id, title || '未命名', dataUrl)
    return res.json({ id })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '保存失败' })
  }
})

// 拉取当前用户的仓库列表（从数据库读取）
app.get('/api/gallery', requireAuth, (req, res) => {
  try {
    const email = req.user.email
    const rows = getDb().prepare('SELECT id, title, saved_at AS savedAt, points_used AS pointsUsed, model, clarity FROM gallery WHERE user_email = ? ORDER BY saved_at DESC').all(email)
    const list = rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: `/api/gallery/image/${row.id}`,
      savedAt: row.savedAt,
      pointsUsed: row.pointsUsed != null ? row.pointsUsed : undefined,
      model: row.model != null && String(row.model).trim() ? String(row.model).trim() : undefined,
      clarity: row.clarity != null && String(row.clarity).trim() ? String(row.clarity).trim() : undefined,
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

// 从仓库删除一张（删数据库记录 + 删文件）
app.delete('/api/gallery/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params
    const email = req.user.email
    const row = getDb().prepare('SELECT file_path FROM gallery WHERE id = ? AND user_email = ?').get(id, email)
    if (!row) return res.status(404).json({ error: '图片不存在' })
    const fullPath = join(__dirname, row.file_path)
    if (existsSync(fullPath)) unlinkSync(fullPath)
    getDb().prepare('DELETE FROM gallery WHERE id = ? AND user_email = ?').run(id, email)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '删除失败' })
  }
})

// ---------- 修改图片（7种模式） ----------
app.post('/api/image-edit', async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { mode, prompt, images, model: modelName, aspectRatio, clarity } = req.body
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: '请填写修改指令' })
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: '请上传至少一张图片' })

    // 解析所有参考图
    const parsedImages = images.map((img) => parseDataUrl(img)).filter(Boolean)
    if (parsedImages.length === 0) return res.status(400).json({ error: '图片格式无效，请重新上传' })

    // 推荐模型：Nano Banana 2；也支持 Pro
    const modelId = getImageModelId(modelName || 'Nano Banana 2')
    const is25Image = modelId === 'gemini-2.5-flash-image'
    const { clarity: resolvedClarity } = normalizeClarityForModel(modelName || 'Nano Banana 2', clarity || '1K 标准')
    const imageSize = CLARITY_TO_SIZE[resolvedClarity] || '1K'
    const aspectRatioVal = String(ASPECT_RATIO_MAP[aspectRatio] || '1:1')
    const imageConfig = is25Image
      ? { aspectRatio: aspectRatioVal }
      : { aspectRatio: aspectRatioVal, imageSize: String(imageSize) }

    console.log('[后端 API] 修改图片 mode:', mode, '模型:', modelId, 'imageConfig:', JSON.stringify(imageConfig))

    const ai = new GoogleGenAI({ apiKey })
    const isHeavy = modelId.includes('pro') || modelId.includes('3.1')
    const maxTries = isHeavy ? 3 : 2
    const genConfig = { responseModalities: ['TEXT', 'IMAGE'], imageConfig }

    // 所有模式统一使用单次 generateContent：图片 + 指令一并发送
    // 多轮 chat 方案因 Nano Banana 2 的 thought_signature 机制报 400，已放弃
    const contents = [
      ...parsedImages.map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.data } })),
      { text: prompt.trim() },
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
    const pointsUsed = getPointsPerImage(modelName || 'Nano Banana 2', resolvedClarity || '1K 标准')
    let newBalance = null
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET)
        const email = payload.email
        const balance = getBalance(email)
        if (balance < pointsUsed) {
          return res.status(402).json({ error: '积分不足', required: pointsUsed, balance })
        }
        deductPoints(email, pointsUsed, `修改图片 (${modelName || 'Nano Banana 2'}, ${resolvedClarity || '1K 标准'}, ${mode})`)
        newBalance = getBalance(email)
        const imgId = `edit-${Date.now()}`
        const modeLabel = {
          'add-remove': '添加/移除元素', inpainting: '局部重绘', 'style-transfer': '风格迁移',
          composition: '高级合成', 'hi-fidelity': '高保真细节', 'bring-to-life': '让草图变生动',
          'character-360': '角色一致性', 'text-replace': '文字替换', 'text-translate': '文字翻译',
        }[mode] || mode
        try {
          saveImageToGallery(email, imgId, `修改图片·${modeLabel}`, resultDataUrl, pointsUsed, modelName || null, resolvedClarity || null)
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
    const prompt = `You are an Amazon listing expert. Analyze the product image and user inputs to output a structured product summary for the next step (title, bullets, description generation).

User inputs:
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Core selling points (one per line): ${points.join(' | ')}
- Target market: ${marketLabel}
- Output language: ${langLabel}
${keywords?.trim() ? `- Reference keywords: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Special notes/certifications: ${notes.trim()}` : ''}

Output a JSON object only (no markdown):
{
  "productName": "short product name in output language",
  "productSummary": "2-4 sentences describing the product, key features, and target use (in output language)",
  "keyAttributes": ["attr1", "attr2", "attr3"],
  "suggestedCategory": "${(category1 || '')} > ${(category2 || '')}"
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
    console.log('[Amazon Listing] 分析完成 | 产品:', out.productName)
    return res.json({
      productName: out.productName || '',
      productSummary: out.productSummary || '',
      keyAttributes: Array.isArray(out.keyAttributes) ? out.keyAttributes : [],
      suggestedCategory: out.suggestedCategory || `${category1 || ''} > ${category2 || ''}`,
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
    const prompt = `You are an Amazon listing copywriter. Generate a full listing in ${langLabel} that complies with Amazon policy.

Amazon rules (MUST follow):

Title (effective 2025):
- Max 200 characters. Put brand + core product + key attributes in first 80 characters for search.
- No ALL CAPS, no competitor brands, no keyword stuffing.
- Do not repeat the same word more than twice (except articles, prepositions, conjunctions like "and", "the", "of").
- Do not use these characters unless part of brand name: ! $ ? _ { } ^ ¬ ¦

Bullet points (5 items):
- Each bullet max 500 characters (some categories limit to 255 — prefer concise under 255 when possible).
- No price, promotion, or off-site links; no exaggerated or medical/unsupported claims.
- No special characters (™ ® €) or emojis; no repetition of content across bullets.
- No ASIN, "N/A", "TBD", or "not applicable"; no company info, contact details, or website links.
- No refund/guarantee language; no prohibited marketing phrases (e.g. eco-friendly, anti-bacterial, bamboo, soy unless product is certified). Each bullet = one clear benefit or answer to a customer question.

Product description:
- Max 2000 characters. Do not duplicate bullets; no off-site links, contact info, or prohibited words.
- No competitor comparison; no "best seller" or "top-rated" type claims.

Search terms (backend keywords):
- Max 250 bytes total. Do NOT repeat words already in title or bullets; comma or space separated; no competitor brands.

Optimize for: A9 search relevance, Cosmo discovery, Rufus Q&A style bullets, GEO/localization for ${marketLabel}.

Input:
- Product summary from analysis: ${analyzeResult.productSummary}
- Product name: ${analyzeResult.productName || ''}
- Key attributes: ${(analyzeResult.keyAttributes || []).join(', ')}
- Category: ${category1 || ''} > ${category2 || ''}
- Brand: ${brand.trim()}
- Selling points: ${points.join(' | ')}
${keywords?.trim() ? `- Reference keywords to include where relevant: ${keywords.trim()}` : ''}
${notes?.trim() ? `- Notes: ${notes.trim()}` : ''}

Output ONLY valid JSON (no markdown):
{
  "title": "full title string, ≤200 chars, in ${langLabel}",
  "searchTerms": "comma or space separated backend keywords, ≤250 bytes total",
  "bullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"],
  "description": "product description paragraph(s), ≤2000 chars"
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
    const bullets = Array.isArray(out.bullets) ? out.bullets.slice(0, 5).map(b => String(b).slice(0, 500)) : []
    while (bullets.length < 5) bullets.push('')
    const description = String(out.description || '').slice(0, 2000)
    console.log('[Amazon Listing] 生成完成 | title length:', title.length)
    return res.json({ title, searchTerms, bullets, description })
  } catch (e) {
    console.error('[Amazon Listing] generate-listing 失败', e.message)
    return res.status(500).json({ error: e.message || 'Listing 生成失败，请稍后重试' })
  }
})

// Step 3：生成亚马逊产品图（1 张主图 + 可选附加图，共 1～9 张，扣积分）
app.post('/api/ai-assistant/amazon/generate-product-images', requireAuth, async (req, res) => {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' })
  try {
    const { productImage, productName, brand, model: modelName, count: reqCount } = req.body || {}
    if (!productImage) return res.status(400).json({ error: '请提供产品图' })
    const parsed = parseDataUrl(productImage)
    if (!parsed) return res.status(400).json({ error: '产品图格式无效' })

    const count = Math.min(9, Math.max(1, parseInt(reqCount, 10) || 1))
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

    const baseContents = [
      { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
    ]

    let mainImage = null
    let mainImageId = null
    const additionalImages = []

    for (let i = 0; i < count; i++) {
      const isMain = i === 0
      const prompt = isMain
        ? `${noTextRule} --- Amazon main image requirement: Pure white background only (RGB 255,255,255, #FFFFFF). Product: ${productName || 'product'}. Brand context: ${brand || ''}. Product must fill approximately 85% of the frame, centered. Professional product photography, high resolution, clean studio lighting. Single product only, no props or text.`
        : `${noTextRule} --- Amazon additional image (image ${i + 1} of ${count}): Same product as reference. Show a different angle or minimal lifestyle context (e.g. on a clean surface), professional product photography, high resolution. No text, no logos. Product: ${productName || 'product'}. Brand context: ${brand || ''}.`
      const contents = [...baseContents, { text: prompt }]
      console.log(`[Amazon Listing] Step 3 产品图 | 正在生成第 ${i + 1}/${count} 张${isMain ? '（主图）' : '（附加图）'} | 模型:`, imageModelId)

      const resp = await ai.models.generateContent({
        model: imageModelId,
        contents,
        config: genCfg,
      })
      const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part) {
        return res.status(500).json({ error: `第 ${i + 1} 张图生成未返回图片，请重试` })
      }
      const dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`

      if (isMain) {
        mainImage = dataUrl
        const mainId = `amazon-main-${Date.now()}`
        try {
          saveImageToGallery(email, mainId, `${productName || '产品'}·主图`, dataUrl, pointsPerImg, modelName || null, '1K 标准')
          mainImageId = mainId
        } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
      } else {
        additionalImages.push(dataUrl)
        try {
          saveImageToGallery(email, `amazon-extra-${Date.now()}-${i}`, `${productName || '产品'}·附加图${i + 1}`, dataUrl, pointsPerImg, modelName || null, '1K 标准')
        } catch (e) { console.error('[Amazon Listing] 存图库失败', e.message) }
      }
    }

    deductPoints(email, totalPoints, `亚马逊产品图 ${count} 张 (${modelName || 'Nano Banana 2'})`)
    const newBalance = getBalance(email)
    console.log('[Amazon Listing] Step 3 产品图完成 ✓ 共', count, '张')
    return res.json({ mainImage, additionalImages, pointsUsed: totalPoints, newBalance, mainImageId: mainImageId || null })
  } catch (e) {
    console.error('[Amazon Listing] generate-product-images 失败', e.message)
    return res.status(500).json({ error: e.message || '产品图生成失败，请稍后重试' })
  }
})

// 保存当前 Listing 到历史（方案一：独立表）
app.post('/api/ai-assistant/amazon/save-listing', requireAuth, (req, res) => {
  try {
    const { name, title, searchTerms, bullets, description, analyzeResult, aplusCopy, mainImageId, aplusImageIds } = req.body || {}
    if (!title || title.trim() === '') return res.status(400).json({ error: '请提供标题' })
    const email = req.user.email
    const created_at = Date.now()
    const bulletsStr = Array.isArray(bullets) ? JSON.stringify(bullets) : (typeof bullets === 'string' ? bullets : '[]')
    const aplusIdsStr = Array.isArray(aplusImageIds) ? JSON.stringify(aplusImageIds) : null
    getDb()
      .prepare(
        `INSERT INTO amazon_listing_snapshots (user_email, created_at, name, title, search_terms, bullets, description, analyze_result, aplus_copy, main_image_id, aplus_image_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        aplusIdsStr
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
    })
  } catch (e) {
    console.error('[Amazon Listing] listing 详情失败', e.message)
    return res.status(500).json({ error: '获取详情失败' })
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

// 删除客户（同时清除该用户的积分与流水，重注册后积分为 0）
app.delete('/api/admin/users/:email', requireAdmin, (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase()
    if (targetEmail === req.user.email) return res.status(400).json({ error: '不能删除自己的账号' })
    const user = dbFindUser(targetEmail)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    const db = getDb()
    db.prepare('DELETE FROM users WHERE email = ?').run(targetEmail)
    db.prepare('DELETE FROM user_points WHERE user_email = ?').run(targetEmail)
    db.prepare('DELETE FROM points_transactions WHERE user_email = ?').run(targetEmail)
    console.log(`[Admin] ${req.user.email} 删除了用户 ${targetEmail}`)
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: '删除失败' })
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
