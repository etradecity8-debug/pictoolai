/**
 * 按模型返回支持的尺寸比例（与官网说明一致）
 *
 * - Nano Banana (Gemini 2.5 Flash 图片)：1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
 * - Nano Banana 2 (3.1 Flash 映像预览)：上述 + 1:4, 1:8, 4:1, 8:1 极竖/极横
 * - Nano Banana Pro (3 Pro Image 预览版)：同 Nano Banana，10 种比例
 */

/** 所有比例的前端文案（用于 3.1 Flash 的扩展集合） */
export const ASPECT_OPTIONS_STANDARD = [
  '1:1 正方形',
  '2:3 竖版',
  '3:2 横版',
  '3:4 竖版',
  '4:3 横版',
  '4:5 竖版',
  '5:4 横版',
  '9:16 手机竖屏',
  '16:9 宽屏',
  '21:9 超宽屏',
]

/** 仅 Nano Banana 2 (3.1 Flash) 支持的极竖/极横 */
export const ASPECT_OPTIONS_EXTENDED = [
  '1:4 极竖',
  '1:8 极竖',
  '4:1 极横',
  '8:1 极横',
]

/** 前端尺寸比例文案 → [宽, 高]，与后端 ASPECT_RATIO_MAP 一致 */
export const ASPECT_RATIO_PAIR = {
  '1:1 正方形': [1, 1],
  '2:3 竖版': [2, 3],
  '3:2 横版': [3, 2],
  '3:4 竖版': [3, 4],
  '4:3 横版': [4, 3],
  '4:5 竖版': [4, 5],
  '5:4 横版': [5, 4],
  '9:16 手机竖屏': [9, 16],
  '16:9 宽屏': [16, 9],
  '21:9 超宽屏': [21, 9],
  '1:4 极竖': [1, 4],
  '1:8 极竖': [1, 8],
  '4:1 极横': [4, 1],
  '8:1 极横': [8, 1],
}

/** Nano Banana 2 (3.1 Flash) 支持的 14 种比例，顺序与官网表格一致 */
const ASPECT_OPTIONS_3_1_FLASH = [
  '1:1 正方形',
  '1:4 极竖',
  '1:8 极竖',
  '2:3 竖版',
  '3:4 竖版',
  '9:16 手机竖屏',
  '3:2 横版',
  '4:3 横版',
  '16:9 宽屏',
  '21:9 超宽屏',
  '4:1 极横',
  '8:1 极横',
  '4:5 竖版',
  '5:4 横版',
]

/**
 * @param {string} model - 如 'Nano Banana' | 'Nano Banana 2' | 'Nano Banana Pro'
 * @returns {string[]} 该模型可选的尺寸比例文案
 */
export function getAspectOptionsForModel(model) {
  if (model === 'Nano Banana 2') return ASPECT_OPTIONS_3_1_FLASH
  return ASPECT_OPTIONS_STANDARD
}

/**
 * 当切换模型后，若当前选中的比例在新模型不支持，则返回该模型的默认比例
 * @param {string} model
 * @param {string} currentAspect
 * @returns {string}
 */
export function resolveAspectForModel(model, currentAspect) {
  const options = getAspectOptionsForModel(model)
  return options.includes(currentAspect) ? currentAspect : options[0]
}
