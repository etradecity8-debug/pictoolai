import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'
import { getPointsPerImage } from '../lib/pointsConfig'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveBlobWithPicker } from '../lib/saveFileWithPicker'
import ImageLightbox from '../components/ImageLightbox'

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

const IMAGE_TYPE_LABELS = {
  main: '白底主图',
  scene: '场景图',
  closeUp: '特写图',
  sellingPoint: '卖点图',
  interaction: '交互图',
  general: '生成图片',
}
const IMAGE_TYPE_COLORS = {
  main: 'bg-gray-100 text-gray-600',
  scene: 'bg-blue-50 text-blue-600',
  closeUp: 'bg-purple-50 text-purple-600',
  sellingPoint: 'bg-orange-50 text-orange-600',
  interaction: 'bg-green-50 text-green-600',
  general: 'bg-gray-100 text-gray-500',
}

/** 尺寸比例文案 → 展示用的 Tailwind aspect 类，与用户选择一致 */
function aspectRatioToCssClass(label) {
  const map = {
    '1:1 正方形': 'aspect-square',
    '2:3 竖版': 'aspect-[2/3]',
    '3:2 横版': 'aspect-[3/2]',
    '3:4 竖版': 'aspect-[3/4]',
    '4:3 横版': 'aspect-[4/3]',
    '4:5 竖版': 'aspect-[4/5]',
    '5:4 横版': 'aspect-[5/4]',
    '9:16 手机竖屏': 'aspect-[9/16]',
    '16:9 宽屏': 'aspect-video',
    '21:9 超宽屏': 'aspect-[21/9]',
    '1:4 极竖': 'aspect-[1/4]',
    '1:8 极竖': 'aspect-[1/8]',
    '4:1 极横': 'aspect-[4/1]',
    '8:1 极横': 'aspect-[8/1]',
  }
  return map[label] || 'aspect-[3/4]'
}

