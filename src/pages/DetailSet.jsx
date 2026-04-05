import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'
import { getPointsPerImage } from '../lib/pointsConfig'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveBlobWithPicker } from '../lib/saveFileWithPicker'
import ImageLightbox from '../components/ImageLightbox'
import {
  EXT_DOM_IMPORT_EVENT,
  EXT_MSG_SOURCE,
  EXT_MSG_IMPORT,
  EXT_WEB_SOURCE,
  EXT_IMPORT_ACK,
  EXT_REQUEST_IMPORT,
} from '../lib/extensionBridgeConstants'

/** React Strict Mode 双重挂载时，ACK 会清空 storage，用模块缓存保留本次导入 */
let detailSetExtImportCache = null

/**
 * 扩展 toolId → 图片类型
 * 与 background.js DETAIL_SET_ENTRIES 的 toolId 对应；未识别时回落到 main。
 */
const TYPE_FROM_TOOL_ID = {
  'detail-set':               'main',
  'detail-set-main':          'main',
  'detail-set-closeup':       'closeup',
  'detail-set-sellingpoint':  'sellingpoint',
  'detail-set-scene':         'scene',
  'detail-set-interaction':   'interaction',
}

/**
 * 把扩展传入的 base64 data URL 转换为 { file, dataUrl } 产品图槽位。
 * dataUrl 用 createObjectURL，与 handleFileChange 保持一致（file 供后续压缩用）。
 */
async function dataUrlToProductSlot(base64DataUrl) {
  const res = await fetch(base64DataUrl)
  const blob = await res.blob()
  const file = new File([blob], 'extension-input.jpg', { type: blob.type || 'image/jpeg' })
  const objectUrl = URL.createObjectURL(file)
  return { file, dataUrl: objectUrl }
}

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

/** 根据数量动态维护数组，增补空串、截断超出 */
function ensureArray(arr, len, defaultVal = '') {
  const a = Array.isArray(arr) ? [...arr] : []
  while (a.length < len) a.push(defaultVal)
  return a.slice(0, len)
}

