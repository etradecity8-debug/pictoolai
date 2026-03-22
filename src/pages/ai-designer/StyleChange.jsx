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

// 常用风格预设（照片→指定风格），英文 prompt 供 Gemini 使用
const STYLE_PRESETS = [
  { id: 'anime', label: '二次元', prompt: 'Convert this image to Japanese anime / 2D illustration style. Clean lines, cel-shading, expressive eyes, vibrant colors, anime aesthetic. Keep the same composition and subject.' },
  { id: 'manga', label: '日漫', prompt: 'Transform this image into Japanese manga style. Black and white or limited color, screen tones, dynamic linework, manga panel aesthetic. Preserve the subject and pose.' },
  { id: 'ghibli', label: '宫崎骏', prompt: 'Transform into Studio Ghibli style. Hand-painted feel, soft watercolor layers, gentle colors, air perspective, nature-rich backgrounds, whimsical and warm. Keep the same subject and composition.' },
  { id: 'shinkai', label: '新海诚', prompt: 'Transform into Makoto Shinkai anime style. Highly detailed backgrounds, vivid saturated sky and clouds, lens flares, photorealistic lighting, emotional atmosphere. Same subject, cinematic look.' },
  { id: 'watercolor', label: '水彩', prompt: 'Convert to watercolor painting style. Soft edges, color bleeding, paper texture, gentle washes, artistic watercolor look. Preserve subject and composition.' },
  { id: 'cyberpunk', label: '赛博朋克', prompt: 'Transform into cyberpunk style. Neon lights, rain-soaked atmosphere, holographic elements, high contrast, dark mood, futuristic dystopian vibe. Same subject.' },
  { id: 'disney', label: '迪士尼卡通', prompt: 'Convert to Disney cartoon style. Rounded shapes, expressive characters, clean animation look, family-friendly and vibrant. Keep composition and subject.' },
  { id: 'american-cartoon', label: '美式卡通', prompt: 'Transform into American cartoon style. Bold outlines, exaggerated expressions, vibrant colors, cartoon network aesthetic. Same subject.' },
  { id: 'comic', label: '漫画', prompt: 'Convert to comic book style. Bold lines, halftone dots, dynamic shading, graphic novel look. Preserve subject and pose.' },
  { id: 'pixel', label: '像素风', prompt: 'Transform into pixel art style. 8-bit or 16-bit retro game aesthetic, visible pixels, limited color palette. Same subject and composition.' },
  { id: 'oil-painting', label: '油画', prompt: 'Convert to oil painting style. Visible brushstrokes, rich texture, classical painting feel, museum quality. Keep subject and composition.' },
  { id: 'pencil-sketch', label: '素描', prompt: 'Transform into pencil sketch style. Grayscale, hand-drawn pencil lines, shading and hatching, artistic sketch look. Same subject.' },
]

export default function StyleChange({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [selectedStyle, setSelectedStyle] = useState('anime')
  const [optionalPrompt, setOptionalPrompt] = useState('')
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

  const estimatedPoints = getEstimatedPointsForDimensions(imageDims.w, imageDims.h)
  const preset = STYLE_PRESETS.find((p) => p.id === selectedStyle)

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

  const handleGenerate = async () => {
    setError('')
    if (!image?.dataUrl) {
      setError('请先上传图片')
      return
    }
    setGenerating(true)
    setResult(null)
    try {
      const base64 = await fileToCompressedDataUrl(image.file)
      const fullPrompt = optionalPrompt.trim()
        ? `${preset.prompt} ADDITIONAL: ${optionalPrompt.trim()}`
        : preset.prompt
      const token = getToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'style-transfer',
          prompt: fullPrompt,
          images: [base64],
          model,
          aspectRatio,
          clarity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '风格改变失败')
      setResult(data.image)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '风格改变失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, `风格改变-${preset?.label || selectedStyle}-${Date.now()}.png`)
    } catch (e) {
      if (e?.name !== 'AbortError') setError('保存失败')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-gray-900">风格改变</h1>
        <p className="mt-1.5 text-base text-gray-600">上传一张照片，选择目标风格（如二次元、日漫、水彩等），一键生成该风格下的新图</p>

        {/* 示例：原图 → 风格改变后 */}
        <div className="mt-6 flex items-center gap-6 rounded-xl border border-gray-200 bg-gray-50/50 p-6">
          <div className="shrink-0 text-center">
            <img src="/demo-style-change-before.png" alt="原图" className="w-56 h-40 rounded-lg object-cover border border-gray-200" />
            <p className="mt-1.5 text-xs text-gray-500">原图</p>
          </div>
          <span className="text-gray-400 shrink-0">→</span>
          <div className="shrink-0 text-center">
            <img src="/demo-style-change-after.png" alt="风格改变后" className="w-56 h-40 rounded-lg object-cover border border-gray-200" />
            <p className="mt-1.5 text-xs text-gray-500">风格改变后</p>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">上传图片</label>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  上传图片
                </label>
                <button
                  type="button"
                  onClick={openGallery}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  从作品库选择
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">目标风格</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {STYLE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">补充说明（可选）</label>
              <input
                type="text"
                value={optionalPrompt}
                onChange={(e) => setOptionalPrompt(e.target.value)}
                placeholder="例如：保留人物表情，背景更梦幻"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <OutputSettings
              model={model}
              onModelChange={setModel}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              clarity={clarity}
              onClarityChange={setClarity}
              estimatedPoints={estimatedPoints}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!image?.dataUrl || generating}
              className="w-full rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? '生成中…' : '生成'}
            </button>
          </div>

          <div className="space-y-4">
            {image?.dataUrl && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">原图</p>
                <img src={image.dataUrl} alt="" className="max-h-64 w-auto rounded-xl border border-gray-200 object-contain" />
              </div>
            )}
            {result && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">风格改变后</p>
                <button type="button" onClick={() => setLightbox({ open: true, src: result })} className="block">
                  <img src={result} alt="" className="max-h-80 w-auto rounded-xl border border-gray-200 object-contain hover:opacity-95" />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  保存到本地
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <GeneratingOverlay open={generating} message="风格改变中..." />
      {lightbox.open && lightbox.src && (
        <ImageLightbox src={lightbox.src} onClose={() => setLightbox({ open: false, src: null })} />
      )}

      {galleryPicker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setGalleryPicker({ open: false })}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">从作品库选择</h3>
              <button type="button" onClick={() => setGalleryPicker({ open: false })} className="text-gray-500 hover:text-gray-700">关闭</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] grid grid-cols-3 sm:grid-cols-4 gap-3">
              {galleryLoading ? (
                <p className="col-span-full text-center text-gray-500 py-8">加载中…</p>
              ) : (
                galleryItems.map((item) => (
                  <GalleryThumb key={item.id} url={item.url} title={item.title} token={getToken()} onClick={() => pickFromGallery(item)} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
