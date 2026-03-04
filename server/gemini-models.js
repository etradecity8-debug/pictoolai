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
 * 默认使用 gemini-2.5-flash；可通过 GEMINI_ANALYSIS_MODEL 覆盖。
 * 主模型 503 时会自动用 ANALYSIS_MODEL_FALLBACK 重试一次。
 */
export const ANALYSIS_MODEL_ID = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash'
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
const ALLOWED_CLARITY = {
  'Nano Banana': ['1K 标准'],
  'Nano Banana Pro': ['1K 标准', '2K 高清', '4K 超清'],
  'Nano Banana 2': ['0.5K 快速', '1K 标准', '2K 高清', '4K 超清'],
}

/**
 * 按模型归一化清晰度：Nano Banana 仅 1K；Pro 仅 1K/2K/4K；Nano Banana 2 支持 0.5K/1K/2K/4K
 * @param {string} model - 前端展示名
 * @param {string} clarity - 如 '0.5K 快速' | '1K 标准' | '2K 高清' | '4K 超清'
 * @returns {{ valid: boolean, clarity: string }}
 */
export function normalizeClarityForModel(model, clarity) {
  const allowed = ALLOWED_CLARITY[model]
  if (!allowed) return { valid: true, clarity: clarity || CLARITY_1K }
  if (allowed.includes(clarity)) return { valid: true, clarity }
  return { valid: false, clarity: allowed[0] }
}
