import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'

const EXPANSION_RATIOS = [
  { value: 1.1, label: '原比例1.1x' },
  { value: 1.2, label: '原比例1.2x' },
  { value: 1.5, label: '原比例1.5x' },
  { value: 2, label: '原比例2x' },
]

function GalleryThumb({ url, title, token, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null)
  useEffect(() => {
    if (!url) return
    let revoked = false
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(url, { headers })
      .then((r) => r.ok ? r.blob() : Promise.reject())
      .then((blob) => { if (!revoked) setBlobUrl(URL.createObjectURL(blob)) })
      .catch(() => {})
    return () => { revoked = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
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

export default function SmartExpansion() {
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

  useEffect(() => {
    if (!image?.dataUrl) { setImageDims({ w: 0, h: 0 }); return }
    const img = new Image()
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setImageDims({ w: 0, h: 0 })
    img.src = image.dataUrl
  }, [image?.dataUrl])

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
      const token = getToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(item.url, { headers })
      const blob = await res.blob()
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
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
    <div className="relative space-y-6 min-h-[320px]">
      <GeneratingOverlay open={generating} message="扩图中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">智能扩图</h1>
        <p className="mt-2 text-gray-600 font-medium">智能扩图，视界大开。</p>
        <p className="mt-1 text-sm text-gray-500">
          不再受限于快门的瞬间。PicToolAI 自动识别你的构图，智能补全缺失的肩膀、延伸的花海、广阔的星空。每一像素的扩展，都与原图浑然一体。
        </p>
      </div>

      {/* 上传按钮 */}
      <div className="flex flex-wrap gap-3 justify-center">
        <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium cursor-pointer hover:bg-primary/90 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          从本地上传
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
        {getToken() && (
          <button
            type="button"
            onClick={openGallery}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-primary text-primary font-medium hover:bg-primary/5 transition"
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
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex justify-center mb-4">
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-w-full max-h-[360px]">
              <img
                src={image.dataUrl}
                alt=""
                className="max-h-[360px] w-auto object-contain"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {EXPANSION_RATIOS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRatio(r.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  ratio === r.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 mb-4">
            <span className="text-xs text-gray-500">本次预计消耗</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-gray-800">
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3 3.25a.75.75 0 001.1 0l3-3.25a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
              </svg>
              {estimatedPoints} 积分
            </span>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-60 transition"
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
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">扩图结果</h3>
          <div className="flex gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => setLightbox({ open: true, src: result })}
              className="rounded-xl overflow-hidden border border-gray-200 hover:border-gray-400 transition"
            >
              <img src={result} alt="扩图结果" className="max-h-64 object-cover" />
            </button>
            <button
              type="button"
              onClick={handleSaveResult}
              className="self-start px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              保存到本地
            </button>
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="扩图结果" onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
