/** Nano Banana 仅支持 1K；Pro / Nano Banana 2 支持 1K / 2K / 4K */

export const CLARITY_OPTIONS_1K_ONLY = ['1K 标准']
export const CLARITY_OPTIONS_FULL = ['1K 标准', '2K 高清', '4K 超清']

/**
 * @param {string} model - 如 'Nano Banana' | 'Nano Banana 2' | 'Nano Banana Pro'
 * @returns {string[]} 该模型可选的清晰度选项
 */
export function getClarityOptionsForModel(model) {
  return model === 'Nano Banana' ? CLARITY_OPTIONS_1K_ONLY : CLARITY_OPTIONS_FULL
}

/**
 * @param {string} model
 * @param {string} clarity - 如 '1K 标准' | '2K 高清' | '4K 超清'
 * @returns {boolean}
 */
export function isClarityAllowedForModel(model, clarity) {
  const options = getClarityOptionsForModel(model)
  return options.includes(clarity)
}
