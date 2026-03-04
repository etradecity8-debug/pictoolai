/**
 * 模型与清晰度对应（与官网一致）：
 * - Nano Banana：仅 1K
 * - Nano Banana Pro：1K / 2K / 4K
 * - Nano Banana 2：0.5K 快速 / 1K / 2K / 4K
 */

export const CLARITY_OPTIONS_1K_ONLY = ['1K 标准']
export const CLARITY_OPTIONS_PRO = ['1K 标准', '2K 高清', '4K 超清']
export const CLARITY_OPTIONS_2 = ['0.5K 快速', '1K 标准', '2K 高清', '4K 超清']

/**
 * @param {string} model - 如 'Nano Banana' | 'Nano Banana 2' | 'Nano Banana Pro'
 * @returns {string[]} 该模型可选的清晰度选项
 */
export function getClarityOptionsForModel(model) {
  if (model === 'Nano Banana') return CLARITY_OPTIONS_1K_ONLY
  if (model === 'Nano Banana 2') return CLARITY_OPTIONS_2
  return CLARITY_OPTIONS_PRO
}

/**
 * 当切换模型后，若当前清晰度在新模型不支持，则返回该模型的默认清晰度
 * @param {string} model
 * @param {string} currentClarity
 * @returns {string}
 */
export function resolveClarityForModel(model, currentClarity) {
  const options = getClarityOptionsForModel(model)
  return options.includes(currentClarity) ? currentClarity : options[0]
}

/**
 * @param {string} model
 * @param {string} clarity - 如 '0.5K 快速' | '1K 标准' | '2K 高清' | '4K 超清'
 * @returns {boolean}
 */
export function isClarityAllowedForModel(model, clarity) {
  const options = getClarityOptionsForModel(model)
  return options.includes(clarity)
}
