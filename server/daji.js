/**
 * DajiAPI 1688 接口封装
 * 文档：https://wiki.dajisaas.com/doc-4514988
 *  base: https://openapi.dajisaas.com
 */
import { createHash } from 'crypto'

const BASE_URL = 'https://openapi.dajisaas.com'

function getCredentials() {
  const appKey = process.env.DAJI_APP_KEY
  const appSecret = process.env.DAJI_APP_SECRET
  if (!appKey || !appSecret) return null
  return { appKey, appSecret }
}

/**
 * 签名规则：https://wiki.dajisaas.com/doc-4543198
 * 1. 移除 sign 字段；2. 字典序排序；3. key=value& 拼接；4. 末尾加 secret=xxx；5. MD5 大写
 */
function sign(params, secret) {
  const copy = { ...params }
  delete copy.sign
  const sorted = Object.keys(copy)
    .filter((k) => copy[k] != null) // 仅排除 null，与文档 Optional.ofNullable().isPresent() 一致
    .sort()
  const str = sorted.map((k) => `${k}=${copy[k]}`).join('&') + `&secret=${secret}`
  return createHash('md5').update(str, 'utf8').digest('hex').toUpperCase()
}

/**
 * 关键词搜索 1688 商品
 * @param {string} keyword 中文关键词
 * @param {object} opts { page, pageSize, country }
 */
export async function searchByKeyword(keyword, opts = {}) {
  const cred = getCredentials()
  if (!cred) throw new Error('DajiAPI 未配置 DAJI_APP_KEY / DAJI_APP_SECRET')

  const page = opts.page ?? 1
  const pageSize = Math.min(opts.pageSize ?? 20, 50)
  const country = opts.country ?? 'zh'

  const params = {
    appKey: cred.appKey,
    keyword: String(keyword).trim(),
    beginPage: page,
    pageSize,
    country,
  }
  params.sign = sign(params, cred.appSecret)

  const url = new URL('/alibaba/product/keywordQuery', BASE_URL)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  let res, json, text
  try {
    res = await fetch(url.toString())
    text = await res.text()
    try {
      json = JSON.parse(text)
    } catch {
      json = {}
      console.error('[DajiAPI] 关键词搜索返回非 JSON, path:', url.pathname, 'status:', res.status, 'body 前 200 字符:', (text || '').slice(0, 200))
    }
  } catch (err) {
    console.error('[DajiAPI] 关键词搜索请求失败:', err.message || err)
    throw new Error(err.message || 'DajiAPI 网络请求失败')
  }
  if (json.code !== 200 && json.code !== 0) {
    const msg = json.message || json.msg || json.error || json.detail || `HTTP ${res.status}`
    console.error('[DajiAPI] 关键词搜索错误:', { code: json.code, message: msg, status: res?.status, path: url.pathname })
    if (res?.status >= 400 && text && !json.detail) {
      console.error('[DajiAPI] 完整响应 body:', text)
    }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  const data = json.data || {}
  const items = Array.isArray(data.data) ? data.data : []
  return {
    total: data.totalRecords ?? items.length,
    items: items.map(normalizeItem),
  }
}

/**
 * 以图搜图（仅支持 1688 图片链接）
 * @param {string} imageUrl 1688 域名图片 URL
 * @param {object} opts { page, pageSize, country }
 */
export async function searchByImage(imageUrl, opts = {}) {
  const cred = getCredentials()
  if (!cred) throw new Error('DajiAPI 未配置 DAJI_APP_KEY / DAJI_APP_SECRET')

  const page = opts.page ?? 1
  const pageSize = Math.min(opts.pageSize ?? 20, 50)
  const country = opts.country ?? 'zh'

  const params = {
    appKey: cred.appKey,
    imageUrl: String(imageUrl).trim(),
    beginPage: page,
    pageSize,
    country,
  }
  params.sign = sign(params, cred.appSecret)

  const url = new URL('/alibaba/product/imageQuery', BASE_URL)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const res = await fetch(url.toString())
  const json = await res.json().catch(() => ({}))
  if (json.code !== 200 && json.code !== 0) {
    throw new Error(json.message || `DajiAPI 图片搜索错误: ${res.status}`)
  }
  const data = json.data || {}
  const items = Array.isArray(data.data) ? data.data : []
  return {
    total: data.totalRecords ?? items.length,
    items: items.map(normalizeItem),
  }
}

function normalizeItem(item) {
  const priceInfo = item.priceInfo || {}
  const price = priceInfo.consignPrice ?? priceInfo.price ?? priceInfo.jxhyPrice ?? '0'
  return {
    offerId: item.offerId,
    title: item.subject || item.subjectTrans || '',
    titleTrans: item.subjectTrans || item.subject || '',
    price: parseFloat(String(price).replace(/[^\d.]/g, '')) || 0,
    priceRaw: price,
    imageUrl: item.imageUrl || '',
    monthSold: item.monthSold ?? 0,
    isOnePsale: item.isOnePsale ?? false,
    repurchaseRate: item.repurchaseRate || '',
    link: item.offerId ? `https://detail.1688.com/offer/${item.offerId}.html` : '',
  }
}

export function isDajiConfigured() {
  return !!(process.env.DAJI_APP_KEY && process.env.DAJI_APP_SECRET)
}