export default function DetailSet() {
  const navigate = useNavigate()
  const { user, getToken, refreshUser } = useAuth()
  const [step, setStep] = useState(1)
  const [productImages, setProductImages] = useState([])
  const [productName, setProductName] = useState('')
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
  const [sceneShowText, setSceneShowText] = useState(false)
  const [closeUpShowText, setCloseUpShowText] = useState(false)
  const [interactionShowText, setInteractionShowText] = useState(false)
  const [interactionImageCount, setInteractionImageCount] = useState(0)
  /** 按类型存储用户描述：选 X 张 → 写 X 个 */
  const [sellingPointDescs, setSellingPointDescs] = useState([])
  const [sceneDescs, setSceneDescs] = useState([])
  const [closeUpDescs, setCloseUpDescs] = useState([])
  const [interactionDescs, setInteractionDescs] = useState([])
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

  // ── 浏览器扩展握手（完全对齐 AiDesigner.jsx 已验证模式）──────────────────────
  const [searchParams] = useSearchParams()
  const extMode = searchParams.get('ext') === '1'
  const lastAppliedExtImportKey = useRef(null)
  /** 扩展传入的原始 payload（同步存入 state，由下方独立 useEffect 做 async 转换） */
  const [extImport, setExtImport] = useState(null)

  // Step 1：与 bridge.js 握手，payload 同步写入 extImport state（不做任何 async 操作）
  useEffect(() => {
    if (!extMode) {
      detailSetExtImportCache = null
      lastAppliedExtImportKey.current = null
      return
    }
    // Strict Mode 第二次挂载：cache 已由第一次挂载的事件处理填充，直接 replay
    if (detailSetExtImportCache) {
      lastAppliedExtImportKey.current = `${detailSetExtImportCache.ts ?? 0}|${String(detailSetExtImportCache.dataUrl).slice(0, 80)}`
      setExtImport(detailSetExtImportCache)
    }
    function applyImportPayload(payload) {
      if (!payload?.dataUrl || !String(payload.toolId || '').startsWith('detail-set')) return
      const key = `${payload.ts ?? 0}|${String(payload.dataUrl).slice(0, 80)}`
      if (lastAppliedExtImportKey.current === key) return
      lastAppliedExtImportKey.current = key
      detailSetExtImportCache = payload
      setExtImport(payload)
      window.postMessage({ source: EXT_WEB_SOURCE, type: EXT_IMPORT_ACK }, '*')
    }
    function onDomImport(ev) { applyImportPayload(ev.detail) }
    function onMsg(ev) {
      if (ev.data?.source !== EXT_MSG_SOURCE || ev.data?.type !== EXT_MSG_IMPORT) return
      applyImportPayload(ev.data.payload)
    }
    window.addEventListener(EXT_DOM_IMPORT_EVENT, onDomImport)
    window.addEventListener('message', onMsg)
    window.postMessage({ source: EXT_WEB_SOURCE, type: EXT_REQUEST_IMPORT }, '*')
    return () => {
      window.removeEventListener(EXT_DOM_IMPORT_EVENT, onDomImport)
      window.removeEventListener('message', onMsg)
    }
  }, [extMode])

  // Step 2：extImport 变化后做 async 转换并更新各 state（带 cancelled 防 Strict Mode 竞态）
  useEffect(() => {
    if (!extImport?.dataUrl) return
    let cancelled = false

    // 根据 toolId 预设图片类型与张数
    const imgType = TYPE_FROM_TOOL_ID[extImport.toolId] || 'main'
    setMainImageCount(         imgType === 'main'          ? 1 : 0)
    setCloseUpImageCount(      imgType === 'closeup'       ? 1 : 0)
    setSellingPointImageCount( imgType === 'sellingpoint'  ? 1 : 0)
    setSceneImageCount(        imgType === 'scene'         ? 1 : 0)
    setInteractionImageCount(  imgType === 'interaction'   ? 1 : 0)
    setCloseUpDescs(      imgType === 'closeup'      ? [''] : [])
    setSellingPointDescs( imgType === 'sellingpoint' ? [''] : [])
    setSceneDescs(        imgType === 'scene'        ? [''] : [])
    setInteractionDescs(  imgType === 'interaction'  ? [''] : [])

    // 重置分析/生成状态
    setStep(1)
    setDesignSpecMarkdown('')
    setImagePlan([])
    setGeneratedImages([])
    setAnalyzeError('')
    setGenerateError('')
    originalDesignSpecRef.current = ''
    originalImagePlanRef.current = []

    // async 转换图片（cancelled 防止 Strict Mode 双挂载时旧 promise 污染）
    dataUrlToProductSlot(extImport.dataUrl)
      .then(slot => {
        if (cancelled) return
        setProductImages(prev => {
          prev.forEach(item => item.dataUrl && URL.revokeObjectURL(item.dataUrl))
          return [slot]
        })
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [extImport?.dataUrl])
  // ── 扩展握手结束 ─────────────────────────────────────────────────────────────

  const handleModelChange = (newModel) => {
    setModel(newModel)
    setClarity((prev) => resolveClarityForModel(newModel, prev))
    setAspectRatio((prev) => resolveAspectForModel(newModel, prev))
  }

  const setDescAt = (setter, arr, index, value) => {
    const next = [...ensureArray(arr, Math.max(arr?.length || 0, index + 1))]
    next[index] = value
    setter(next)
  }

  const syncDescsOnCountChange = (count, setter) => {
    setter(prev => ensureArray(prev, count))
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
    if (sellingPointImageCount > 0 && sellingPointsLines.length < sellingPointImageCount) {
      setAnalyzeError(`已选 ${sellingPointImageCount} 张卖点图，请填写 ${sellingPointImageCount} 条卖点描述`)
      return
    }
    if (sceneImageCount > 0 && scDescs.some(d => !d.trim())) {
      setAnalyzeError('请填写每张场景图的场景描述')
      return
    }
    if (closeUpImageCount > 0 && cuDescs.some(d => !d.trim())) {
      setAnalyzeError('请填写每张特写图的细节描述')
      return
    }
    if (interactionImageCount > 0 && itDescs.some(d => !d.trim())) {
      setAnalyzeError('请填写每张交互图的交互描述')
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
          sceneDescriptions: scDescs.map(d => d.trim()).filter(Boolean),
          closeUpDescriptions: cuDescs.map(d => d.trim()).filter(Boolean),
          interactionDescriptions: itDescs.map(d => d.trim()).filter(Boolean),
          sceneShowText,
          closeUpShowText,
          interactionShowText,
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
          sceneShowText,
          closeUpShowText,
          interactionShowText,
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

  /** 同步描述数组长度与数量选择 */
  const spDescs = ensureArray(sellingPointDescs, sellingPointImageCount)
  const scDescs = ensureArray(sceneDescs, sceneImageCount)
  const cuDescs = ensureArray(closeUpDescs, closeUpImageCount)
  const itDescs = ensureArray(interactionDescs, interactionImageCount)
  const sellingPointsLines = spDescs.map(s => s.trim()).filter(Boolean)
  const effectiveSellingPointCount = sellingPointImageCount <= 0 ? 0 : Math.min(sellingPointImageCount, sellingPointsLines.length)
  const totalImageCount = mainImageCount + sceneImageCount + closeUpImageCount + effectiveSellingPointCount + interactionImageCount
  const canAnalyze = productImages.length > 0 && productName.trim() && totalImageCount > 0
    && (sellingPointImageCount <= 0 || sellingPointsLines.length >= sellingPointImageCount)
    && (sceneImageCount <= 0 || scDescs.every(d => d.trim()))
    && (closeUpImageCount <= 0 || cuDescs.every(d => d.trim()))
    && (interactionImageCount <= 0 || itDescs.every(d => d.trim()))
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

            {/* 产品名称 + 通用设置 */}
            <div className={step >= 3 ? 'opacity-50 pointer-events-none select-none' : ''}>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-gray-900">产品信息</h2>
                {step >= 3 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    已锁定
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">产品名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="例如：便携式咖啡机、无线蓝牙耳机"
                    value={productName}
                    onChange={(e) => { setProductName(e.target.value); resetToInputIfEdited() }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">目标人群</label>
                  <input
                    type="text"
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="例如：都市白领、咖啡爱好者"
                    value={targetAudience}
                    onChange={(e) => { setTargetAudience(e.target.value); resetToInputIfEdited() }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">风格</label>
                  <input
                    type="text"
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="例如：简约现代、科技感、北欧风"
                    value={styleDesc}
                    onChange={(e) => { setStyleDesc(e.target.value); resetToInputIfEdited() }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">其他要求</label>
                  <textarea
                    readOnly={step >= 3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    placeholder="补充需避开的元素等（选填）"
                    value={otherRequirements}
                    onChange={(e) => { setOtherRequirements(e.target.value); resetToInputIfEdited() }}
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

            {/* 生成数量与描述：选 X 张 → 写 X 个描述 */}
            <div className={`space-y-4 ${step >= 3 ? 'opacity-50 pointer-events-none select-none' : ''}`}>
              <h2 className="text-sm font-semibold text-gray-900">生成数量与描述</h2>
              <p className="text-xs text-gray-500 -mt-2">选择每种类型的张数，选 X 张需填写 X 条对应描述（白底主图无需描述）</p>

              {/* 白底主图：仅数量 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">白底主图</span>
                    <p className="text-xs text-gray-500 mt-0.5">纯白底、产品约 85%、无文字，无需描述</p>
                  </div>
                  <select
                    disabled={step >= 3}
                    value={mainImageCount}
                    onChange={(e) => { setMainImageCount(Number(e.target.value)); resetToInputIfEdited() }}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                  >
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                  </select>
                </div>
              </div>

              {/* 卖点图：数量 + X 个输入 */}
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-600">卖点图</span>
                    <p className="text-xs text-gray-500 mt-0.5">每张对应一条卖点，视觉化展示</p>
                  </div>
                  <select
                    disabled={step >= 3}
                    value={sellingPointImageCount}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setSellingPointImageCount(n)
                      syncDescsOnCountChange(n, setSellingPointDescs)
                      resetToInputIfEdited()
                    }}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 张</option>)}
                  </select>
                </div>
                {sellingPointImageCount > 0 && (
                  <div className="space-y-2">
                    {spDescs.map((val, i) => (
                      <div key={i}>
                        <label className="block text-xs text-gray-600 mb-0.5">卖点 {i + 1} <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          readOnly={step >= 3}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder={`例如：一键萃取、便携易带`}
                          value={val}
                          onChange={(e) => { setDescAt(setSellingPointDescs, spDescs, i, e.target.value); resetToInputIfEdited() }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 特写图：数量 + X 个输入 */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-600">特写图</span>
                    <p className="text-xs text-gray-500 mt-0.5">产品细节、材质特写</p>
                  </div>
                  <select
                    disabled={step >= 3}
                    value={closeUpImageCount}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setCloseUpImageCount(n)
                      syncDescsOnCountChange(n, setCloseUpDescs)
                      resetToInputIfEdited()
                    }}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                  >
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                  </select>
                </div>
                {closeUpImageCount > 0 && (
                  <div className="space-y-2">
                    {cuDescs.map((val, i) => (
                      <div key={i}>
                        <label className="block text-xs text-gray-600 mb-0.5">细节 {i + 1} 描述 <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          readOnly={step >= 3}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder={`例如：表面磨砂质感、按钮特写`}
                          value={val}
                          onChange={(e) => { setDescAt(setCloseUpDescs, cuDescs, i, e.target.value); resetToInputIfEdited() }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 场景图：数量 + X 个输入 */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-600">场景图</span>
                    <p className="text-xs text-gray-500 mt-0.5">使用场景或生活化背景</p>
                  </div>
                  <select
                    disabled={step >= 3}
                    value={sceneImageCount}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setSceneImageCount(n)
                      syncDescsOnCountChange(n, setSceneDescs)
                      resetToInputIfEdited()
                    }}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                  >
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                  </select>
                </div>
                {sceneImageCount > 0 && (
                  <div className="space-y-2">
                    {scDescs.map((val, i) => (
                      <div key={i}>
                        <label className="block text-xs text-gray-600 mb-0.5">场景 {i + 1} 描述 <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          readOnly={step >= 3}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder={`例如：咖啡厅桌上、办公室桌面`}
                          value={val}
                          onChange={(e) => { setDescAt(setSceneDescs, scDescs, i, e.target.value); resetToInputIfEdited() }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 交互图：数量 + X 个输入 */}
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-600">交互图</span>
                    <p className="text-xs text-gray-500 mt-0.5">真人使用、手持或与产品互动</p>
                  </div>
                  <select
                    disabled={step >= 3}
                    value={interactionImageCount}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setInteractionImageCount(n)
                      syncDescsOnCountChange(n, setInteractionDescs)
                      resetToInputIfEdited()
                    }}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                  >
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                  </select>
                </div>
                {interactionImageCount > 0 && (
                  <div className="space-y-2">
                    {itDescs.map((val, i) => (
                      <div key={i}>
                        <label className="block text-xs text-gray-600 mb-0.5">交互 {i + 1} 描述 <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          readOnly={step >= 3}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder={`例如：手持使用、放在腿上操作`}
                          value={val}
                          onChange={(e) => { setDescAt(setInteractionDescs, itDescs, i, e.target.value); resetToInputIfEdited() }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>

            {/* 生图文字选项：与规划一致，步骤 3 后锁定 */}
            {(sellingPointImageCount > 0 || sceneImageCount > 0 || closeUpImageCount > 0 || interactionImageCount > 0) && (
              <div className={`rounded-xl border border-gray-200 bg-gray-50/80 p-4 ${step >= 3 ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                <div className="flex items-center gap-1.5 mb-3">
                  <p className="text-xs font-medium text-gray-700">图片是否显示文字</p>
                  {step >= 3 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      已锁定
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {sellingPointImageCount > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={sellingPointShowText} onChange={(e) => setSellingPointShowText(e.target.checked)} className="rounded border-gray-300" />
                      <span className="text-xs text-gray-600">卖点图</span>
                    </label>
                  )}
                  {closeUpImageCount > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={closeUpShowText} onChange={(e) => setCloseUpShowText(e.target.checked)} className="rounded border-gray-300" />
                      <span className="text-xs text-gray-600">特写图</span>
                    </label>
                  )}
                  {sceneImageCount > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={sceneShowText} onChange={(e) => setSceneShowText(e.target.checked)} className="rounded border-gray-300" />
                      <span className="text-xs text-gray-600">场景图</span>
                    </label>
                  )}
                  {interactionImageCount > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={interactionShowText} onChange={(e) => setInteractionShowText(e.target.checked)} className="rounded border-gray-300" />
                      <span className="text-xs text-gray-600">交互图</span>
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">勾选=规划与生图中显示文字，不勾选=规划与生图中均为纯视觉图（无标题/文案）</p>
              </div>
            )}

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
            {productImages.length > 0 && productName.trim() && totalImageCount > 0 && !canAnalyze && !analyzeError && step < 3 && (
              <p className="text-xs text-amber-600">请完成所选类型对应的描述填写</p>
            )}
            {step < 3 && totalImageCount > 0 && productImages.length > 0 && productName.trim() && canAnalyze && (
              <p className="text-xs text-amber-700">
                预计消耗 {totalImageCount * getPointsPerImage(model, clarity)} 积分（{totalImageCount} 张 × {getPointsPerImage(model, clarity)} 积分/张）
              </p>
            )}
            {step < 3 && (
              <button
                type="button"
                disabled={analyzing || !canAnalyze}
                onClick={runAnalyze}
                title={!productImages.length ? '请先上传产品图' : !productName.trim() ? '请填写产品名称' : totalImageCount === 0 ? '请选择至少一种图片类型' : !canAnalyze ? '请完成所选类型对应的描述填写' : ''}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {analyzing ? '分析中...' : !productImages.length ? '请先上传产品图' : !productName.trim() ? '请填写产品名称' : totalImageCount === 0 ? '请选择至少一种图片类型' : !canAnalyze ? '请完成描述填写' : '分析产品'}
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
