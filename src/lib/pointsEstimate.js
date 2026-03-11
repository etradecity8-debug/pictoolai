/**
 * 积分预估（与 server/points.js 的 getPointsPerImage 及 server 的 preserveFromInput 逻辑一致）
 * 局部重绘/局部消除：后端按输入图尺寸推断 model + clarity，此处做同样推算以显示预计消耗
 */
const POINTS_MAP = {
  'Nano Banana': { '1K 标准': 3 },
  'Nano Banana 2': { '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
}

export function getEstimatedPointsForDimensions(width, height) {
  const max = Math.max(width || 0, height || 0)
  if (max <= 1024) return POINTS_MAP['Nano Banana']['1K 标准'] // 3
  if (max <= 2048) return POINTS_MAP['Nano Banana 2']['2K 高清'] // 5
  return POINTS_MAP['Nano Banana 2']['4K 超清'] // 5
}
