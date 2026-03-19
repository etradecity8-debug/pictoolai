/**
 * 定价策略：生图扣积分规则与套餐定义（¥200 = 1000积分，1积分 ≈ ¥0.20）
 * - Nano Banana：仅 1K，4 积分/张
 * - Nano Banana Pro：1K=12，2K=12，4K=20 积分/张
 * - Nano Banana 2：0.5K=4，1K=6，2K=10，4K=14 积分/张
 */

/** 模型 + 清晰度 → 每张图扣积分 */
const POINTS_MAP = {
  'Nano Banana':     { '1K 标准': 4 },
  'Nano Banana Pro': { '1K 标准': 12, '2K 高清': 12, '4K 超清': 20 },
  'Nano Banana 2':   { '0.5K 快速': 4, '1K 标准': 6, '2K 高清': 10, '4K 超清': 14 },
}

/**
 * 获取某模型某清晰度下每张图扣除的积分
 * @param {string} model - 如 'Nano Banana' | 'Nano Banana 2' | 'Nano Banana Pro'
 * @param {string} clarity - 如 '0.5K 快速' | '1K 标准' | '2K 高清' | '4K 超清'
 * @returns {number} 积分，未知组合返回 3
 */
export function getPointsPerImage(model, clarity) {
  const byModel = POINTS_MAP[model]
  if (!byModel) return 3
  return byModel[clarity] ?? 3
}

/** 用于定价页展示的积分规则表：{ model, clarity, points }[] */
export const POINTS_TABLE = [
  { model: 'Nano Banana',     clarity: '1K 标准',  points: 4 },
  { model: 'Nano Banana 2',   clarity: '0.5K 快速', points: 4 },
  { model: 'Nano Banana 2',   clarity: '1K 标准',  points: 6 },
  { model: 'Nano Banana 2',   clarity: '2K 高清',  points: 10 },
  { model: 'Nano Banana 2',   clarity: '4K 超清',  points: 14 },
  { model: 'Nano Banana Pro', clarity: '1K 标准',  points: 12 },
  { model: 'Nano Banana Pro', clarity: '2K 高清',  points: 12 },
  { model: 'Nano Banana Pro', clarity: '4K 超清',  points: 20 },
]

/** 当前套餐：单一标准套餐 ¥200 / 1000积分 / 购买之日起 1 年有效 */
export const SUBSCRIPTION_PLANS = [
  { id: 'standard', name: '标准套餐', price: 200, currency: '¥', unit: '次', points: 1000, expireDays: 365, popular: true },
]

/**
 * 积分总数 ÷ 每张扣费 = 可生成张数（向下取整）
 * @param {number} totalPoints
 * @param {number} pointsPerImage
 * @returns {number}
 */
export function estimateImages(totalPoints, pointsPerImage) {
  if (!pointsPerImage || pointsPerImage < 1) return 0
  return Math.floor(totalPoints / pointsPerImage)
}
