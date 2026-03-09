/**
 * 按亚马逊批量上传通用列头导出 CSV，便于用户复制到自己的上传文件中。
 * 列头与常见模板一致：item_name, bullet_point_1..5, product_description, generic_keyword
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
 * @param {{ title: string, searchTerms?: string, bullets?: string[], description?: string }} data
 * @returns {string} CSV 内容（不含 BOM）
 */
export function buildAmazonListingCsv(data) {
  const headers = [
    'item_name',
    'bullet_point_1',
    'bullet_point_2',
    'bullet_point_3',
    'bullet_point_4',
    'bullet_point_5',
    'product_description',
    'generic_keyword',
  ]
  const bullets = Array.isArray(data.bullets) ? data.bullets : []
  const row = [
    escapeCsvField(data.title),
    escapeCsvField(bullets[0]),
    escapeCsvField(bullets[1]),
    escapeCsvField(bullets[2]),
    escapeCsvField(bullets[3]),
    escapeCsvField(bullets[4]),
    escapeCsvField(data.description),
    escapeCsvField(data.searchTerms),
  ]
  return headers.join(',') + '\n' + row.join(',')
}

/**
 * 触发浏览器下载 CSV 文件（UTF-8 + BOM，便于 Excel 正确识别中文）
 * @param {string} csvContent - buildAmazonListingCsv 的返回值
 * @param {string} [filename] - 文件名，默认 listing-export.csv
 */
export function downloadAmazonListingCsv(csvContent, filename = 'listing-export.csv') {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
