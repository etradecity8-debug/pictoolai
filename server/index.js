import 'dotenv/config'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'
// 让 Node 的 fetch（含 Gemini 请求）走代理，仅当配置了 HTTPS_PROXY 时生效
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
  console.log('[后端 API] 已启用代理:', process.env.HTTPS_PROXY || process.env.https_proxy)
}
import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { GoogleGenAI } from '@google/genai'
import { ANALYSIS_MODEL_ID, ANALYSIS_MODEL_FALLBACK, getImageModelId, normalizeClarityForModel } from './gemini-models.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'picaitool-dev-secret-change-in-production'

// API Key 仅从环境变量读取，不写进源码、不提交。调用方不要 log 此值。
function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || null
}

const usersPath = join(__dirname, 'users.json')

function readUsers() {
  if (!existsSync(usersPath)) return []
  try {
    return JSON.parse(readFileSync(usersPath, 'utf8'))
  } catch {
    return []
  }
}

function writeUsers(users) {
  writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8')
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
    const users = readUsers()
    if (users.some((u) => u.email === email.toLowerCase())) {
      return res.status(400).json({ error: '该邮箱已注册' })
    }
    const hash = await bcrypt.hash(password, 10)
    const user = { email: email.toLowerCase(), passwordHash: hash }
    users.push(user)
    writeUsers(users)
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ token, user: { email: user.email } })
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
    const users = readUsers()
    const user = users.find((u) => u.email === email.toLowerCase())
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ token, user: { email: user.email } })
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

**图片规划**（imagePlan）：每条包含 title 和 contentMarkdown。contentMarkdown 必须按以下结构逐项书写（换行用\\\\n），便于生图时严格执行构图与文字区域，避免文字被裁切或模糊：

- **设计目标**：一句话说明该图要达成的效果（如建立品牌第一印象、消除稳固性顾虑、传达环保价值观）。
- **产品出现**：是 / 否。
- **图中图元素**：无；或具体描述如 [放大镜特写, 圆形, 右下角, 20%大小, 展示某细节]、[材质图标, 树叶形, 左上角, 10%大小, 环保认证]。
- **构图方案**（务必具体）：
  - 产品占比：如 45%、50%、60%。
  - 布局方式：如产品在画面右侧三分之一、左侧留白用于排版；或低角度仰拍、对角线构图等。
  - 文字区域：明确位置，如画面左侧中部、画面顶部中央、右下角留白区；并强调所有文字必须完整落在画面内，留出上下左右安全边距，不得贴边或裁切。
