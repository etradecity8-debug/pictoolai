/**
 * 积分预估（与 server/points.js 的 getPointsPerImage 一致）
 *
 * 前端发图前经 fileToCompressedDataUrl 压缩到 maxSize（默认 1024px），
 * 后端 imageSize 读到的是压缩后尺寸，因此预估也模拟压缩后的尺寸。
 */
import { POINTS_MAP, getPointsPerImage } from './pointsConfig'

/** 按模型+清晰度预估单张积分 */
export function getPointsEstimate(model, clarity) {
  return getPointsPerImage(model, clarity)
}

export function getEstimatedPointsForDimensions(width, height, compressMaxSize = 1024) {
  let w = width || 0, h = height || 0
  if (w > compressMaxSize || h > compressMaxSize) {
    if (w >= h) { h = Math.round((h * compressMaxSize) / w); w = compressMaxSize }
    else { w = Math.round((w * compressMaxSize) / h); h = compressMaxSize }
  }
  const max = Math.max(w, h)
  if (max <= 1024) return POINTS_MAP['Nano Banana']['1K 标准'] // 4
  if (max <= 2048) return POINTS_MAP['Nano Banana 2']['2K 高清'] // 10
  return POINTS_MAP['Nano Banana 2']['4K 超清'] // 14
}
