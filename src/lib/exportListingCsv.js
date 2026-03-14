/**
 * 通用 CSV 导出工具，支持亚马逊 / eBay / 速卖通三个平台。
 */

function escapeCsvField(value) {
  if (value == null) return ''
  const s = String(value).trim()
  if (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(',')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * 亚马逊 CSV（兼容 Seller Central 平面文件）
 */
export function buildAmazonCsv(data) {
  const headers = ['item_name', 'bullet_point_1', 'bullet_point_2', 'bullet_point_3', 'bullet_point_4', 'bullet_point_5', 'product_description', 'generic_keyword']
  const bullets = Array.isArray(data.bullets) ? data.bullets : []
  const row = [
    escapeCsvField(data.title),
    escapeCsvField(bullets[0]), escapeCsvField(bullets[1]), escapeCsvField(bullets[2]),
    escapeCsvField(bullets[3]), escapeCsvField(bullets[4]),
    escapeCsvField(data.description),
    escapeCsvField(data.searchTerms),
  ]
  return headers.join(',') + '\n' + row.join(',')
}

/**
 * eBay CSV（兼容 File Exchange / Seller Hub 批量上传格式）
 * 列头：Title, Description, 以及 Item Specifics 各条展开为 C:Name = Value 格式
 */
export function buildEbayCsv(data) {
  const specs = Array.isArray(data.itemSpecifics) ? data.itemSpecifics : []
  const specHeaders = specs.map((_, i) => `C:${specs[i]?.name || `Attribute${i + 1}`}`)
  const headers = ['Title', 'Description', ...specHeaders]
  const specValues = specs.map(s => escapeCsvField(s?.value))
  const row = [escapeCsvField(data.title), escapeCsvField(data.description), ...specValues]
  return headers.join(',') + '\n' + row.join(',')
}

/**
 * 速卖通 CSV（兼容速卖通批量上传格式）
 * 列头：Title, Description, 以及产品属性各条展开
 */
export function buildAliExpressCsv(data) {
  const attrs = Array.isArray(data.productAttributes) ? data.productAttributes : []
  const attrHeaders = attrs.map((_, i) => attrs[i]?.name || `Attribute${i + 1}`)
  const headers = ['Title', 'Description', ...attrHeaders]
  const attrValues = attrs.map(a => escapeCsvField(a?.value))
  const row = [escapeCsvField(data.title), escapeCsvField(data.description), ...attrValues]
  return headers.join(',') + '\n' + row.join(',')
}

/**
 * 触发浏览器下载 CSV 文件（UTF-8 + BOM）
 */
export function downloadCsv(csvContent, filename = 'listing-export.csv') {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 触发浏览器下载 JSON 文件
 */
export function downloadJson(data, filename = 'listing-export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
