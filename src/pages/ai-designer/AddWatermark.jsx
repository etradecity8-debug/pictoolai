import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { loadImageFromGalleryUrl } from '../../lib/loadGalleryImage'

// 常用水印位置（单处 / 平铺 / 对角线）
const POSITION_OPTIONS = [
  { id: 'top-right', label: '右上角' },
  { id: 'top-left', label: '左上角' },
  { id: 'bottom-right', label: '右下角' },
  { id: 'bottom-left', label: '左下角' },
  { id: 'bottom-center', label: '底部居中' },
  { id: 'center', label: '居中' },
  { id: 'diagonal-45', label: '对角线单条（45°）' },
  { id: 'tiled-45', label: '平铺（45° 斜向重复整图）' },
]

const OPACITY_PRESETS = [0.2, 0.35, 0.5, 0.65, 0.8]
const FONT_SIZE_OPTIONS = [
  { id: 'small', label: '小', ratio: 0.03 },
  { id: 'medium', label: '中', ratio: 0.05 },
  { id: 'large', label: '大', ratio: 0.08 },
]
const TEXT_COLOR_OPTIONS = [
  { id: 'white', value: '#FFFFFF', label: '白色' },
  { id: 'black', value: '#000000', label: '黑色' },
  { id: 'gray', value: '#666666', label: '灰色' },
]

function drawWatermark(canvas, img, options) {
  const { text, position, opacity, fontSizeRatio, textColor } = options
  if (!text.trim()) return
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const pad = Math.min(w, h) * 0.04
  const fontSize = Math.round(Math.min(w, h) * fontSizeRatio)
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.fillStyle = textColor
  ctx.globalAlpha = opacity
  ctx.textBaseline = 'middle'

  if (position === 'tiled-45' || position === 'diagonal-45') {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-Math.PI / 4)
    ctx.translate(-w / 2, -h / 2)
    const spacing = fontSize * 2.5
    if (position === 'diagonal-45') {
      const n = Math.ceil(Math.sqrt(w * w + h * h) / spacing)
      ctx.textAlign = 'center'
      for (let i = -n; i <= n; i++) {
        ctx.fillText(text.trim(), w / 2 + i * spacing, h / 2)
      }
    } else {
      ctx.textAlign = 'center'
      for (let dy = -h * 2; dy <= h * 2; dy += spacing) {
        for (let dx = -w * 2; dx <= w * 2; dx += spacing) {
          ctx.fillText(text.trim(), w / 2 + dx, h / 2 + dy)
        }
      }
    }
    ctx.restore()
    ctx.globalAlpha = 1
    return
  }

  switch (position) {
    case 'top-left':
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(text.trim(), pad, pad)
      break
    case 'top-right':
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(text.trim(), w - pad, pad)
      break
    case 'bottom-left':
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(text.trim(), pad, h - pad)
      break
    case 'bottom-right':
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(text.trim(), w - pad, h - pad)
      break
    case 'bottom-center':
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(text.trim(), w / 2, h - pad)
      break
    case 'center':
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text.trim(), w / 2, h / 2)
      break
    default:
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(text.trim(), w - pad, pad)
  }
  ctx.globalAlpha = 1
}

export default function AddWatermark({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [text, setText] = useState('')
  const [position, setPosition] = useState('top-right')
  const [opacity, setOpacity] = useState(0.35)
  const [fontSize, setFontSize] = useState('medium')
  const [textColor, setTextColor] = useState('white')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!initialImageFromGallery?.url || !getToken) return
    loadImageFromGalleryUrl(initialImageFromGallery.url, getToken)
      .then(({ file, dataUrl }) => {
        setImage({ file, dataUrl })
        setResult(null)
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

  const applyWatermark = async () => {
    setError('')
    if (!image?.dataUrl) {
      setError('请先上传图片')
      return
    }
    if (!text.trim()) {
      setError('请输入水印文字')
      return
    }
    const img = imgRef.current
    if (!img || !img.complete) {
      setError('图片尚未加载完成，请稍候再试')
      return
    }
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) {
      setError('无法获取图片尺寸')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const fontSizeRatio = FONT_SIZE_OPTIONS.find((o) => o.id === fontSize)?.ratio ?? 0.05
    const color = TEXT_COLOR_OPTIONS.find((o) => o.id === textColor)?.value ?? '#FFFFFF'
    drawWatermark(canvas, img, { text: text.trim(), position, opacity, fontSizeRatio, textColor: color })
    try {
      const resultDataUrl = canvas.toDataURL('image/png')
      setResult(resultDataUrl)
      const token = getToken()
      if (token) {
        try {
          const res = await fetch('/api/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ image: resultDataUrl, title: '添加水印' }),
          })
          if (res.ok && refreshUser) refreshUser()
        } catch (_) {}
      }
    } catch (e) {
      setError('生成失败，请重试')
    }
  }

  const handleSave = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, `watermark-${Date.now()}.png`)
    } catch (e) {
      if (e?.name !== 'AbortError') setError('保存失败')
    }
  }

  useEffect(() => {
    if (!image?.dataUrl) return
    const img = new Image()
    img.onload = () => {}
    img.onerror = () => {}
    img.src = image.dataUrl
  }, [image?.dataUrl])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-gray-900">添加水印</h1>
        <p className="mt-1.5 text-base text-gray-600">上传图片，设置水印文字、位置与透明度，一键生成带水印图（本地处理，不消耗积分）</p>

        {/* 示例：原图 → 添加水印后 */}
        <div className="mt-6 flex items-center gap-6 rounded-xl border border-gray-200 bg-gray-50/50 p-6">
          <div className="shrink-0 text-center">
            <img src="/demo-watermark-add-before.png" alt="原图" className="w-56 h-40 rounded-lg object-cover border border-gray-200" />
            <p className="mt-1.5 text-xs text-gray-500">原图</p>
          </div>
          <span className="text-gray-400 shrink-0">→</span>
          <div className="shrink-0 text-center">
            <img src="/demo-watermark-add-after.png" alt="添加水印后" className="w-56 h-40 rounded-lg object-cover border border-gray-200" />
            <p className="mt-1.5 text-xs text-gray-500">添加水印后</p>
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
              <label className="block text-sm font-semibold text-gray-900 mb-2">水印文字 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="例如：公司名称、© 版权"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">水印位置</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {POSITION_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">透明度</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {OPACITY_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOpacity(v)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${opacity === v ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {Math.round(v * 100)}%
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-gray-800"
              />
              <p className="mt-1 text-xs text-gray-500">当前：{Math.round(opacity * 100)}%</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">字体大小</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {FONT_SIZE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">文字颜色</label>
              <div className="flex gap-2">
                {TEXT_COLOR_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setTextColor(o.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${textColor === o.id ? 'border-gray-800 bg-gray-100 font-medium' : 'border-gray-200 hover:bg-gray-50'}`}
                    style={textColor === o.id ? {} : {}}
                    title={o.label}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={applyWatermark}
              disabled={!image?.dataUrl || !text.trim()}
              className="w-full rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              应用水印
            </button>
          </div>

          <div className="space-y-4">
            {image?.dataUrl && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">原图（用于生成）</p>
                <img
                  ref={imgRef}
                  src={image.dataUrl}
                  alt=""
                  className="max-h-64 w-auto rounded-xl border border-gray-200 object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            )}
            {result && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">添加水印后</p>
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
                  <GalleryThumb key={item.id} item={item} onClick={() => pickFromGallery(item)} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
