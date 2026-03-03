import { useState } from 'react'
import { getClarityOptionsForModel } from '../lib/clarityByModel'

const STEPS = [
  { id: 1, label: '输入' },
  { id: 2, label: '分析中' },
  { id: 3, label: '确认规划' },
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
const ASPECT_OPTIONS = ['1:1 正方形', '2:3 竖版', '3:2 横版', '3:4 竖版', '4:3 横版', '4:5 竖版', '5:4 横版', '9:16 手机竖屏', '16:9 宽屏', '21:9 超宽屏']
const QUANTITY_OPTIONS = Array.from({ length: 15 }, (_, i) => `${i + 1}张`)

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function DetailSet() {
  const [step, setStep] = useState(1)
  const [productImages, setProductImages] = useState([])
  const [requirements, setRequirements] = useState('')
  const [model, setModel] = useState('Nano Banana Pro')
  const [clarity, setClarity] = useState('2K 高清')
  const [analyzing, setAnalyzing] = useState(false)
  const [designSpecMarkdown, setDesignSpecMarkdown] = useState('')
  const [imagePlan, setImagePlan] = useState([])
  const [analyzeError, setAnalyzeError] = useState('')
  const [quantity, setQuantity] = useState('3张')
  const [aspectRatio, setAspectRatio] = useState('3:4 竖版')
  const [targetLanguage, setTargetLanguage] = useState('英语')
  const [generating, setGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState([])
  const [generateError, setGenerateError] = useState('')
  const maxImages = 6

  const handleModelChange = (newModel) => {
    setModel(newModel)
    if (newModel === 'Nano Banana' && clarity !== '1K 标准') setClarity('1K 标准')
  }

  const resetToInputIfEdited = () => {
    if (step !== 5) return
    setStep(1)
    setDesignSpecMarkdown('')
    setImagePlan([])
    setGeneratedImages([])
    setGenerateError('')
    setAnalyzeError('')
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    const next = productImages.slice(0, maxImages)
    files.slice(0, maxImages - next.length).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const dataUrl = URL.createObjectURL(file)
      next.push({ file, dataUrl })
    })
    setProductImages(next)
    resetToInputIfEdited()
  }

  const removeImage = (index) => {
    const next = productImages.filter((_, i) => i !== index)
    productImages[index]?.dataUrl && URL.revokeObjectURL(productImages[index].dataUrl)
    setProductImages(next)
    resetToInputIfEdited()
  }

  const runAnalyze = async () => {
    if (!productImages.length) {
      setAnalyzeError('请先点击上方「产品图」区域，选择至少一张图片后再点分析')
      return
    }
    setAnalyzeError('')
    setStep(2)
    setAnalyzing(true)
    try {
      const first = productImages[0]
      const base64 = await fileToBase64(first.file)
      const res = await fetch('/api/detail-set/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          requirements: requirements.trim() || undefined,
          model,
          quantity: parseInt(quantity.replace(/\D/g, ''), 10) || 3,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || '分析失败')
      }
      setDesignSpecMarkdown(data.designSpecMarkdown || '')
      setImagePlan(Array.isArray(data.imagePlan) ? data.imagePlan : [])
      setStep(3)
    } catch (err) {
      const msg = err.message || ''
      const isNetwork = /failed to fetch|network error|load failed/i.test(msg) || err.name === 'TypeError'
      setAnalyzeError(isNetwork ? '无法连接后端，请确认后端已启动（在 server 目录运行 npm start）' : (msg || '分析失败，请稍后重试'))
      setStep(1)
    } finally {
      setAnalyzing(false)
    }
  }

  const runGenerate = async () => {
    if (!imagePlan.length) return
    setGenerateError('')
    setStep(4)
    setGenerating(true)
    try {
      const productImageBase64 = productImages[0] ? await fileToBase64(productImages[0].file) : null
      const res = await fetch('/api/detail-set/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designSpecMarkdown,
          imagePlan,
          model,
          clarity,
          aspectRatio,
          targetLanguage,
          quantity: imagePlan.length,
          image: productImageBase64,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '生成失败')
      setGeneratedImages(Array.isArray(data.images) ? data.images : [])
      setStep(5)
    } catch (err) {
      setGenerateError(err.message || '生成失败，请稍后重试')
      setStep(3)
    } finally {
      setGenerating(false)
    }
  }

  const planCount = imagePlan.length
  const isBusy = analyzing || generating

  return (
    <div className="min-h-screen bg-gray-100/80 relative">
      {/* 分析中/生成中：全页遮罩，禁止操作 */}
      {isBusy && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-[2px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl">
            <svg className="h-12 w-12 animate-spin text-gray-700" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-gray-800">
              {analyzing ? '正在分析产品与要求...' : '正在生成图片...'}
            </p>
            <p className="text-xs text-gray-500">请勿关闭或刷新页面</p>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900">一键生成详情图组</h1>
        <p className="mt-1 text-sm text-gray-500">
          上传产品图，AI 智能分析产品特征，自动生成多角度、多场景的电商详情图组
        </p>

        {/* 进度条 */}
        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-medium ${
                  step === s.id
                    ? 'bg-gray-800 text-white'
                    : i < step
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s.id}
              </span>
              <span className={`text-sm ${step === s.id ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="mx-1 h-px w-4 bg-gray-300" aria-hidden />
              )}
            </div>
          ))}
        </div>

        {/* 左右双栏 */}
        <div className="mt-8 grid lg:grid-cols-[400px_1fr] gap-6">
          {/* 左侧：输入与设置 */}
          <div className="space-y-6">
            {/* 产品图上传 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">产品图</h2>
              <p className="mt-0.5 text-xs text-gray-500">上传清晰的产品图片</p>
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="detail-set-upload"
                  onChange={handleFileChange}
                />
                <label htmlFor="detail-set-upload" className="cursor-pointer">
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    点击或拖拽上传，多图建议仅上传必要视角
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {productImages.length}/{maxImages}
                  </p>
                </label>
                {productImages.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {productImages.map((item, i) => (
                      <div key={i} className="relative">
                        <img src={item.dataUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-700"
                          aria-label="删除"
                          onClick={() => removeImage(i)}
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 组图要求 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">组图要求</h2>
              <p className="mt-0.5 text-xs text-gray-500">描述您的产品信息和期望的图片风格</p>
              <textarea
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={5}
                placeholder={'建议输入：产品名称、卖点、目标人群、详情图风格等\n例如：这是一款日式抹茶沐浴露，主打天然成分和舒缓放松功效，目标人群为 25-40 岁...'}
                value={requirements}
                onChange={(e) => {
                  setRequirements(e.target.value)
                  resetToInputIfEdited()
                }}
              />
            </div>

            {/* 下拉设置 */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">目标语言</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                >
                  {TARGET_LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">模型</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={model}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">尺寸比例</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {ASPECT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">清晰度</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={clarity}
                  onChange={(e) => setClarity(e.target.value)}
                >
                  {getClarityOptionsForModel(model).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">生成数量</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value)
                    resetToInputIfEdited()
                  }}
                >
                  {QUANTITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {analyzeError && (
              <p className="text-sm text-red-600">{analyzeError}</p>
            )}
            {generateError && (
              <p className="text-sm text-red-600">{generateError}</p>
            )}
            {!productImages.length && !analyzeError && step < 3 && (
              <p className="text-xs text-amber-600">请先在上方「产品图」区域点击并选择至少一张图片，再点下方按钮</p>
            )}
            {step < 3 && (
              <button
                type="button"
                disabled={analyzing || !productImages.length}
                onClick={runAnalyze}
                title={!productImages.length ? '请先上传产品图' : ''}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {analyzing ? '分析中...' : productImages.length ? '分析产品' : '请先上传产品图'}
              </button>
            )}
            {(step === 3 || step === 5) && planCount > 0 && (
              <>
                <button
                  type="button"
                  disabled={generating}
                  onClick={runGenerate}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {step === 5 ? `再次生成 ${planCount} 张图片` : `→ 确认生成 ${planCount} 张图片`}
                </button>
                <p className="mt-1 text-center text-xs text-gray-500">消耗 {planCount * 3} 积分</p>
                {step === 5 && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    返回修改规划
                  </button>
                )}
              </>
            )}
          </div>

          {/* 右侧：生成结果 / 设计规范 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h2 className="text-sm font-semibold text-gray-900">
              {step === 5 ? '生成结果' : step >= 3 ? '设计规划预览' : '生成结果'}
            </h2>
            {step === 1 && (
              <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-gray-100 p-6">
                  <svg className="h-14 w-14 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-700">上传产品图并点击分析开始</p>
                <p className="mt-1 text-xs text-gray-500">上传产品图并填写要求后，点击「分析产品」开始</p>
              </div>
            )}
            {step === 2 && (
              <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-gray-100 p-6">
                  <svg className="h-14 w-14 animate-pulse text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-700">正在分析产品与要求...</p>
                <p className="mt-1 text-xs text-gray-500">生成整体设计规范与图片规划</p>
              </div>
            )}
            {step === 4 && (
              <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-gray-100 p-6">
                  <svg className="h-14 w-14 animate-pulse text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-700">正在生成图片...</p>
                <p className="mt-1 text-xs text-gray-500">根据设计规范与图片规划生成中</p>
              </div>
            )}
            {step === 5 && generatedImages.length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-gray-500">共 {generatedImages.length} 张</p>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {generatedImages.map((img) => (
                    <div key={img.id} className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                      <img src={img.url} alt={img.title} className="w-full aspect-[3/4] object-cover" />
                      <p className="p-2 text-xs font-medium text-gray-700 truncate">{img.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step >= 3 && step !== 4 && step !== 5 && designSpecMarkdown && (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">整体设计规范</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800 font-sans">
                    {designSpecMarkdown}
                  </pre>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">图片规划</h3>
                  <p className="mt-1 text-xs text-gray-500">共{planCount}张图片，点击可编辑标题和描述</p>
                  <ul className="mt-2 space-y-4">
                    {imagePlan.map((item, i) => (
                      <li key={i} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700 font-sans">
                          {item.contentMarkdown || ''}
                        </pre>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