- **内容要素**：展示重点、突出卖点（可带英文 slogan）、背景元素、装饰元素；如有备注（如保持磨砂质感、禁止抹除结构线）也写上。
- **文字内容**（注明「使用 英语」或目标语言）：主标题、副标题、说明文字的具体文案（完整句子，便于生图直接使用）。
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
      { title: '品牌形象海报', contentMarkdown: '**设计目标**：建立品牌时尚、高端的第一印象\n**产品出现**：是\n**图中图元素**：无\n**构图方案**：产品占比 45%；产品放置在画面右侧三分之一处，左侧留白用于排版；文字区域在画面左侧中部；所有文字须完整在画面内，留安全边距。\n**内容要素**：展示产品整体轮廓与纯净色调；突出卖点 Minimalist Design；背景为现代简约客厅、浅灰墙面、木质地板；装饰可为画面边缘一角绿植。\n**文字内容**（使用 英语）：主标题、副标题、说明文字需具体写出。\n**氛围营造**：情绪关键词 时尚、宁静、高端、纯净；光影效果 柔和百叶窗投影。' },
      { title: '功能卖点图', contentMarkdown: '**设计目标**：消除用户对稳固性的顾虑\n**产品出现**：是\n**图中图元素**：可加 [放大镜特写, 圆形, 右下角, 20%大小] 展示细节\n**构图方案**：产品占比 60%；低角度仰拍突出支撑感；文字区域在画面顶部中央；文字须完整在画面内。\n**内容要素**：展示凳腿与连接处、结构线条；突出卖点 Rock-Solid Stability；背景纯净浅灰影棚；可加半透明受力分析线条；保持产品磨砂质感。\n**文字内容**（使用 英语）：主标题 BUILT TO LAST、副标题、说明文字。\n**氛围营造**：安全、坚固、可靠；硬朗轮廓光。' },
      { title: '材质/环保图', contentMarkdown: '**设计目标**：传达环保、可持续价值观\n**产品出现**：是\n**图中图元素**：[材质/树叶图标, 左上角, 10%大小, 环保认证]\n**构图方案**：产品占比 50%；对角线构图；文字区域在右下角留白区；文字须完整在画面内。\n**内容要素**：展示材质细腻纹理；突出卖点 Eco-Friendly Material；背景为自然光户外或阳台、模糊绿植；装饰为嫩绿叶片、光斑。\n**文字内容**（使用 英语）：主标题 ECO-CONSCIOUS CHOICE、副标题、说明文字。\n**氛围营造**：环保、自然、清新；明亮自然阳光。' },
      { title: '细节图', contentMarkdown: '**设计目标**：展示工艺与质感\n**产品出现**：是\n**图中图元素**：无\n**构图方案**：产品占比约 50%；留白 30% 以上；文字区域明确且留边距。\n**内容要素**：局部特写、材质表现。\n**氛围营造**：清晰、专业。' },
      { title: '卖点总结图', contentMarkdown: '**设计目标**：理性说服、卖点汇总\n**产品出现**：是\n**构图方案**：留白充足；文字区域不贴边。\n**内容要素**：参数或卖点列表。' },
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
      const textQualityRule = `CRITICAL - Text in image: If you include any text (titles, captions, labels), render it SHARP and CLEAR: use clean, high-resolution typography; modern sans-serif; strong contrast against the background; no blurry, pixelated, or low-quality text. Every word must be crisp and readable.`
      const safeAreaRule = `CRITICAL - Composition and safe area: Keep ALL text and important elements WELL INSIDE the frame. Leave clear margins from the top, bottom, and sides (do not place headlines or text near the very edge). Nothing may be cut off or cropped at the image boundary; the full layout must be fully visible within the image.`
      const prompt = `You are an e-commerce detail image designer. Generate ONE product detail image according to the design spec and this image's plan. Output only the image, no text explanation.

${aspectRule}

${textQualityRule}

${safeAreaRule}

${langRule}

Product placement: Place the product naturally in the scene (e.g. on the floor, ground, or in a realistic environment). Do NOT place the product on a table, counter, or elevated platform unless the image plan explicitly asks for a "on table" or "tabletop" display. Avoid unrealistic compositions like a stool standing on a table.

Overall design spec:
${designSpecMarkdown || 'Simple, clear, product-focused.'}

This image plan - ${title}:
${item?.contentMarkdown || 'Highlight product, consistent style.'}

Generate the image that meets the above. Do not add any text that violates the language rule.`
      const contents = []
      if (parsedRef) {
        contents.push({ inlineData: { mimeType: parsedRef.mimeType, data: parsedRef.data } })
      }
      contents.push({ text: prompt })

      try {
        // 官方 Python 使用 aspect_ratio / image_size（snake_case），与 REST 一致；SDK 可能需 snake_case 才生效
        const is25Image = modelId === 'gemini-2.5-flash-image'
        const imageConfig = is25Image
          ? { aspect_ratio: aspectRatioVal }
          : { aspect_ratio: aspectRatioVal, image_size: String(imageSize || '1K') }
        console.log('[后端 API] 生图中', i + 1, '/', count, '模型:', modelId, 'imageConfig:', JSON.stringify(imageConfig))
        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig,
          },
        })
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
        console.error('[后端 API] 生图单张失败', i, err.message)
        images.push({
          id: `gen-${Date.now()}-${i}`,
          title,
          url: null,
          error: err.message || '生成失败',
        })
      }
    }

    const successCount = images.filter((img) => img.url).length
    if (successCount === 0) {
      return res.status(500).json({ error: images[0]?.error || '全部生图失败，请稍后重试' })
    }
    return res.json({ images: images.map(({ id, title, url }) => ({ id, title, url: url || '' })).filter((img) => img.url) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || '生成失败，请稍后重试' })
  }
})

// 获取当前用户（校验 token）
app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: '未登录' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return res.json({ user: { email: payload.email } })
  } catch {
    return res.status(401).json({ error: '登录已过期' })
  }
})

app.listen(PORT, () => {
  console.log('')
  console.log('  [后端 API] Server running at http://localhost:' + PORT)
  console.log('  (这是后端，不要关；前端在另一个终端 npm run dev)')
  console.log('')
})
