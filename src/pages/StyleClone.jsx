import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import ImageLightbox from '../components/ImageLightbox'
import { saveBlobWithPicker } from '../lib/saveFileWithPicker'
import GeneratingOverlay from '../components/GeneratingOverlay'
import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'

const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']
const QUANTITY_OPTIONS = Array.from({ length: 15 }, (_, i) => `${i + 1}张`)
const MAX_REFERENCE = 14
const MAX_PRODUCT = 6

function fileToCompressedDataUrl(file, maxSize = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxSize || h > maxSize) {
        if (w >= h) { h = Math.round((h * maxSize) / w); w = maxSize }
        else { w = Math.round((w * maxSize) / h); h = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      try { resolve(canvas.toDataURL('image/jpeg', quality)) } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}

function GalleryThumb({ url, title, token, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const blobUrlRef = useRef(null)
  useEffect(() => {
    if (!url) return
    let revoked = false
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(url, { headers })
      .then((r) => r.ok ? r.blob() : Promise.reject())
      .then((blob) => {
        if (revoked) return
        const u = URL.createObjectURL(blob)
        blobUrlRef.current = u
        setBlobUrl(u)
      })
      .catch(() => {})
    return () => {
      revoked = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [url, token])
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl border-2 border-transparent hover:border-gray-800 transition"
    >
      {blobUrl ? (
        <img src={blobUrl} alt={title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
      ) : (
        <div className="h-full w-full bg-gray-100 animate-pulse" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition">
        <p className="text-[10px] text-white truncate">{title}</p>
      </div>
    </button>
  )
}

const SparkIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

const CubeIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

export default function StyleClone() {
  const { getToken, refreshUser } = useAuth()
  const [tab, setTab] = useState('single')
  const [referenceImages, setReferenceImages] = useState([])
  const [productImages, setProductImages] = useState([])
  const [optionalPrompt, setOptionalPrompt] = useState('')
  const [quantity, setQuantity] = useState('1张')
  const [model, setModel] = useState('Nano Banana Pro')
  const [clarity, setClarity] = useState('2K 高清')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState([])
  const [pointsUsed, setPointsUsed] = useState(null)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false, type: null })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const refInputRef = useRef(null)
  const productInputRef = useRef(null)

  const handleModelChange = (newModel) => {
    setModel(newModel)
    setClarity((prev) => resolveClarityForModel(newModel, prev))
    setAspectRatio((prev) => resolveAspectForModel(newModel, prev))
  }

  const addFiles = (type, files) => {
    const arr = Array.from(files || []).filter((f) => f.type?.startsWith('image/'))
    if (type === 'reference') {
      const max = MAX_REFERENCE - referenceImages.length
      const toAdd = arr.slice(0, max).map((f) => ({ file: f, dataUrl: URL.createObjectURL(f) }))
      setReferenceImages((prev) => [...prev, ...toAdd])
    } else {
      const max = MAX_PRODUCT - productImages.length
      const toAdd = arr.slice(0, max).map((f) => ({ file: f, dataUrl: URL.createObjectURL(f) }))
      setProductImages((prev) => [...prev, ...toAdd])
    }
    setError('')
    setResults([])
  }

  const removeRef = (i) => {
    referenceImages[i]?.dataUrl && URL.revokeObjectURL(referenceImages[i].dataUrl)
    setReferenceImages((prev) => prev.filter((_, j) => j !== i))
    setResults([])
  }

  const removeProduct = (i) => {
    productImages[i]?.dataUrl && URL.revokeObjectURL(productImages[i].dataUrl)
    setProductImages((prev) => prev.filter((_, j) => j !== i))
    setResults([])
  }

  const openGallery = async (type) => {
    setGalleryPicker({ open: true, type })
    if (galleryItems.length > 0) return
    setGalleryLoading(true)
    try {
      const token = getToken()
      if (!token) { setGalleryLoading(false); return }
      const res = await fetch('/api/gallery', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      setGalleryItems(data.items || [])
    } catch (_) {}
    setGalleryLoading(false)
  }

  const pickFromGallery = async (item, type) => {
    setGalleryPicker({ open: false, type: null })
    try {
      const token = getToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(item.url, { headers })
      const blob = await res.blob()
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
      if (type === 'reference' && referenceImages.length < MAX_REFERENCE) {
        setReferenceImages((prev) => [...prev, { file, dataUrl }])
      } else if (type === 'product' && productImages.length < MAX_PRODUCT) {
        setProductImages((prev) => [...prev, { file, dataUrl }])
      }
      setResults([])
      setError('')
    } catch (_) {}
  }

  const handleGenerate = async () => {
    if (referenceImages.length === 0) {
      setError('请上传至少 1 张参考设计图')
      return
    }
    if (productImages.length === 0) {
      setError('请上传至少 1 张产品素材图')
      return
    }
    setError('')
    setGenerating(true)
    setResults([])
    setPointsUsed(null)
    try {
      const refDataUrls = await Promise.all(
        referenceImages.map((r) => fileToCompressedDataUrl(r.file))
      )
      const productDataUrls = await Promise.all(
        productImages.map((p) => fileToCompressedDataUrl(p.file))
      )
      const count = parseInt(quantity.replace(/\D/g, ''), 10) || 1
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch('/api/style-clone', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          referenceImages: refDataUrls,
          productImages: productDataUrls,
          optionalPrompt: optionalPrompt.trim() || undefined,
          model,
          aspectRatio,
          clarity,
          quantity: count,
          mode: tab,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '风格复刻失败')
      setResults(data.images || [])
      setPointsUsed(data.pointsUsed ?? null)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '风格复刻失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (dataUrl, index) => {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, `风格复刻-${index + 1}.png`)
    } catch (_) {
      setError('保存失败')
    }
  }

  const totalPointsEstimate = () => {
    const count = parseInt(quantity.replace(/\D/g, ''), 10) || 1
    const perImg = model === 'Nano Banana Pro' ? 5 : model === 'Nano Banana 2' ? 3 : 2
    return count * perImg
  }

  return (
    <div className="relative min-h-screen bg-gray-100/80">
      <GeneratingOverlay open={generating} message="风格复刻中..." />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">引领风格复刻：从参考到爆款，仅需一步</h1>
        <p className="mt-1 text-sm text-gray-500 text-center">
          依托 AI 视觉生成技术，精准复刻爆款调性，为您的商品注入视觉销售力。
        </p>

        <div className="mt-8 grid lg:grid-cols-[400px_1fr] gap-6">
          <div className="space-y-6">
            {/* 上传参考设计图 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SparkIcon className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-900">上传参考设计图</h2>
                </div>
                <span className="text-xs text-gray-500">{referenceImages.length}/{MAX_REFERENCE}张</span>
              </div>
              <p className="mt-0.5 text-xs text-red-600">最好只上传一种风格的参考图，以免AI混淆风格。</p>
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addFiles('reference', e.target.files); e.target.value = '' }}
              />
              <div
                onClick={() => refInputRef.current?.click()}
                className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-6 text-center cursor-pointer hover:border-gray-400 transition"
              >
                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">点击或拖拽上传多张图片</p>
              </div>
              {referenceImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {referenceImages.map((r, i) => (
                    <div key={i} className="relative">
                      <img src={r.dataUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removeRef(i)}
                        className="absolute -right-1 -top-1 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-700"
                        aria-label="删除"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {getToken() && (
                <button
                  type="button"
                  onClick={() => openGallery('reference')}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  从作品库选择
                </button>
              )}
            </div>

            {/* 产品素材图 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CubeIcon className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-900">产品素材图</h2>
                </div>
                <span className="text-xs text-gray-500">{productImages.length}/{MAX_PRODUCT}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">上传需要复刻风格的产品素材图。<span className="text-red-600">只上传一个产品，不要上传多个产品。</span></p>
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addFiles('product', e.target.files); e.target.value = '' }}
              />
              <div
                onClick={() => productInputRef.current?.click()}
                className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-6 text-center cursor-pointer hover:border-gray-400 transition"
              >
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-xs text-gray-500">上传你希望出现在图片中的元素素材</p>
              </div>
              {productImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {productImages.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p.dataUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removeProduct(i)}
                        className="absolute -right-1 -top-1 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-700"
                        aria-label="删除"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {getToken() && (
                <button
                  type="button"
                  onClick={() => openGallery('product')}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  从作品库选择
                </button>
              )}
            </div>

            {/* 补充提示词 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">补充提示词 (可选)</h2>
              <textarea
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                placeholder="例如:添加「限时特惠」文字,使用红色主题..."
                value={optionalPrompt}
                onChange={(e) => setOptionalPrompt(e.target.value)}
              />
            </div>

            {/* 输出设置 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">输出设置</h2>
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
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || referenceImages.length === 0 || productImages.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <SparkIcon />
              生成 {quantity.replace('张', '')} 张详情图
            </button>
            <p className="text-center text-xs text-gray-500">预计消耗约 {totalPointsEstimate()} 积分</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* 右侧：生成结果 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="flex items-center gap-2">
              <CubeIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                {tab === 'batch' ? '批量生成结果' : '生成结果'}
              </h2>
            </div>
            {results.length > 0 ? (
              <>
                {pointsUsed != null && (
                  <p className="mt-2 text-xs text-gray-500">本次消耗 {pointsUsed} 积分，已自动保存至仓库</p>
                )}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {results.map((src, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => setLightbox({ open: true, src })}
                        className="rounded-lg overflow-hidden border border-gray-200 w-full aspect-square"
                      >
                        <img src={src} alt={`结果 ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(src, i)}
                        className="mt-2 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 transition"
                      >
                        ↓ 保存到本地
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-gray-100 p-6">
                  <SparkIcon className="h-14 w-14 text-gray-400" />
                </div>
                <p className="mt-4 text-sm font-medium text-gray-700">等待生成</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 图库选择弹窗 */}
      {galleryPicker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">从作品库选择</h3>
              <button type="button" onClick={() => setGalleryPicker({ open: false, type: null })} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {galleryLoading ? (
                <p className="text-gray-500">加载中...</p>
              ) : galleryItems.length === 0 ? (
                <p className="text-gray-500">图库为空</p>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {galleryItems.map((item) => (
                    <GalleryThumb
                      key={item.id}
                      url={item.url}
                      title={item.title}
                      token={getToken()}
                      onClick={() => pickFromGallery(item, galleryPicker.type)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="生成结果" onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
