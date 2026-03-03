import { useState } from 'react'
import { getClarityOptionsForModel } from '../lib/clarityByModel'

const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']
const ASPECT_OPTIONS = ['1:1 正方形', '2:3 竖版', '3:2 横版', '3:4 竖版', '4:3 横版', '4:5 竖版', '5:4 横版', '9:16 手机竖屏', '16:9 宽屏', '21:9 超宽屏']
const QUANTITY_OPTIONS = Array.from({ length: 15 }, (_, i) => `${i + 1}张`)

const SparkIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

export default function StyleClone() {
  const [tab, setTab] = useState('single')
  const [productCount, setProductCount] = useState(0)
  const [turbo, setTurbo] = useState(false)
  const [quantity, setQuantity] = useState('1张')
  const [model, setModel] = useState('Nano Banana Pro')
  const [clarity, setClarity] = useState('2K 高清')
  const maxProduct = 6

  const handleModelChange = (newModel) => {
    setModel(newModel)
    if (newModel === 'Nano Banana' && clarity !== '1K 标准') setClarity('1K 标准')
  }

  return (
    <div className="min-h-screen bg-gray-100/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900">一键复刻爆款详情页风格</h1>
        <p className="mt-1 text-sm text-gray-500">
          上传您喜欢的设计参考图和产品素材，AI 将智能融合风格与产品特性，生成专属于您的高转化详情图
        </p>

        {/* 单图复刻 / 批量复刻 */}
        <div className="mt-6 flex gap-1 rounded-lg bg-gray-200/80 p-1">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
              tab === 'single' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <SparkIcon className="h-4 w-4" />
            单图复刻
          </button>
          <button
            type="button"
            onClick={() => setTab('batch')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
              tab === 'batch' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            批量复刻
          </button>
        </div>

        <div className="mt-8 grid lg:grid-cols-[400px_1fr] gap-6">
          {/* 左侧 */}
          <div className="space-y-6">
            {/* 参考设计图 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">参考设计图</h2>
              <p className="mt-0.5 text-xs text-gray-500">上传具有明确风格的参考图</p>
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">拖拽图片到这里</p>
                <p className="mt-0.5 text-xs text-gray-500">或点击选择文件 (PNG, JPG)</p>
              </div>
            </div>

            {/* 产品素材图 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">产品素材图</h2>
                <span className="text-xs text-gray-500">{productCount}/{maxProduct}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">上传产品图片</p>
              <p className="text-xs text-gray-500">上传你希望出现在图片中的元素素材</p>
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-6 text-center">
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-xs text-gray-500">拖拽或点击上传</p>
              </div>
            </div>

            {/* 补充提示词 (可选) */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">补充提示词 (可选)</h2>
              <textarea
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                placeholder="例如:添加「限时特惠」文字,使用红色主题..."
              />
            </div>

            {/* 模型 / 尺寸比例 / 清晰度 / 生成数量 - 与全品类组图一致 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">模型</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={model}
                    onChange={(e) => handleModelChange(e.target.value)}
                  >
                    {MODEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">尺寸比例</label>
                  <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" defaultValue="3:4 竖版">
                    {ASPECT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">清晰度</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={clarity}
                    onChange={(e) => setClarity(e.target.value)}
                  >
                    {getClarityOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">生成数量</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  >
                    {QUANTITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              {/* Turbo 加速模式 */}
              <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Turbo 加速模式</p>
                  <p className="text-xs text-gray-500">更快、更稳定</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={turbo}
                  onClick={() => setTurbo(!turbo)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    turbo ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${turbo ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              <SparkIcon />
              生成 {quantity.replace('张', '')} 张详情图
            </button>
            <p className="text-center text-xs text-gray-500">消耗 5 积分</p>
          </div>

          {/* 右侧：生成结果 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="flex items-center gap-2">
              <SparkIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">生成结果</h2>
            </div>
            <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="rounded-full bg-gray-100 p-6">
                <SparkIcon className="h-14 w-14 text-gray-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-gray-700">等待生成</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
