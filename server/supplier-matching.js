/**
 * 智能选品：解析表格、AI 翻译、1688 搜索、利润核算
 */
import { GoogleGenAI } from '@google/genai'
import XLSX from 'xlsx'
import { searchByKeyword } from './daji.js'
import { ANALYSIS_MODEL_ID } from './gemini-models.js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// 卖家精灵列名映射（支持多种写法）
const COL_MAP = {
  title: ['商品标题', '商品标题', 'title'],
  price: ['价格($)', '价格', 'price', '售价'],
  mainImage: ['商品主图', '主图', 'mainImage', '图片'],
  fba: ['FBA($)', 'FBA', 'fba'],
  weight: ['商品重量', '包装重量', 'weight', '重量'],
  weightG: ['商品重量（单位换算）', '包装重量（单位换算）'],
  size: ['商品尺寸', '包装尺寸', 'size', '尺寸'],
  category: ['大类目', '类目', 'category'],
  asin: ['ASIN', 'asin'],
  detailParams: ['详细参数', '参数', 'detailParams'],
}

function findCol(row, keys) {
  const rowKeys = Object.keys(row)
  // 优先精确匹配，避免「产品价格」误匹配「价格」
  for (const key of keys) {
    const found = rowKeys.find((k) => String(k).trim() === key)
    if (found) return found
  }
  for (const k of rowKeys) {
    const v = String(k).trim()
    for (const key of keys) {
      if (v.includes(key) && !v.includes('产品价格')) return k
    }
  }
  return null
}

/** 解析 Excel，返回标准化行数组，最多 100 条 */
export function parseSellerSpriteExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Excel 无有效工作表')
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!rows.length) throw new Error('Excel 为空')

  const result = []
  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const row = rows[i]
    const title = row[findCol(row, COL_MAP.title)] ?? ''
    const price = row[findCol(row, COL_MAP.price)] ?? ''
    const mainImage = row[findCol(row, COL_MAP.mainImage)] ?? ''
    const fba = row[findCol(row, COL_MAP.fba)] ?? ''
    const weight = row[findCol(row, COL_MAP.weight)] ?? row[findCol(row, COL_MAP.weightG)] ?? ''
    const category = row[findCol(row, COL_MAP.category)] ?? ''
    const asin = row[findCol(row, COL_MAP.asin)] ?? ''
    const detailParams = row[findCol(row, COL_MAP.detailParams)] ?? ''

    const priceNum = parseFloat(String(price).replace(/[^\d.]/g, '')) || 0
    const fbaNum = parseFloat(String(fba).replace(/[^\d.]/g, ''))
    const weightKg = parseWeightToKg(weight)

    result.push({
      rowIndex: i + 1,
      title: String(title).trim(),
      price: priceNum,
      mainImage: String(mainImage).trim(),
      fba: isNaN(fbaNum) ? null : fbaNum,
      weightKg: weightKg ?? null,
      category: String(category).trim(),
      asin: String(asin).trim(),
      detailParams: String(detailParams).trim(),
    })
  }
  return result
}

function parseWeightToKg(val) {
  if (!val) return null
  const s = String(val)
  const num = parseFloat(s.replace(/[^\d.]/g, ''))
  if (isNaN(num)) return null
  if (/lb|pound/i.test(s)) return num * 0.453592
  if (/g\b|克/i.test(s)) return num / 1000
  return num
}

/** 校验必填字段，返回错误信息或 null */
export function validateRows(rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r.title) return `第 ${r.rowIndex} 行缺少「商品标题」`
    if (!r.price || r.price <= 0) return `第 ${r.rowIndex} 行缺少或无效的「售价」`
    if (!r.mainImage) return `第 ${r.rowIndex} 行缺少「商品主图」`
  }
  return null
}

/** 亚马逊大类目 → Referral Fee 比例（约值） */
const AMAZON_FEE_MAP = {
  'home': 15,
  'home & kitchen': 15,
  'kitchen': 15,
  'sports': 15,
  'toys': 15,
  'baby': 15,
  'beauty': 15,
  'health': 15,
  'grocery': 15,
  'pet': 15,
  'electronics': 8,
  'computer': 8,
  'office': 15,
  'garden': 15,
  'tools': 15,
  'automotive': 12,
  'industrial': 12,
  'clothing': 17,
  'shoes': 15,
  'jewelry': 20,
  'watches': 20,
  'luggage': 15,
  'default': 15,
}

function getCommissionRate(category) {
  if (!category) return 15
  const lower = String(category).toLowerCase()
  for (const [key, rate] of Object.entries(AMAZON_FEE_MAP)) {
    if (lower.includes(key)) return rate
  }
  return 15
}

