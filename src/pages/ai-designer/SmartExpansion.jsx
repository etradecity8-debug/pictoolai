import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import { loadImageFromGalleryId } from '../../lib/loadGalleryImage'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'
import { loadImageFromGalleryUrl } from '../../lib/loadGalleryImage'
import { dataUrlToImageSlot } from '../../lib/extensionImage'
import ExtensionReplaceButton from '../../components/ExtensionReplaceButton'

const EXPANSION_RATIOS = [
  { value: 1.1, label: '原比例1.1x' },
  { value: 1.2, label: '原比例1.2x' },
  { value: 1.5, label: '原比例1.5x' },
  { value: 2, label: '原比例2x' },
]

export default function SmartExpansion({ initialImageFromGallery, initialExtensionImage, extensionMeta }) {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [ratio, setRatio] = useState(1.5)
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 })
  const [model, setModel] = useState('Nano Banana')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')

  useEffect(() => {
    if (!image?.dataUrl) { setImageDims({ w: 0, h: 0 }); return }
    const img = new Image()
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setImageDims({ w: 0, h: 0 })
    img.src = image.dataUrl
  }, [image?.dataUrl])

  useEffect(() => {
    if (!initialImageFromGallery?.url || !getToken) return
    loadImageFromGalleryUrl(initialImageFromGallery.url, getToken, initialImageFromGallery.id)
      .then(({ file, dataUrl }) => {
        setImage({ file, dataUrl })
        setResult(null)
        setError('')
      })
      .catch(() => {})
  }, [initialImageFromGallery?.url])

  useEffect(() => {
    if (!initialExtensionImage?.dataUrl) return
    let cancelled = false
    dataUrlToImageSlot(initialExtensionImage.dataUrl, 'extension-input.jpg')
      .then(({ file, dataUrl }) => {
        if (cancelled) return
        setImage({ file, dataUrl })
        setResult(null)
        setError('')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [initialExtensionImage?.dataUrl])

  // 扩图后尺寸更大，积分按扩图后估算
  const estimatedPoints = getEstimatedPointsForDimensions(
    Math.round(imageDims.w * ratio),
    Math.round(imageDims.h * ratio)
  )

  const openGallery = async () => {
    setGalleryPicker({ open: true })
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

  const pickFromGallery = async (item) => {
    setGalleryPicker({ open: false })
    try {
      const { file, dataUrl } = await loadImageFromGalleryId(item.id, getToken)
      setImage({ file, dataUrl })
      setResult(null)
      setError('')
    } catch (_) {}
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = URL.createObjectURL(file)
    setImage({ file, dataUrl })
    setResult(null)
    setError('')
  }

  const compressImageForApi = async () => {
    if (!image?.dataUrl) return null
    const img = new Image()
    img.src = image.dataUrl
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    let w = img.naturalWidth, h = img.naturalHeight
    const maxSize = 1024
    if (w > maxSize || h > maxSize) {
      if (w >= h) { h = Math.round((h * maxSize) / w); w = maxSize }
      else { w = Math.round((w * maxSize) / h); h = maxSize }
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.82)
  }

  const handleGenerate = async () => {
    if (!image) {
      setError('请先上传图片')
      return
    }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const dataUrl = await compressImageForApi()
      if (!dataUrl) throw new Error('图片处理失败')
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'smart-expansion',
          expansionRatio: ratio,
          images: [dataUrl],
          model,
          aspectRatio,
          clarity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '扩图失败')
      setResult(data.image)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '扩图失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveResult = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, '智能扩图结果.png')
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="扩图中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">智能扩图，视界大开。</h1>
        <p className="mt-1.5 text-base text-gray-600">
          不再受限于快门的瞬间，PicToolAI 自动识别你的构图，智能补全缺失的肩膀、延伸的花海、广阔的星空。
        </p>
        <p className="mt-1 text-base text-gray-500">
          每一像素的扩展，都与原图浑然一体。
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">扩图前</p>
          <button
            type="button"
            onClick={() => setLightbox({ open: true, src: '/demo-smart-expansion-before.png' })}
            className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72 hover:border-gray-300 transition"
          >
            <img src="/demo-smart-expansion-before.png" alt="扩图前" className="w-full h-full object-cover" />
          </button>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">扩图后</p>
          <button
            type="button"
            onClick={() => setLightbox({ open: true, src: '/demo-smart-expansion-after.png' })}
            className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72 hover:border-gray-300 transition"
          >
            <img src="/demo-smart-expansion-after.png" alt="扩图后" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* 上传按钮 */}
      <div className="flex flex-wrap gap-2 justify-center">
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          上传图片
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
        {getToken() && (
          <button
            type="button"
            onClick={openGallery}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary text-primary text-sm font-medium hover:bg-primary/5 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            从作品库选择
          </button>
        )}
      </div>

      {/* 图片预览 + 比例选择 + 生成 */}
      {image && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto">
          <div className="flex justify-center mb-3">
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-w-full max-h-[220px]">
              <img
                src={image.dataUrl}
                alt=""
                className="max-h-[220px] w-auto object-contain"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {EXPANSION_RATIOS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRatio(r.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  ratio === r.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <OutputSettings
            model={model}
            aspectRatio={aspectRatio}
            clarity={clarity}
            onModelChange={setModel}
            onAspectRatioChange={setAspectRatio}
            onClarityChange={setClarity}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full max-w-xs mx-auto block py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition"
          >
            {generating ? '扩图中...' : '开始扩图'}
          </button>
        </div>
      )}

      {/* 图库选择弹窗 */}
      {galleryPicker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">从作品库选择</h3>
              <button type="button" onClick={() => setGalleryPicker({ open: false })} className="text-gray-500 hover:text-gray-700">
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
                    <GalleryThumb key={item.id} url={item.url} title={item.title} token={getToken()} onClick={() => pickFromGallery(item)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">扩图结果</h3>
          <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setLightbox({ open: true, src: result })}
              className="rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition max-h-[220px]"
            >
              <img src={result} alt="扩图结果" className="max-h-[220px] w-auto object-contain" />
            </button>
            <button
              type="button"
              onClick={handleSaveResult}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
            >
              保存到本地
            </button>
            <ExtensionReplaceButton imageDataUrl={result} extensionMeta={extensionMeta} />
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="扩图结果" onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
