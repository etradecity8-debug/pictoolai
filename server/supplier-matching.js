/**
 * 智能选品：解析卖家精灵 Excel、以图搜图 1688、利润核算
 * 仅支持以图搜图，无主图或失败直接标记未找到（无关键词兜底）
 */
import XLSX from 'xlsx'
import { uploadImage, searchByImage } from './daji.js'

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

/** 诊断：对单张主图 URL 跑完整流程，返回每步结果（用于排查全部未找到） */
export async function runDiagnostic(imageUrl) {
  const out = { url: String(imageUrl || '').trim().slice(0, 100), step1: {}, step2: {}, step3: {} }
  if (!out.url) {
    out.step1 = { ok: false, error: 'URL 为空' }
    return out
  }
  const img = await fetchImageAsBase64(out.url)
  out.step1 = img?.data ? { ok: true, base64Len: img.data.length } : { ok: false, error: img?.error || '未知' }
  if (!img?.data) return out

  try {
    const imageId = await uploadImage(img.data)
    out.step2 = { ok: true, imageId: String(imageId).slice(0, 50) }
    try {
      const res = await searchByImage({ imageId, pageSize: 20 })
      const count = res?.items?.length ?? 0
      out.step3 = { ok: true, count, sample: res?.items?.[0]?.title?.slice(0, 40) }
    } catch (e) {
      out.step3 = { ok: false, error: e?.message || String(e) }
    }
  } catch (e) {
    out.step2 = { ok: false, error: e?.message || String(e) }
  }
  return out
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

/** 拉取图片为 base64（超时 15s，最大 2.5MB，用于 Daji 上传）
 * 亚马逊 CDN 需模拟浏览器请求，否则易 403
 * @returns {{ mimeType, data } | { data: null, error: string }} */
async function fetchImageAsBase64(url) {
  if (!url || typeof url !== 'string') return { data: null, error: 'URL 为空' }
  let clean = url.trim()
  if (!clean.startsWith('http')) {
    if (clean.startsWith('//')) clean = 'https:' + clean
    else return { data: null, error: 'URL 格式无效（需以 http 或 // 开头）' }
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(clean, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.amazon.com/',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) {
      const msg = `主图拉取失败 (HTTP ${res.status})`
      console.warn('[supplier-matching]', msg, clean.slice(0, 80))
      return { data: null, error: msg }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 2.5 * 1024 * 1024) {
      return { data: null, error: '主图拉取失败 (图片超过 2.5MB)' }
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg'
    return { mimeType: mime, data: buf.toString('base64') }
  } catch (err) {
    const isAbort = err?.name === 'AbortError' || /abort|timeout/i.test(err?.message || '')
    const msg = isAbort ? '主图拉取失败 (超时 15s)' : `主图拉取失败 (${err?.message || err})`
    console.warn('[supplier-matching]', msg, clean.slice(0, 80))
    return { data: null, error: msg }
  }
}

/** 单条产品：仅以图搜图（亚马逊主图→Daji 上传→1688 同款），无主图或失败直接标记未找到 */
export async function processOneRow(row, settings, onProgress) {
  const { exchangeRate, headRate, domesticPerItem, commissionRate } = settings
  const commission = typeof commissionRate === 'number' ? commissionRate : getCommissionRate(row.category)

  let items = []
  let searchError = null

  if (!row.mainImage) {
    searchError = '缺少商品主图，仅支持以图搜图'
  } else {
    onProgress?.('search')
    const img = await fetchImageAsBase64(row.mainImage)
    if (!img?.data) {
      searchError = img?.error || '主图拉取失败'
    } else {
      try {
        const imageId = await uploadImage(img.data)
        const res = await searchByImage({ imageId, pageSize: 20 })
        items = res.items || []
      } catch (err) {
        searchError = err?.message || String(err)
        console.error('[supplier-matching] Daji 以图搜图失败:', searchError)
      }
    }
  }

  if (!items.length) {
    if (!searchError) searchError = '1688 未返回匹配结果'
    return {
      rowIndex: row.rowIndex,
      title: row.title,
      price: row.price,
      mainImage: row.mainImage,
      category: row.category,
      asin: row.asin,
      weightKg: row.weightKg,
      fba: row.fba,
      keyword: '',
      matches: [],
      found: false,
      profit: null,
      selectedIndex: -1,
      error: searchError,
    }
  }

  onProgress?.('rank')
  const matches = items.slice(0, 3)

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
    keyword: '',
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
