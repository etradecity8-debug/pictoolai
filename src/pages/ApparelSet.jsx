import { useState } from 'react'
import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'

const STEPS = [
  { id: 1, label: '上传图片' },
  { id: 2, label: 'AI 分析' },
  { id: 3, label: '预览方案' },
  { id: 4, label: '生成中' },
  { id: 5, label: '完成' },
]

const TARGET_LANGUAGE_OPTIONS = [
  '无文字(纯视觉)',
  '中文(简体)',
  '中文(繁体)',
  '英语',
  '日语',
  '韩语',
  '德语',
  '法语',
  '阿拉伯语',
  '俄语',
  '泰语',
  '印尼语',
  '越南语',
  '马来语',
  '西班牙语',
  '葡萄牙语',
  '巴西葡萄牙语',
]
const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']

const SparkIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

export default function ApparelSet() {
  const [step, setStep] = useState(1)
  const [subTab, setSubTab] = useState('basic')
  const [uploadCount, setUploadCount] = useState(0)
  const [whiteFront, setWhiteFront] = useState(true)
  const [whiteBack, setWhiteBack] = useState(false)
  const [effect3d, setEffect3d] = useState(true)
  const [mannequin, setMannequin] = useState(true)
  const [detailCount, setDetailCount] = useState(1)
  const [sellingCount, setSellingCount] = useState(0)
  const [model, setModel] = useState('Nano Banana Pro')
  const [clarity, setClarity] = useState('2K 高清')
  const [aspectRatio, setAspectRatio] = useState('3:4 竖版')
  const maxImages = 6

  const handleModelChange = (newModel) => {
    setModel(newModel)
    setClarity((prev) => resolveClarityForModel(newModel, prev))
    setAspectRatio((prev) => resolveAspectForModel(newModel, prev))
  }

  const checkedCount = [whiteFront || whiteBack, effect3d, mannequin, detailCount > 0, sellingCount > 0].filter(Boolean).length

  return (
    <div className="min-h-screen bg-gray-100/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">智能生成服装详情图组</h1>
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">AI 服饰 BETA</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          上传服装产品图，AI 智能分析款式、面料与细节，自动生成白底精修、3D 立体展示及细节特写等电商级图组
        </p>

        {/* 进度条 */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-medium ${
                  step === s.id ? 'bg-gray-800 text-white' : i < step ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s.id}
              </span>
              <span className={`text-sm ${step === s.id ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-gray-300" aria-hidden />}
            </div>
          ))}
        </div>

        <div className="mt-8 grid lg:grid-cols-[400px_1fr] gap-6">
          {/* 左侧 */}
          <div className="space-y-6">
            {/* 模特试穿 / 基础套图 */}
            <div className="flex gap-1 rounded-lg bg-gray-200/80 p-1">
              <button
                type="button"
                onClick={() => setSubTab('model')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${subTab === 'model' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                模特试穿
              </button>
              <button
                type="button"
                onClick={() => setSubTab('basic')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${subTab === 'basic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                基础套图
              </button>
            </div>

            {/* 产品图 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">产品图</h2>
              <p className="mt-0.5 text-xs text-gray-500">上传多角度产品图或细节图</p>
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">拖拽或点击上传</p>
                <p className="mt-1 text-xs text-gray-500">{uploadCount}/{maxImages}</p>
              </div>
            </div>

            {/* 组图要求 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">组图要求</h2>
              <p className="mt-0.5 text-xs text-gray-500">描述您的产品信息和期望的图片风格</p>
              <textarea
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={4}
                placeholder={'款式名称、面料材质、设计亮点、适合人群、风格调性等\n例如:这是一款法式复古连衣裙, 采用重磅真丝面料, 特色是精致的蕾丝拼接和珍珠扣设...'}
              />
            </div>

            {/* 目标语言 / 模型 / 尺寸比例 / 清晰度 - 与全品类组图一致 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700">目标语言</label>
                <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" defaultValue="无文字(纯视觉)">
                  {TARGET_LANGUAGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
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
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {getAspectOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="col-span-2">
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

            {/* 选择生成类型 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">选择生成类型</h2>
              <p className="mt-0.5 text-xs text-gray-500">已勾选{checkedCount}项</p>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">白底精修图</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setWhiteFront(true); setWhiteBack(false); }}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${whiteFront ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      正面
                    </button>
                    <button
                      type="button"
                      onClick={() => { setWhiteBack(true); setWhiteFront(false); }}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${whiteBack ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      背面
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">3D立体效果图</p>
                  <p className="text-xs text-gray-500">白底图</p>
                  <button
                    type="button"
                    onClick={() => setEffect3d(!effect3d)}
                    className={`mt-1 rounded-lg border px-3 py-1.5 text-sm transition ${effect3d ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    白底图
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">人台图</p>
                  <p className="text-xs text-gray-500">白底图</p>
                  <button
                    type="button"
                    onClick={() => setMannequin(!mannequin)}
                    className={`mt-1 rounded-lg border px-3 py-1.5 text-sm transition ${mannequin ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    白底图
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">细节特写图</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => setDetailCount((n) => Math.max(0, n - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">−</button>
                    <span className="min-w-[2rem] text-center text-sm text-gray-900">{detailCount}</span>
                    <button type="button" onClick={() => setDetailCount((n) => n + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">+</button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">卖点图</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => setSellingCount((n) => Math.max(0, n - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">−</button>
                    <span className="min-w-[2rem] text-center text-sm text-gray-900">{sellingCount}</span>
                    <button type="button" onClick={() => setSellingCount((n) => n + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">+</button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition"
            >
              <SparkIcon />
              分析产品
            </button>
          </div>

          {/* 右侧 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h2 className="text-sm font-semibold text-gray-900">生成结果</h2>
            <p className="mt-1 text-xs text-gray-500">上传产品图并点击分析开始</p>
            <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="rounded-full bg-gray-100 p-6">
                <SparkIcon className="h-14 w-14 text-gray-400" />
              </div>
              <p className="mt-4 text-sm text-gray-600">上传产品图并填写要求后，点击「分析产品」开始</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