/** AI 翻译英文标题 → 中文采购关键词 */
export async function translateToChineseKeyword(title) {
  const apiKey = GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API 未配置')
  const ai = new GoogleGenAI({ apiKey })
  const prompt = `Translate this Amazon product title into 2-5 Chinese keywords that a 1688/Alibaba buyer would search for. Output ONLY the keywords, separated by spaces, no quotes or punctuation. Example: "Disposable Toilet Brush with 48 Refills" → "一次性马桶刷 替换头 48个装"

Title: ${title}`
  const res = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
  const text = res?.text?.trim() || ''
  return text.replace(/["'""]/g, '').replace(/[,，;；]/g, ' ').trim() || title
}

/** AI 从候选中选出 Top 3 并排序 */
export async function rankMatches(originalTitle, candidates) {
  if (!candidates.length) return []
  const apiKey = GEMINI_API_KEY
  if (!apiKey) return candidates.slice(0, 3)

  const list = candidates.slice(0, 15).map((c, i) => `${i + 1}. ${c.title} | 价格: ¥${c.price} | 月销: ${c.monthSold}`).join('\n')
  const ai = new GoogleGenAI({ apiKey })
  const prompt = `You are matching 1688 products to an Amazon product. Given the Amazon title and 1688 search results, pick the TOP 3 best matches (by relevance, similar product, reasonable price). Output ONLY a JSON array of the 1-based indices, e.g. [3, 1, 7]. If none match well, output [].

Amazon title: ${originalTitle}

1688 results:
${list}

Output JSON array only:`
  const res = await ai.models.generateContent({ model: ANALYSIS_MODEL_ID, contents: [{ text: prompt }] })
  let text = res?.text?.trim() || ''
  text = text.replace(/```\w*\n?/g, '').trim()
  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return candidates.slice(0, 3)
    const indices = arr.filter((n) => typeof n === 'number' && n >= 1 && n <= candidates.length).slice(0, 3)
    return indices.map((i) => candidates[i - 1]).filter(Boolean)
  } catch {
    return candidates.slice(0, 3)
  }
}

/** 单条产品：翻译 → 搜索 → 排序 → 利润 */
export async function processOneRow(row, settings, onProgress) {
  const { exchangeRate, headRate, domesticPerItem, commissionRate } = settings
  const commission = typeof commissionRate === 'number' ? commissionRate : getCommissionRate(row.category)

  // 1. 翻译
  onProgress?.('translate')
  const keyword = await translateToChineseKeyword(row.title)

  // 2. 1688 搜索
  onProgress?.('search')
  let items = []
  try {
    const res = await searchByKeyword(keyword, { pageSize: 20 })
    items = res.items || []
  } catch (err) {
    console.error('[supplier-matching] Daji search error:', err?.message || String(err))
  }

  if (!items.length) {
    return {
      rowIndex: row.rowIndex,
      title: row.title,
      price: row.price,
      mainImage: row.mainImage,
      category: row.category,
      asin: row.asin,
      weightKg: row.weightKg,
      fba: row.fba,
      keyword,
      matches: [],
      found: false,
      profit: null,
      selectedIndex: -1,
    }
  }

  // 3. AI 排序
  onProgress?.('rank')
  const top3 = await rankMatches(row.title, items)
  const matches = top3.length ? top3 : items.slice(0, 3)

  const selected = matches[0]
  const fba = row.fba ?? (row.weightKg ? row.weightKg * 4.5 : 5)
  const headCost = (row.weightKg ?? 0.5) * headRate
  const revenueCny = row.price * exchangeRate
  const costCny = selected.price + domesticPerItem + headCost
  const commissionCny = row.price * exchangeRate * (commission / 100)
  const fbaCny = fba * exchangeRate
  const profitCny = revenueCny - costCny - commissionCny - fbaCny
  const margin = revenueCny > 0 ? ((profitCny / revenueCny) * 100).toFixed(1) : '0'

  return {
    rowIndex: row.rowIndex,
    title: row.title,
    price: row.price,
    mainImage: row.mainImage,
    category: row.category,
    asin: row.asin,
    weightKg: row.weightKg,
    fba: row.fba,
    keyword,
    matches: matches.map((m) => ({
      offerId: m.offerId,
      title: m.title,
      price: m.price,
      link: m.link,
      imageUrl: m.imageUrl,
      monthSold: m.monthSold,
    })),
    found: true,
    profit: {
      purchasePrice: selected.price,
      domesticPerItem,
      headCost,
      fbaUsd: fba,
      fbaCny,
      commissionRate: commission,
      commissionCny,
      revenueCny,
      costCny,
      profitCny,
      margin,
      exchangeRate,
    },
    selectedIndex: 0,
  }
}
