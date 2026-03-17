/**
 * 积分预估（与 server/points.js 的 getPointsPerImage 一致）
 *
 * 注意：前端发图前会经过 fileToCompressedDataUrl 压缩到 maxSize（默认 1024px），
 * 后端 imageSize 读到的是压缩后尺寸，因此预估也要模拟压缩后的尺寸。
 * compressMaxSize 参数默认 1024，与 fileToCompressedDataUrl 的 maxSize 保持一致。
 */
// 与 server/points.js POINTS_MAP 保持一致，用于输出设置积分预估
export const POINTS_MAP = {
  'Nano Banana': { '1K 标准': 3 },
  'Nano Banana Pro': { '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
  'Nano Banana 2': { '0.5K 快速': 3, '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
}

/** 按模型+清晰度预估单张积分（与 server getPointsPerImage 一致） */
export function getPointsEstimate(model, clarity) {
  return POINTS_MAP[model]?.[clarity] ?? 3
}

export function getEstimatedPointsForDimensions(width, height, compressMaxSize = 1024) {
  let w = width || 0, h = height || 0
  if (w > compressMaxSize || h > compressMaxSize) {
    if (w >= h) { h = Math.round((h * compressMaxSize) / w); w = compressMaxSize }
    else { w = Math.round((w * compressMaxSize) / h); h = compressMaxSize }
  }
  const max = Math.max(w, h)
  if (max <= 1024) return POINTS_MAP['Nano Banana']['1K 标准'] // 3
  if (max <= 2048) return POINTS_MAP['Nano Banana 2']['2K 高清'] // 5
  return POINTS_MAP['Nano Banana 2']['4K 超清'] // 5
}
