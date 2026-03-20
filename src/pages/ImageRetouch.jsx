import { useState } from 'react'
import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'

const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']
const BACKGROUND_OPTIONS = ['白底图', '透明底', '保留原背景']

const SparkIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

export default function ImageRetouch() {
  const [uploadCount, setUploadCount] = useState(0)
  const [model, setModel] = useState('Nano Banana')
  const [clarity, setClarity] = useState('2K 高清')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const maxImages = 50

  const handleModelChange = (newModel) => {
    setModel(newModel)
    setClarity((prev) => resolveClarityForModel(newModel, prev))
    setAspectRatio((prev) => resolveAspectForModel(newModel, prev))
  }

  return (
    <div className="min-h-screen bg-gray-100/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900">一键智能产品精修</h1>
        <p className="mt-1 text-sm text-gray-500">
          上传产品图片，AI 自动分析并优化画质、去除瑕疵、增强细节，让您的产品图更专业
        </p>

        <div className="mt-8 grid lg:grid-cols-[400px_1fr] gap-6">
          {/* 左侧 */}
          <div className="space-y-6">
            {/* 产品图 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">产品图</h2>
                <span className="text-xs text-gray-500">{uploadCount}/{maxImages}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">上传需要精修的产品图片</p>
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">点击上传或拖拽图片到此区域</p>
                <p className="mt-1 text-xs text-gray-500">支持 JPG、PNG 格式，最多 50 张</p>
              </div>
            </div>

            {/* 精修要求 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">精修要求</h2>
              <p className="mt-0.5 text-xs text-gray-500">描述您对图片精修的特殊需求 (可选)</p>
              <textarea
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={4}
                placeholder="例如:去除背景杂物、增强产品光泽、修复划痕、提升整体清晰度..."
              />
            </div>

            {/* 模型 / 背景设置 / 尺寸比例 / 清晰度 */}
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
                  <label className="block text-xs font-medium text-gray-700">背景设置</label>
                  <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" defaultValue="白底图">
                    {BACKGROUND_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">尺寸比例</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                  >
                    {getAspectOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
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
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              <SparkIcon />
              开始一键精修
            </button>
          </div>

          {/* 右侧：精修结果 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="flex items-center gap-2">
              <SparkIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">精修结果</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">上传产品图片后查看精修效果</p>
            <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="rounded-full bg-gray-100 p-6">
                <SparkIcon className="h-14 w-14 text-gray-400" />
              </div>
              <p className="mt-4 text-sm text-gray-600">上传产品图片后查看精修效果</p>
              <p className="mt-1 text-xs text-gray-500">点击左侧「开始一键精修」按钮</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
