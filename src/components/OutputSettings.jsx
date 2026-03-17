import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'
import { getPointsEstimate } from '../lib/pointsEstimate'

const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']

/**
 * 与官方示例一致的「输出设置」：模型、输出尺寸比例、清晰度 + 积分预估。
 * 用于 AI 美工各模块（局部重绘、局部消除、一键换色、智能扩图、提升质感、服装3D、服装平铺、调整身材、生成场景等）。
 * 父组件需维护 model / aspectRatio / clarity 状态，并在请求 /api/image-edit 时传入。
 */
export default function OutputSettings({
  model,
  aspectRatio,
  clarity,
  onModelChange,
  onAspectRatioChange,
  onClarityChange,
  hint = null,
}) {
  const handleModelChange = (m) => {
    onModelChange(m)
    onClarityChange(resolveClarityForModel(m, clarity))
    onAspectRatioChange(resolveAspectForModel(m, aspectRatio))
  }

  return (
    <details open className="group rounded-xl border border-gray-200 bg-white">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 select-none">
        <span>输出设置</span>
        <svg className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">模型</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {MODEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {hint && <p className="mt-1.5 text-xs text-amber-600">{hint}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">输出尺寸比例</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={aspectRatio}
            onChange={(e) => onAspectRatioChange(e.target.value)}
          >
            {getAspectOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">清晰度</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={clarity}
            onChange={(e) => onClarityChange(e.target.value)}
          >
            {getClarityOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
      <div className="border-t border-gray-100 px-4 pb-3">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <span className="text-xs text-gray-500">本次预计消耗</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-gray-800">
            <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3 3.25a.75.75 0 001.1 0l3-3.25a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
            </svg>
            {getPointsEstimate(model, clarity)} 积分
          </span>
        </div>
      </div>
    </details>
  )
}

export { MODEL_OPTIONS }
