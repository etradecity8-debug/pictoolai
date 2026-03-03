/**
 * Nano Banana / Gemini 模型与额度使用策略
 *
 * 生图模型（官方说明）：
 * - Nano Banana：Gemini 2.5 Flash Image (gemini-2.5-flash-image)，为速度和效率设计，高数据量、低延迟
 * - Nano Banana 2：Gemini 3.1 Flash Image 预览版 (gemini-3.1-flash-image-preview)，3 Pro Image 的高效版，针对速度和高用量
 * - Nano Banana Pro：Gemini 3 Pro Image 预览版 (gemini-3-pro-image-preview)，专业资产制作，高级推理与高保真文本
 */

/** 前端展示名 → Gemini API 模型 ID（生图用） */
export const IMAGE_MODEL_IDS = {
  'Nano Banana': 'gemini-2.5-flash-image',
  'Nano Banana 2': 'gemini-3.1-flash-image-preview',
  'Nano Banana Pro': 'gemini-3-pro-image-preview',
}

/**
 * 分析阶段：文+图 → 文（设计规范+图片规划）。
 * 默认使用 gemini-3-flash-preview；可通过 GEMINI_ANALYSIS_MODEL 覆盖。
 * 主模型 503 时会自动用此备用模型重试一次。
 */
export const ANALYSIS_MODEL_ID = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3-flash-preview'
export const ANALYSIS_MODEL_FALLBACK = process.env.GEMINI_ANALYSIS_MODEL_FALLBACK || 'gemini-2.5-flash'

/**
 * 根据前端传来的 model 展示名解析出生图用的 API 模型 ID
 * @param {string} displayName - 如 'Nano Banana 2' | 'Nano Banana Pro' | 'Nano Banana'
 * @returns {string} 对应 Gemini 模型 ID
 */
export function getImageModelId(displayName) {
  return IMAGE_MODEL_IDS[displayName] || IMAGE_MODEL_IDS['Nano Banana 2']
}

/** 前端清晰度文案 */
const CLARITY_1K = '1K 标准'

/**
 * Nano Banana 仅支持 1K；生图接口收到 model + clarity 时可用此函数归一化或校验
 * @param {string} model - 前端展示名
 * @param {string} clarity - 如 '1K 标准' | '2K 高清' | '4K 超清'
 * @returns {{ valid: boolean, clarity: string }} valid 为 false 时表示不允许该组合，clarity 为建议使用的清晰度（强制 1K 时返回 CLARITY_1K）
 */
export function normalizeClarityForModel(model, clarity) {
  if (model === 'Nano Banana') {
    if (clarity !== CLARITY_1K) return { valid: false, clarity: CLARITY_1K }
    return { valid: true, clarity: CLARITY_1K }
  }
  return { valid: true, clarity: clarity || CLARITY_1K }
}
