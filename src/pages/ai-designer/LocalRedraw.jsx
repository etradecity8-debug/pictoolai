import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'

const MASK_COLOR = 'rgba(139, 92, 246, 0.6)' // 紫色半透明，与设计稿一致

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
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      try { resolve(canvas.toDataURL('image/jpeg', quality)) }
      catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}

export default function LocalRedraw() {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null) // { file, dataUrl }
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [model, setModel] = useState('Nano Banana 2')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')
  const canvasRef = useRef(null)
  const maskCanvasRef = useRef(null)
  const containerRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [lastPos, setLastPos] = useState(null)
  const [brushSize, setBrushSize] = useState(24)
  const imgRef = useRef(null)
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!image?.dataUrl) { setImageDims({ w: 0, h: 0 }); return }
    const img = new Image()
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setImageDims({ w: 0, h: 0 })
    img.src = image.dataUrl
  }, [image?.dataUrl])

  const estimatedPoints = getEstimatedPointsForDimensions(imageDims.w, imageDims.h)

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
      clearMask()
    } catch (_) {}
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = URL.createObjectURL(file)
    setImage({ file, dataUrl })
    setResult(null)
    setError('')
    clearMask()
  }

  const clearMask = () => {
    const mask = maskCanvasRef.current
    if (mask) {
      const ctx = mask.getContext('2d')
      ctx.clearRect(0, 0, mask.width, mask.height)
    }
  }

  // 初始化 mask canvas 尺寸（与显示图一致）
  useEffect(() => {
    if (!image || !containerRef.current || !imgRef.current) return
    const img = imgRef.current
    const onLoad = () => {
      const mask = maskCanvasRef.current
      if (!mask || !img) return
      const rect = img.getBoundingClientRect()
      if (mask.width !== rect.width || mask.height !== rect.height) {
        mask.width = rect.width
        mask.height = rect.height
        const ctx = mask.getContext('2d')
        ctx.clearRect(0, 0, mask.width, mask.height)
      }
    }
    img.onload = onLoad
    if (img.complete) onLoad()
    return () => { img.onload = null }
  }, [image])

  const getCanvasCoords = (e) => {
    if (!containerRef.current || !imgRef.current) return null
    const img = imgRef.current
    const rect = img.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null
    return { x, y }
  }

  const drawOnMask = (x, y) => {
    const mask = maskCanvasRef.current
    if (!mask) return
    const ctx = mask.getContext('2d')
    ctx.fillStyle = MASK_COLOR
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const handlePointerDown = (e) => {
    const pos = getCanvasCoords(e)
    if (!pos) return
    setDrawing(true)
    setLastPos(pos)
    drawOnMask(pos.x, pos.y)
  }

  const handlePointerMove = (e) => {
    if (!drawing || !lastPos) return
    const pos = getCanvasCoords(e)
    if (!pos) return
    const mask = maskCanvasRef.current
    if (!mask) return
    const ctx = mask.getContext('2d')
    ctx.strokeStyle = MASK_COLOR
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.x, lastPos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setLastPos(pos)
  }

  const handlePointerUp = () => setDrawing(false)

  useEffect(() => {
    if (drawing) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }
    }
  }, [drawing, lastPos])

  const hasMask = () => {
    const mask = maskCanvasRef.current
    if (!mask) return false
    const ctx = mask.getContext('2d')
    const data = ctx.getImageData(0, 0, mask.width, mask.height)
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] > 0) return true
    }
    return false
  }

  const buildCompositeImage = async () => {
    if (!image || !imgRef.current || !maskCanvasRef.current) return null
    const img = imgRef.current
    const mask = maskCanvasRef.current
    const srcImg = new Image()
    srcImg.src = image.dataUrl
    await new Promise((resolve, reject) => {
      srcImg.onload = resolve
      srcImg.onerror = reject
    })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(srcImg, 0, 0)
    const scaleX = img.naturalWidth / mask.width
    const scaleY = img.naturalHeight / mask.height
    ctx.save()
    ctx.scale(scaleX, scaleY)
    ctx.drawImage(mask, 0, 0)
    ctx.restore()
    return c.toDataURL('image/jpeg', 0.9)
  }

  const handleGenerate = async () => {
    if (!image) {
      setError('请先上传图片')
      return
    }
    if (!prompt.trim()) {
      setError('请输入想要改变的内容')
      return
    }
    if (!hasMask()) {
      setError('请在图片上涂抹需要改变的区域')
      return
    }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const compositeDataUrl = await buildCompositeImage()
      if (!compositeDataUrl) throw new Error('生成遮罩图失败')
      const editPrompt = `This image has a purple/violet semi-transparent overlay indicating the region to modify. Replace ONLY that purple/marked region with: ${prompt.trim()}. Keep everything else in the image exactly the same. Do not change any area outside the marked region.`
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'inpainting',
          prompt: editPrompt,
          images: [compositeDataUrl],
          model,
          aspectRatio,
          clarity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '生成失败')
      setResult(data.image)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveResult = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, '局部重绘结果.png')
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="生成中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">局部重绘</h1>
        <p className="mt-1.5 text-base text-gray-600">
          上传图片，涂抹需要改变的区域并输入想要改变的内容，即可重新对该区域进行绘制
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">原图</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72">
            <img src="/local-redraw-demo-original.png" alt="原图" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">重绘图</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72">
            <img src="/local-redraw-demo-edited.png" alt="重绘图" className="w-full h-full object-cover" />
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

      {/* 涂抹区域 + 输入 */}
      {image && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">涂抹需要改变的区域</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">画笔大小</span>
              <input
                type="range"
                min="8"
                max="48"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <button type="button" onClick={clearMask} className="text-xs text-gray-500 hover:text-gray-700 underline">
                清除
              </button>
            </div>
          </div>
          <div ref={containerRef} className="relative inline-block max-w-full max-h-[280px] overflow-hidden rounded-lg bg-gray-100">
            <img
              ref={imgRef}
              src={image.dataUrl}
              alt=""
              className="max-h-[280px] block select-none cursor-crosshair"
              style={{ maxWidth: '100%', userSelect: 'none', pointerEvents: 'none' }}
              draggable={false}
            />
            <canvas
              ref={maskCanvasRef}
              className="absolute top-0 left-0 cursor-crosshair"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={handlePointerDown}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">想要改变的内容</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：将桌上的物品替换为一杯清水"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
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
            {generating ? '生成中...' : '开始重绘'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">重绘结果</h3>
          <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
            <button type="button" onClick={() => setLightbox({ open: true, src: result })} className="rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition max-h-[220px]">
              <img src={result} alt="结果" className="max-h-[220px] w-auto object-contain" />
            </button>
            <button
              type="button"
              onClick={handleSaveResult}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
            >
              保存到本地
            </button>
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="重绘结果" onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
