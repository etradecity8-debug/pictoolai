import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'
import { loadImageFromGalleryUrl } from '../../lib/loadGalleryImage'

// 色卡：常用颜色（hex + 名称），用户从中选 1-9 种，或使用自定义取色
const COLOR_PALETTE = [
  { hex: '#EF4444', name: '红色' },
  { hex: '#F97316', name: '橙色' },
  { hex: '#EAB308', name: '黄色' },
  { hex: '#84CC16', name: '黄绿' },
  { hex: '#22C55E', name: '绿色' },
  { hex: '#14B8A6', name: '青绿' },
  { hex: '#0EA5E9', name: '天蓝' },
  { hex: '#3B82F6', name: '蓝色' },
  { hex: '#8B5CF6', name: '紫色' },
  { hex: '#D946EF', name: '玫红' },
  { hex: '#EC4899', name: '粉色' },
  { hex: '#F43F5E', name: '玫瑰' },
  { hex: '#78716C', name: '褐色' },
  { hex: '#525252', name: '深灰' },
  { hex: '#171717', name: '黑色' },
  { hex: '#FAFAFA', name: '白色' },
  { hex: '#FEF3C7', name: '米白' },
  { hex: '#DBEAFE', name: '浅蓝' },
  { hex: '#FCE7F3', name: '浅粉' },
  { hex: '#A78BFA', name: '淡紫' },
  { hex: '#FBBF24', name: '金黄' },
  { hex: '#06B6D4', name: '青色' },
  { hex: '#F59E0B', name: '琥珀' },
]

function isValidHex(s) {
  return /^#?[0-9A-Fa-f]{6}$/.test(s)
}

export default function OneClickRecolor({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [textDesc, setTextDesc] = useState('') // 如：鼠标、裙子、头发
  const [selectedColors, setSelectedColors] = useState([]) // [{ hex, name }]
  const [customHex, setCustomHex] = useState('#FF6B6B')
  const [results, setResults] = useState([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
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
    loadImageFromGalleryUrl(initialImageFromGallery.url, getToken)
      .then(({ file, dataUrl }) => {
        setImage({ file, dataUrl })
        setResults([])
        setError('')
      })
      .catch(() => {})
  }, [initialImageFromGallery?.url])

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
      const isAbsolute = typeof item.url === 'string' && item.url.startsWith('http')
      const headers = (token && !isAbsolute) ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(item.url, { headers })
      const blob = await res.blob()
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
      setImage({ file, dataUrl })
      setResults([])
      setError('')
    } catch (_) {}
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = URL.createObjectURL(file)
    setImage({ file, dataUrl })
    setResults([])
    setError('')
  }

  const toggleColor = (c) => {
    setSelectedColors((prev) => {
      const has = prev.some((x) => x.hex === c.hex)
      if (has) return prev.filter((x) => x.hex !== c.hex)
      if (prev.length >= 9) return prev
      return [...prev, c]
    })
  }

  const addCustomColor = () => {
    const hex = customHex.startsWith('#') ? customHex : `#${customHex}`
    if (!isValidHex(hex)) {
      setError('请输入有效的 hex 颜色，如 #FF6B6B')
      return
    }
    setError('')
    setSelectedColors((prev) => {
      if (prev.some((x) => x.hex.toLowerCase() === hex.toLowerCase())) return prev
      if (prev.length >= 9) return prev
      return [...prev, { hex, name: `自定义 ${hex}` }]
    })
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
    const desc = textDesc.trim()
    if (!desc) {
      setError('请描述要换色的物体，例如：鼠标、裙子、头发、沙发')
      return
    }
    if (selectedColors.length === 0) {
      setError('请至少选择 1 种颜色（色卡或自定义 hex）')
      return
    }
    setError('')
    setGenerating(true)
    setResults([])
    setProgress({ current: 0, total: selectedColors.length })
    try {
      const dataUrl = await compressImageForApi()
      if (!dataUrl) throw new Error('图片处理失败')
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`

      const out = []
      for (let i = 0; i < selectedColors.length; i++) {
        setProgress({ current: i + 1, total: selectedColors.length })
        const col = selectedColors[i]
        const res = await fetch('/api/image-edit', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mode: 'recolor',
            textDescription: desc,
            targetColor: col.hex,
            colorName: col.name,
            images: [dataUrl],
            model,
            aspectRatio,
            clarity,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `第 ${i + 1} 张换色失败`)
        out.push({ color: col, image: data.image })
      }
      setResults(out)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '换色失败，请稍后重试')
    } finally {
      setGenerating(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const handleSaveResult = async (item) => {
    if (!item?.image) return
    try {
      const res = await fetch(item.image)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, `一键换色-${item.color.name}.png`)
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="换色中..." progress={progress.total ? `${progress.current}/${progress.total}` : null} />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">一键换色</h1>
        <p className="mt-1.5 text-base text-gray-600">
          无论是时装还是产品，一键精准换色，效率提升 10 倍
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">原图</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72">
            <img src="/recolor-demo-original.png" alt="原图" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">换色后</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72">
            <img src="/recolor-demo-edited.png" alt="换色后" className="w-full h-full object-cover" />
          </div>
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

      {/* 图片预览 + 文字描述 + 颜色选择 */}
      {image && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center">
            <img
              src={image.dataUrl}
              alt=""
              className="max-h-[220px] max-w-full rounded-lg object-contain bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">要换色的物体</label>
            <input
              type="text"
              value={textDesc}
              onChange={(e) => setTextDesc(e.target.value)}
              placeholder="例如：鼠标、裙子、头发、沙发、杯子"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              选择目标颜色（已选 {selectedColors.length}/9）
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COLOR_PALETTE.map((c) => {
                const isSelected = selectedColors.some((x) => x.hex.toLowerCase() === c.hex.toLowerCase())
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => toggleColor(c)}
                    disabled={!isSelected && selectedColors.length >= 9}
                    className={`w-9 h-9 rounded-lg border-2 transition shrink-0 ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                )
              })}
            </div>

            {/* 自定义取色 */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0"
              />
              <input
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#FF6B6B"
                className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono"
              />
              <button
                type="button"
                onClick={addCustomColor}
                disabled={selectedColors.length >= 9}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                添加自定义颜色
              </button>
            </div>
          </div>

          <OutputSettings
            model={model}
            aspectRatio={aspectRatio}
            clarity={clarity}
            onModelChange={setModel}
            onAspectRatioChange={setAspectRatio}
            onClarityChange={setClarity}
          />
          {selectedColors.length > 0 && (
            <p className="text-xs text-gray-500 text-center">共 {selectedColors.length} 张，每张按上方输出设置扣费</p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full max-w-xs mx-auto block py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition"
          >
            {generating
              ? `生成中 ${progress.current}/${progress.total}...`
              : `开始换色（${selectedColors.length} 种颜色）`}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">换色结果</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded border border-gray-200 shrink-0"
                    style={{ backgroundColor: item.color.hex }}
                  />
                  <span className="text-xs text-gray-600">{item.color.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLightbox({ open: true, src: item.image })}
                  className="rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition w-full"
                >
                  <img src={item.image} alt={item.color.name} className="w-full aspect-square object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveResult(item)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  保存
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="换色结果" onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
