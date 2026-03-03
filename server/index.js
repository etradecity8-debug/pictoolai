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

// 从模型回复中尝试提取 JSON（支持 ```json ... ``` 包裹）
function extractAnalyzeJson(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = codeBlock ? codeBlock[1].trim() : trimmed
  try {
    return JSON.parse(raw)
  } catch {
    return null
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
      const prompt = `你是一名电商详情图设计专家。用户上传了一张产品图，并可能提供了组图要求。

请根据这张产品图和用户要求，输出一份「整体设计规范」和「图片规划」。
- 整体设计规范：用 Markdown 写一段说明，包含风格、色调、版式、文字等统一规范。
- 图片规划：为将要生成的每张详情图列出一条规划，每条包含标题和详细说明（设计目标、图中图元素、构图、内容要素、文字内容、氛围等），用 Markdown。

用户组图要求：${requirements || '（未填写）'}

请输出恰好 ${planCount} 条图片规划，不要多也不要少。每条对应后续要生成的一张图。

你必须只输出一个 JSON 对象，不要其他解释，格式如下（contentMarkdown 内用 \\n 表示换行）：
{
  "designSpecMarkdown": "整体设计规范的 Markdown 字符串",
  "imagePlan": [
    { "title": "图片标题", "contentMarkdown": "该张图的设计说明，可多行" }
  ]
}
imagePlan 数组长度必须为 ${planCount}，如：主图/首图、卖点图、场景图、细节图等。`

      const contents = [
        { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
        { text: prompt },
      ]
      const ai = new GoogleGenAI({ apiKey })
      let response
      let modelUsed = ANALYSIS_MODEL_ID
      try {
        console.log('[后端 API] 使用 Gemini 分析中，模型:', modelUsed)
        response = await ai.models.generateContent({ model: modelUsed, contents })
      } catch (firstErr) {
        if (firstErr?.status === 503 && ANALYSIS_MODEL_FALLBACK && ANALYSIS_MODEL_FALLBACK !== ANALYSIS_MODEL_ID) {
          console.log('[后端 API] 主模型繁忙(503)，改用备用模型:', ANALYSIS_MODEL_FALLBACK)
          modelUsed = ANALYSIS_MODEL_FALLBACK
          response = await ai.models.generateContent({ model: modelUsed, contents })
        } else {
          throw firstErr
        }
      }
      const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '')
      if (text) {
        const out = extractAnalyzeJson(text)
        if (out && typeof out.designSpecMarkdown === 'string' && Array.isArray(out.imagePlan)) {
          const plan = out.imagePlan.slice(0, planCount).map((item) => ({
            title: item?.title || '未命名',
            contentMarkdown: item?.contentMarkdown != null ? String(item.contentMarkdown) : '',
          }))
          return res.json({
            designSpecMarkdown: out.designSpecMarkdown,
            imagePlan: plan,
          })
        }
      }
      console.error('[后端 API] Gemini 返回格式异常，改用 mock', text?.slice(0, 200))
    } else {
      console.log('[后端 API] 未配置 GEMINI_API_KEY 或 key 为空，使用 mock 返回')
    }
    // 无 key 或 API 返回格式异常时回退 mock
    const designSpecMarkdown = `## 整体设计规范

- **风格**：简约电商详情风格，突出产品主体
- **色调**：以产品主色为基调，背景干净
- **版式**：留白适中，信息层级清晰
- **文字**：根据目标语言输出，避免过多文案堆砌

${requirements ? `**用户要求摘要**：${requirements.slice(0, 200)}${requirements.length > 200 ? '...' : ''}` : ''}
`
    const mockPlans = [
      { title: '主图/首图', contentMarkdown: '- 设计目标：吸引点击、突出卖点\n- 图中图元素：产品居中，可加简单标签\n- 构图：居中或三分法\n- 氛围：清晰、专业' },
      { title: '卖点/功能图', contentMarkdown: '- 设计目标：传达核心卖点\n- 内容要素：1–3 个卖点关键词 + 产品\n- 构图：左右或上下分区\n- 文字内容：由用户要求与目标语言决定' },
      { title: '场景/氛围图', contentMarkdown: '- 设计目标：营造使用场景\n- 氛围营造：柔和光影，可加简单场景元素\n- 构图：产品与场景融合' },
      { title: '细节图', contentMarkdown: '- 设计目标：展示工艺与质感\n- 内容要素：局部特写\n- 氛围：清晰、专业' },
      { title: '参数/卖点总结', contentMarkdown: '- 设计目标：理性说服\n- 内容要素：参数或卖点列表\n- 构图：留白、易读' },
    ]
    const imagePlan = mockPlans.slice(0, planCount)
    return res.json({ designSpecMarkdown, imagePlan })
  } catch (e) {
    console.error(e)
    const status = e.status || e.statusCode
    const cause = e.cause || e
    const isTimeout = cause.code === 'UND_ERR_CONNECT_TIMEOUT' || /timeout|ETIMEDOUT/i.test(cause.message || '')
    const isNetwork = /fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(e.message || '') || isTimeout
    const is503 = status === 503 || /high demand|503|UNAVAILABLE/i.test(e.message || '')
    let message = e.message || '分析失败，请稍后重试'
    if (is503) {
      message = 'Gemini 服务当前请求量较大，请稍后再试（或已自动尝试备用模型）'
    } else if (isNetwork) {
      message = '连接 Google Gemini 超时或不可达，请检查网络、VPN/代理后重试（若在国内需可访问 Google 的网络环境）'
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

// 尺寸比例文案 → Gemini imageConfig.aspectRatio
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
}
// 清晰度文案 → Gemini imageConfig.imageSize
const CLARITY_TO_SIZE = { '1K 标准': '1K', '2K 高清': '2K', '4K 超清': '4K' }

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
    const aspectRatioVal = ASPECT_RATIO_MAP[aspectRatio] || '3:4'
    const modelId = getImageModelId(model || 'Nano Banana 2')
    const parsedRef = image ? parseDataUrl(image) : null
    console.log('[后端 API] 生图参数 aspectRatio:', aspectRatioVal, 'imageSize:', imageSize)

    const ai = new GoogleGenAI({ apiKey })
    const count = Math.min(imagePlan.length, 15)
    const images = []

    const langRule = getLanguageRuleForImage(targetLanguage)
    for (let i = 0; i < count; i++) {
      const item = imagePlan[i]
      const title = item?.title || `图${i + 1}`
      const aspectRule = `CRITICAL - Aspect ratio: The output image MUST have aspect ratio exactly ${aspectRatioVal}. For 1:1 this means a perfect square (width = height). For 3:4 or 4:3 etc. the image must match that ratio precisely. Do not produce a different aspect ratio.`
      const prompt = `You are an e-commerce detail image designer. Generate ONE product detail image according to the design spec and this image's plan. Output only the image, no text explanation.

${aspectRule}

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
        console.log('[后端 API] 生图中', i + 1, '/', count, '模型:', modelId)
        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: aspectRatioVal, imageSize },
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