/** 整体设计规范：直接按 Markdown 渲染为 HTML 展示 */
function SpecPreview({ markdown }) {
  if (!markdown || typeof markdown !== 'string') return null
  return (
    <div className="text-sm text-gray-700">
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          h2: ({ children }) => <h2 className="mt-6 first:mt-0 mb-1 text-lg font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-0.5 text-base font-semibold">{children}</h3>,
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

/** 小铅笔图标，用于标记/编辑 */
function PencilIcon({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      className={`inline-flex shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 ${className}`}
      title="编辑"
      aria-label="编辑"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** 压缩后转 data URL，长边不超过 maxSize，保持原图比例。输出比例由后端 image_config.aspect_ratio 控制，不裁剪上传图。 */
function fileToCompressedDataUrl(file, maxSize = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width
      let h = img.height
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round((h * maxSize) / w)
          w = maxSize
        } else {
          w = Math.round((w * maxSize) / h)
          h = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export default function DetailSet() {
  const navigate = useNavigate()
  const { user, getToken, refreshUser } = useAuth()
  const [step, setStep] = useState(1)
  const [productImages, setProductImages] = useState([])
  const [productName, setProductName] = useState('')
  const [sellingPoint1, setSellingPoint1] = useState('')
  const [sellingPoint2, setSellingPoint2] = useState('')
  const [sellingPoint3, setSellingPoint3] = useState('')
  const [sellingPoint4, setSellingPoint4] = useState('')
  const [sellingPoint5, setSellingPoint5] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [styleDesc, setStyleDesc] = useState('')
  const [otherRequirements, setOtherRequirements] = useState('')
  const [model, setModel] = useState('Nano Banana')
  const [clarity, setClarity] = useState('2K 高清')
  const [analyzing, setAnalyzing] = useState(false)
  const [designSpecMarkdown, setDesignSpecMarkdown] = useState('')
  const [imagePlan, setImagePlan] = useState([])
  const [analyzeError, setAnalyzeError] = useState('')
  const [mainImageCount, setMainImageCount] = useState(1)
  const [sceneImageCount, setSceneImageCount] = useState(1)
  const [closeUpImageCount, setCloseUpImageCount] = useState(1)
  const [sellingPointImageCount, setSellingPointImageCount] = useState(0)
  const [sellingPointShowText, setSellingPointShowText] = useState(false)
  const [interactionImageCount, setInteractionImageCount] = useState(0)
  const [aspectRatio, setAspectRatio] = useState('3:4 竖版')
  const [targetLanguage, setTargetLanguage] = useState('英语')
  const [generating, setGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState([])
  const [generateError, setGenerateError] = useState('')
  const maxImages = 6
  const [specCollapsed, setSpecCollapsed] = useState(false)
  const [editingSpec, setEditingSpec] = useState(false)
  const [editingPlanIndex, setEditingPlanIndex] = useState(null)
  /** 自定义确认弹窗（不显示 localhost，字体可调大） */
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null })
  const [lightbox, setLightbox] = useState({ open: false, src: null, alt: '' })

  /** 分析首次返回的原始内容（只在 runAnalyze 成功时写入，用户编辑不会覆盖），重置时恢复到此状态 */
  const originalDesignSpecRef = useRef('')
  const originalImagePlanRef = useRef([])

  const handleModelChange = (newModel) => {
    setModel(newModel)
    setClarity((prev) => resolveClarityForModel(newModel, prev))
    setAspectRatio((prev) => resolveAspectForModel(newModel, prev))
  }

  const resetToInputIfEdited = () => {
    if (step !== 5) return
    setStep(1)
    setDesignSpecMarkdown('')
    setImagePlan([])
    originalDesignSpecRef.current = ''
    originalImagePlanRef.current = []
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
    if (!productName.trim()) {
      setAnalyzeError('请填写产品名称后再开始分析')
      return
    }
    if (totalImageCount === 0) {
      setAnalyzeError('请在「生成数量」中至少选择一种图片类型')
      return
    }
    setAnalyzeError('')
    setStep(2)
    setAnalyzing(true)
    try {
      const requirementsParts = []
      if (productName.trim()) requirementsParts.push(`产品名称：${productName.trim()}`)
      if (sellingPointsLines.length) requirementsParts.push(`卖点：${sellingPointsLines.join('\n')}`)
      if (targetAudience.trim()) requirementsParts.push(`目标人群：${targetAudience.trim()}`)
      if (styleDesc.trim()) requirementsParts.push(`风格：${styleDesc.trim()}`)
      if (otherRequirements.trim()) requirementsParts.push(`其他要求：${otherRequirements.trim()}`)
      const combinedRequirements = requirementsParts.join('\n')
      const first = productImages[0]
      const base64 = await fileToCompressedDataUrl(first.file)
      const res = await fetch('/api/detail-set/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          requirements: combinedRequirements || undefined,
          model,
          mainCount: mainImageCount,
          sceneCount: sceneImageCount,
          closeUpCount: closeUpImageCount,
          sellingPointCount: effectiveSellingPointCount,
          sellingPoints: sellingPointsLines,
          sellingPointShowText,
          interactionCount: interactionImageCount,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || '分析失败')
      }
      const spec = data.designSpecMarkdown || ''
      const plan = Array.isArray(data.imagePlan) ? data.imagePlan : []
      setDesignSpecMarkdown(spec)
      setImagePlan(plan)
      originalDesignSpecRef.current = spec
      originalImagePlanRef.current = JSON.parse(JSON.stringify(plan))
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
      const productImageBase64 = productImages[0]
        ? await fileToCompressedDataUrl(productImages[0].file)
        : null
      const headers = { 'Content-Type': 'application/json' }
      if (getToken()) headers.Authorization = `Bearer ${getToken()}`
      const res = await fetch('/api/detail-set/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          designSpecMarkdown,
          imagePlan,
          model,
          clarity,
          aspectRatio: aspectRatio || '3:4 竖版',
          targetLanguage,
          sellingPointShowText,
          quantity: imagePlan.length,
          image: productImageBase64,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 402 && data.balance != null) {
          throw new Error(`积分不足：需要 ${data.required} 积分，当前剩余 ${data.balance}`)
        }
        throw new Error(data.error || '生成失败')
      }
      setGeneratedImages(Array.isArray(data.images) ? data.images : [])
      setStep(5)
      if (getToken()) refreshUser()
    } catch (err) {
      setGenerateError(err.message || '生成失败，请稍后重试')
      setStep(3)
    } finally {
      setGenerating(false)
    }
  }

  const sellingPointsLines = [sellingPoint1, sellingPoint2, sellingPoint3, sellingPoint4, sellingPoint5]
    .map(s => s.trim()).filter(Boolean)
  const effectiveSellingPointCount = Math.min(sellingPointImageCount, sellingPointsLines.length)
  const totalImageCount = mainImageCount + sceneImageCount + closeUpImageCount + effectiveSellingPointCount + interactionImageCount
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
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl min-w-[280px]">
            <svg className="h-12 w-12 animate-spin text-gray-700" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-gray-800">
              {analyzing ? '正在分析产品与要求...' : '正在生成图片...'}
            </p>
            <p className="text-xs text-gray-500">请勿关闭或刷新页面</p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="progress-bar-indeterminate h-full w-[40%] bg-gray-700 rounded-full"
                style={{ marginLeft: '-10%' }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">通用电商生图</h1>
          <p className="mt-1 text-sm text-gray-500">
            上传产品图，AI 智能分析产品特征，自动生成多角度、多场景的电商详情图组
          </p>

          {/* 进度条 */}
          <div className="mt-8 flex items-center justify-center gap-2">
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
        </div>

        {/* 左右双栏 */}
        <div className="mt-8 grid lg:grid-cols-[400px_1fr] gap-6">
          {/* 左侧：输入与设置 */}
          <div className="space-y-6">

            {/* 步骤 >= 3 时：已固化字段的提示条 */}
            {step >= 3 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-9V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2v-1" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9V5m0 0a2 2 0 10-4 0m4 0a2 2 0 114 0" />
                </svg>
                <div>
                  <p className="text-xs font-medium text-amber-700">产品信息已用于分析，已锁定</p>
                  <p className="mt-0.5 text-xs text-amber-600">如需修改产品图、组图要求或数量，请点「返回上一步」重新分析。</p>
                </div>
              </div>
            )}

            {/* 产品图上传 */}
            <div className={step >= 3 ? 'opacity-50 pointer-events-none select-none' : ''}>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-gray-900">产品图 <span className="text-red-500">*</span></h2>
                {step >= 3 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    已锁定
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">上传清晰的产品图片</p>
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="detail-set-upload"
                  onChange={handleFileChange}
                  disabled={step >= 3}
                />
                <label htmlFor="detail-set-upload" className={step >= 3 ? 'cursor-default' : 'cursor-pointer'}>
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
                        {step < 3 && (
                          <button
                            type="button"
                            className="absolute -right-1 -top-1 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-700"
                            aria-label="删除"
                            onClick={() => removeImage(i)}
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 组图要求 */}
            <div className={step >= 3 ? 'opacity-50 pointer-events-none select-none' : ''}>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-gray-900">组图要求</h2>
                {step >= 3 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    已锁定
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">填写产品信息，越详细 AI 生成效果越好</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    产品名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="例如：日式抹茶沐浴露"
                    value={productName}
                    onChange={(e) => {
                      setProductName(e.target.value)
                      resetToInputIfEdited()
                    }}
                  />
                </div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const val = [sellingPoint1, sellingPoint2, sellingPoint3, sellingPoint4, sellingPoint5][i - 1]
                  const setVal = [setSellingPoint1, setSellingPoint2, setSellingPoint3, setSellingPoint4, setSellingPoint5][i - 1]
                  return (
                    <div key={i}>
                      <label className="block text-xs font-medium text-gray-700">卖点 {i}</label>
                      <input
                        type="text"
                        readOnly={step >= 3}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={i === 1 ? '例如：天然成分（可选）' : `第 ${i} 条卖点（可选）`}
                        value={val}
                        onChange={(e) => {
                          setVal(e.target.value)
                          resetToInputIfEdited()
                        }}
                      />
                    </div>
                  )
                })}
                <div>
                  <label className="block text-xs font-medium text-gray-700">目标人群</label>
                  <input
                    type="text"
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="例如：25-40 岁女性、注重生活品质"
                    value={targetAudience}
                    onChange={(e) => {
                      setTargetAudience(e.target.value)
                      resetToInputIfEdited()
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">风格</label>
                  <input
                    type="text"
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="例如：日式极简、清新自然、高端质感"
                    value={styleDesc}
                    onChange={(e) => {
                      setStyleDesc(e.target.value)
                      resetToInputIfEdited()
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">其他要求</label>
                  <textarea
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    placeholder="其他补充说明，如特殊场景、禁忌元素等"
                    value={otherRequirements}
                    onChange={(e) => {
                      setOtherRequirements(e.target.value)
                      resetToInputIfEdited()
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 下拉设置：目标语言+模型，清晰度+尺寸比例 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-medium text-gray-700">尺寸比例</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                  >
                    {getAspectOptionsForModel(model).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 生成数量（多类型） */}
              <div className={`rounded-xl border border-gray-200 bg-white p-4 ${step >= 3 ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-medium text-gray-700">生图模型</label>
                </div>
                <p className="text-xs text-gray-500 mb-3">Nano Banana 兼容性较好；若遇网络错误可优先选此</p>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-semibold text-gray-800">生成数量（主图/场景/特写/交互图各 0～4 张；卖点图 0～5 张，对应你填写的卖点数）</label>
                  {step >= 3 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      已锁定
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">白底主图</label>
                    <select
                      disabled={step >= 3}
                      value={mainImageCount}
                      onChange={(e) => { setMainImageCount(Number(e.target.value)); resetToInputIfEdited() }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                    >
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">场景图</label>
                    <select
                      disabled={step >= 3}
                      value={sceneImageCount}
                      onChange={(e) => { setSceneImageCount(Number(e.target.value)); resetToInputIfEdited() }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                    >
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">特写图</label>
                    <select
                      disabled={step >= 3}
                      value={closeUpImageCount}
                      onChange={(e) => { setCloseUpImageCount(Number(e.target.value)); resetToInputIfEdited() }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                    >
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">卖点图</label>
                    <select
                      disabled={step >= 3}
                      value={Math.min(sellingPointImageCount, sellingPointsLines.length)}
                      onChange={(e) => { setSellingPointImageCount(Number(e.target.value)); resetToInputIfEdited() }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                    >
                      {Array.from({ length: sellingPointsLines.length + 1 }, (_, n) => (
                        <option key={n} value={n}>{n} 张</option>
                      ))}
                    </select>
                    {sellingPointsLines.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">最多 {sellingPointsLines.length} 张，对应你填写的 {sellingPointsLines.length} 条卖点</p>
                    )}
                    {effectiveSellingPointCount > 0 && (
                      <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sellingPointShowText}
                          onChange={(e) => setSellingPointShowText(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">卖点图上显示文字（按所选语言）</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">交互图</label>
                    <select
                      disabled={step >= 3}
                      value={interactionImageCount}
                      onChange={(e) => { setInteractionImageCount(Number(e.target.value)); resetToInputIfEdited() }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                    >
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-0.5">真人使用/手持产品的场景</p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-gray-500">
                  <p>白底主图：纯白底、产品约 85%、无文字</p>
                  <p>场景图：使用场景或生活化背景</p>
                  <p>特写图：产品细节、材质特写</p>
                  <p>卖点图：每张对应一条你填写的卖点，视觉化展示；可勾选「显示文字」在图上展示卖点文案</p>
                  <p>交互图：真人使用、手持或与产品互动的场景</p>
                </div>
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
            {productImages.length > 0 && !productName.trim() && !analyzeError && step < 3 && (
              <p className="text-xs text-amber-600">请填写产品名称后再开始分析</p>
            )}
            {productImages.length > 0 && productName.trim() && totalImageCount === 0 && !analyzeError && step < 3 && (
              <p className="text-xs text-amber-600">请在「生成数量」中至少选择一种图片类型</p>
            )}
            {step < 3 && totalImageCount > 0 && productImages.length > 0 && productName.trim() && (
              <p className="text-xs text-amber-700">
                预计消耗 {totalImageCount * getPointsPerImage(model, clarity)} 积分（{totalImageCount} 张 × {getPointsPerImage(model, clarity)} 积分/张）
              </p>
            )}
            {step < 3 && (
              <button
                type="button"
                disabled={analyzing || !productImages.length || !productName.trim() || totalImageCount === 0}
                onClick={runAnalyze}
                title={!productImages.length ? '请先上传产品图' : !productName.trim() ? '请填写产品名称' : totalImageCount === 0 ? '请选择至少一种图片类型' : ''}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {analyzing ? '分析中...' : !productImages.length ? '请先上传产品图' : !productName.trim() ? '请填写产品名称' : totalImageCount === 0 ? '请选择至少一种图片类型' : '分析产品'}
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
                <p className="mt-1 text-center text-xs text-amber-700">
                  预计消耗 {planCount * getPointsPerImage(model, clarity)} 积分（{planCount} 张 × {getPointsPerImage(model, clarity)} 积分/张）
                </p>
                {step === 5 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          open: true,
                          message: '返回将清除已生成图片，是否继续？',
                          onConfirm: () => {
                            setGeneratedImages([])
                            setStep(3)
                            setConfirmModal((m) => ({ ...m, open: false }))
                          },
                        })
                      }}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-1.5"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      返回上一步
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          open: true,
                          message: '新建将清除当前项目的设计规范、图片规划和已生成图片，是否继续？',
                          onConfirm: () => {
                            setDesignSpecMarkdown('')
                            setImagePlan([])
                            originalDesignSpecRef.current = ''
                            originalImagePlanRef.current = []
                            setGeneratedImages([])
                            setGenerateError('')
                            setAnalyzeError('')
                            setStep(1)
                            setConfirmModal((m) => ({ ...m, open: false }))
                          },
                        })
                      }}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                    >
                      新建项目
                    </button>
                  </>
                )}
              </>
            )}
            {(step >= 3 && step !== 4 && step !== 5) && (
              <button
                type="button"
                onClick={() => {
                  setConfirmModal({
                    open: true,
                    message: '返回将清除整体设计规范和图片规范，是否继续？',
                    onConfirm: () => {
                      setDesignSpecMarkdown('')
                      setImagePlan([])
                      originalDesignSpecRef.current = ''
                      originalImagePlanRef.current = []
                      setStep(1)
                      setConfirmModal((m) => ({ ...m, open: false }))
                    },
                  })
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                返回上一步
              </button>
            )}
          </div>

          {/* 右侧：生成结果 / 设计规范 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            {step >= 3 && step !== 4 && step !== 5 && designSpecMarkdown ? (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">设计规划预览</h2>
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="mt-1 text-sm text-gray-500">请确认设计规范和图片规划</p>
              </>
            ) : (
              <h2 className="text-sm font-semibold text-gray-900">
                {step === 5 ? '生成结果' : '生成结果'}
              </h2>
            )}
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
            {step === 5 && generatedImages.length > 0 && (() => {
              const typeOrder = ['main', 'scene', 'closeUp', 'sellingPoint', 'interaction', 'general']
              const groups = {}
              typeOrder.forEach((t) => { groups[t] = [] })
              generatedImages.forEach((img) => {
                const t = img.type && groups[img.type] !== undefined ? img.type : 'general'
                groups[t].push(img)
              })
              const hasTypes = generatedImages.some((img) => img.type && img.type !== 'general')

              const renderImageCard = (img) => (
                <div key={img.id} className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
                  <button
                    type="button"
                    className={`block w-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset ${aspectRatioToCssClass(aspectRatio)}`}
                    onClick={() => img.url && setLightbox({ open: true, src: img.url, alt: img.title })}
                  >
                    {img.url ? (
                      <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <p className="text-xs text-red-500 px-3 text-center">{img.error || '生成失败'}</p>
                      </div>
                    )}
                  </button>
                  <p className="p-3 text-sm font-medium text-gray-700 truncate">{img.title}</p>
                  {img.url && (
                    <div className="flex flex-wrap gap-2 px-3 pb-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(img.url)
                            const blob = await res.blob()
                            const name = (img.title || '图片').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.png'
                            await saveBlobWithPicker(blob, name)
                          } catch (_) {}
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        保存到本地
                      </button>
                    </div>
                  )}
                </div>
              )

              return (
                <div className="mt-6">
                  <p className="text-xs text-gray-500">共 {generatedImages.length} 张</p>
                  {hasTypes ? (
                    <div className="mt-4 space-y-6">
                      {typeOrder.map((t) => {
                        const imgs = groups[t]
                        if (!imgs || imgs.length === 0) return null
                        return (
                          <div key={t}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${IMAGE_TYPE_COLORS[t] || IMAGE_TYPE_COLORS.general}`}>
                                {IMAGE_TYPE_LABELS[t] || '图片'}
                              </span>
                              <span className="text-xs text-gray-400">{imgs.length} 张</span>
                            </div>
                            <div className="grid max-w-4xl grid-cols-2 gap-6">
                              {imgs.map(renderImageCard)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 grid max-w-4xl grid-cols-2 gap-6">
                      {generatedImages.map(renderImageCard)}
                    </div>
                  )}
                </div>
              )
            })()}
            {step >= 3 && step !== 4 && step !== 5 && designSpecMarkdown && (
              <div className="mt-6 space-y-6">
                {/* 整体设计规范：可折叠 + 铅笔编辑 */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-gray-50/80 transition"
                    onClick={() => setSpecCollapsed((c) => !c)}
                  >
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-gray-900">整体设计规范</h3>
                      <p className="mt-0.5 text-xs text-gray-500">所有图片遵循的统一视觉标准</p>
                    </div>
                    <span className="flex items-center gap-1 shrink-0">
                      <PencilIcon
                        onClick={(e) => { e?.stopPropagation?.(); setEditingSpec((s) => !s); setSpecCollapsed(false) }}
                      />
                      <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${specCollapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {!specCollapsed && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      {editingSpec ? (
                        <div className="mt-4">
                          <textarea
                            className="w-full min-h-[200px] rounded-lg border border-gray-300 p-3 text-sm text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary"
                            value={designSpecMarkdown}
                            onChange={(e) => setDesignSpecMarkdown(e.target.value)}
                            autoFocus
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSpec(false)}
                              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
                            >
                              完成编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDesignSpecMarkdown(originalDesignSpecRef.current)
                              }}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                            >
                              重置
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg bg-gray-50/80 p-5">
                          <SpecPreview markdown={designSpecMarkdown} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 图片规划：每项带铅笔，点击可编辑标题和描述 */}
                <div>
                  <h3 className="text-base font-bold text-gray-900">图片规划</h3>
                  <p className="mt-0.5 text-xs text-gray-500">共{planCount}张图片，点击铅笔可编辑标题和描述</p>
                  <ul className="mt-3 space-y-3">
                    {imagePlan.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm items-start"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-medium text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editingPlanIndex === i ? (
                            <>
                              <input
                                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary"
                                value={item.title}
                                onChange={(e) =>
                                  setImagePlan((prev) =>
                                    prev.map((p, j) => (j === i ? { ...p, title: e.target.value } : p))
                                  )
                                }
                                placeholder="图片标题"
                                autoFocus
                              />
                              <textarea
                                className="mt-2 w-full min-h-[80px] rounded border border-gray-300 p-2 text-sm text-gray-700 focus:border-primary focus:ring-1 focus:ring-primary"
                                value={item.contentMarkdown || ''}
                                onChange={(e) =>
                                  setImagePlan((prev) =>
                                    prev.map((p, j) => (j === i ? { ...p, contentMarkdown: e.target.value } : p))
                                  )
                                }
                                placeholder="描述/要点"
                              />
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPlanIndex(null)}
                                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
                                >
                                  完成编辑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const orig = originalImagePlanRef.current[i]
                                    if (orig) {
                                      setImagePlan((prev) =>
                                        prev.map((p, j) => (j === i ? { ...orig } : p))
                                      )
                                    }
                                  }}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                                >
                                  重置
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.type && IMAGE_TYPE_LABELS[item.type] && (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${IMAGE_TYPE_COLORS[item.type] || IMAGE_TYPE_COLORS.general}`}>
                                    {IMAGE_TYPE_LABELS[item.type]}
                                  </span>
                                )}
                                <p className="font-medium text-gray-900">{item.title}</p>
                                <PencilIcon onClick={() => setEditingPlanIndex(i)} />
                              </div>
                              {item.sellingPointText && (
                                <p className="mt-0.5 text-xs text-orange-600">卖点：{item.sellingPointText}</p>
                              )}
                              {item.contentMarkdown ? (
                                <div className="mt-2 text-sm text-gray-600">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkBreaks]}
                                    components={{
                                      h2: ({ children }) => <h2 className="mt-3 first:mt-0 mb-0.5 text-base font-semibold text-gray-900">{children}</h2>,
                                      h3: ({ children }) => <h3 className="mt-2 mb-0.5 text-sm font-semibold text-gray-800">{children}</h3>,
                                      p: ({ children }) => <p className="leading-relaxed my-1">{children}</p>,
                                      ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                                      strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
                                    }}
                                  >
                                    {item.contentMarkdown}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <p className="mt-1 text-sm text-gray-500">根据规划生成</p>
                              )}
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 自定义确认弹窗：不显示 localhost，字体更大 */}
      {confirmModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmModal((m) => ({ ...m, open: false }))}
        >
          <div
            className="rounded-2xl bg-white p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xl text-gray-800 leading-relaxed">{confirmModal.message}</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal((m) => ({ ...m, open: false }))}
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm?.()}
                className="rounded-xl bg-gray-800 px-5 py-3 text-lg font-medium text-white hover:bg-gray-700"
              >
                {confirmModal.confirmLabel || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox((p) => ({ ...p, open: false }))}
      />
    </div>
  )
}
