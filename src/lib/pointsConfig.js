/**
 * 定价策略：生图扣积分规则与订阅套餐定义
 * - Nano Banana：仅 1K，3 积分/张
 * - Nano Banana Pro：1K=3，2K=5，4K=5 积分/张
 * - Nano Banana 2：0.5K=3，1K=3，2K=5，4K=5 积分/张
 */

/** 模型 + 清晰度 → 每张图扣积分 */
const POINTS_MAP = {
  'Nano Banana': { '1K 标准': 3 },
  'Nano Banana Pro': { '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
  'Nano Banana 2': { '0.5K 快速': 3, '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
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
  { model: 'Nano Banana', clarity: '1K 标准', points: 3 },
  { model: 'Nano Banana 2', clarity: '0.5K 快速', points: 3 },
  { model: 'Nano Banana 2', clarity: '1K 标准', points: 3 },
  { model: 'Nano Banana 2', clarity: '2K 高清', points: 5 },
  { model: 'Nano Banana 2', clarity: '4K 超清', points: 5 },
  { model: 'Nano Banana Pro', clarity: '1K 标准', points: 3 },
  { model: 'Nano Banana Pro', clarity: '2K 高清', points: 5 },
  { model: 'Nano Banana Pro', clarity: '4K 超清', points: 5 },
]

/** 订阅套餐：入门版 / 专业版 / 企业版（仅订阅渠道） */
export const SUBSCRIPTION_PLANS = [
  { id: 'entry', name: '入门版', price: 5, unit: '月', points: 250, popular: false },
  { id: 'pro', name: '专业版', price: 20, unit: '月', points: 1200, popular: true },
  { id: 'enterprise', name: '企业版', price: 100, unit: '月', points: 7000, popular: false },
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
