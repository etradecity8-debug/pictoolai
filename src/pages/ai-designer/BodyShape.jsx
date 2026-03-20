import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
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
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      try { resolve(canvas.toDataURL('image/jpeg', quality)) }
      catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}

const WEIGHT_PRESETS = [
  { label: '纤瘦', kg: 45, desc: '~45kg' },
  { label: '偏瘦', kg: 55, desc: '~55kg' },
  { label: '标准', kg: 65, desc: '~65kg' },
  { label: '微胖', kg: 80, desc: '~80kg' },
  { label: '丰满', kg: 95, desc: '~95kg' },
  { label: '大码', kg: 115, desc: '~115kg' },
]

export default function BodyShape({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [targetWeight, setTargetWeight] = useState(65)
  const [targetHeight, setTargetHeight] = useState(170)
  const [extraPrompt, setExtraPrompt] = useState('')
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
    loadImageFromGalleryUrl(initialImageFromGallery.url, getToken)
      .then(({ file, dataUrl }) => {
        setImage({ file, dataUrl })
        setResult(null)
        setError('')
      })
      .catch(() => {})
  }, [initialImageFromGallery?.url])

  const estimatedPoints = getEstimatedPointsForDimensions(imageDims.w, imageDims.h)
  const bmi = (targetWeight / ((targetHeight / 100) ** 2)).toFixed(1)

  const getBmiLabel = () => {
    const v = parseFloat(bmi)
    if (v < 18.5) return { text: '偏瘦', color: 'text-blue-500' }
    if (v < 24) return { text: '正常', color: 'text-green-500' }
    if (v < 28) return { text: '偏胖', color: 'text-orange-500' }
    return { text: '肥胖', color: 'text-red-500' }
  }
  const bmiInfo = getBmiLabel()

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

  const handleGenerate = async () => {
    if (!image) { setError('请先上传模特图片'); return }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const compressed = await fileToCompressedDataUrl(image.file)
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'body-shape',
          prompt: extraPrompt.trim() || '',
          images: [compressed],
          targetWeight,
          targetHeight,
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
      await saveBlobWithPicker(blob, '调整身材效果.png')
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="身材调整中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">调整身材</h1>
        <p className="mt-1.5 text-base text-gray-600">
          上传模特穿搭图，调整模特体重，展示服装在不同身材上的效果
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">原图</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-44 h-56">
            <img src="/demo-bodyshape-before.png" alt="原图" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">调整效果</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-44 h-56">
            <img src="/demo-bodyshape-after.png" alt="调整效果" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* 上传按钮 */}
      <div className="flex flex-wrap gap-2 justify-center">
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          上传模特图片
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
        {getToken() && (
          <button type="button" onClick={openGallery}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary text-primary text-sm font-medium hover:bg-primary/5 transition">
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

      {/* 设置 & 预览 */}
      {image && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
              <img src={image.dataUrl} alt="原图" className="max-h-[220px] max-w-[200px] object-contain" />
            </div>
            <div className="flex-1 space-y-4">
              {/* 快速预设 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">快速选择</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEIGHT_PRESETS.map(p => (
                    <button key={p.kg} type="button" onClick={() => setTargetWeight(p.kg)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${targetWeight === p.kg ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                      {p.label} <span className="text-[10px] opacity-70">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 体重滑块 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">目标体重</label>
                  <span className="text-sm font-bold text-gray-900">{targetWeight} kg</span>
                </div>
                <input type="range" min="35" max="150" step="1" value={targetWeight}
                  onChange={e => setTargetWeight(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>35kg</span><span>150kg</span>
                </div>
              </div>

              {/* 身高 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">参考身高</label>
                  <span className="text-sm font-bold text-gray-900">{targetHeight} cm</span>
                </div>
                <input type="range" min="140" max="200" step="1" value={targetHeight}
                  onChange={e => setTargetHeight(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>140cm</span><span>200cm</span>
                </div>
              </div>

              {/* BMI 指示 */}
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-xs text-gray-500">BMI</span>
                <span className={`text-sm font-bold ${bmiInfo.color}`}>{bmi}</span>
                <span className={`text-xs font-medium ${bmiInfo.color}`}>{bmiInfo.text}</span>
              </div>

              {/* 补充说明 */}
              <input type="text" value={extraPrompt} onChange={e => setExtraPrompt(e.target.value)}
                placeholder="补充说明（可选），例如：保持苗条但更有肌肉感"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
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
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="w-full max-w-xs mx-auto block py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition">
            {generating ? '调整中...' : '开始调整身材'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {/* 结果对比 */}
      {result && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">调整效果</h3>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-400">原图</span>
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <img src={image?.dataUrl} alt="原图" className="max-h-[240px] w-auto object-contain" />
              </div>
            </div>
            <div className="flex items-center pt-20 text-gray-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-400">{targetWeight}kg 效果</span>
              <button type="button" onClick={() => setLightbox({ open: true, src: result })}
                className="rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition">
                <img src={result} alt="调整结果" className="max-h-[240px] w-auto object-contain" />
              </button>
            </div>
            <div className="flex items-center pt-20">
              <button type="button" onClick={handleSaveResult}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition">
                保存到本地
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="调整效果" onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
