import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'

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

const STYLE_PRESETS = [
  { key: 'warm', label: '温馨舒适', desc: 'warm, cozy, inviting home atmosphere with soft natural lighting' },
  { key: 'modern', label: '现代简约', desc: 'modern minimalist style with clean lines, neutral tones, and sleek design' },
  { key: 'luxury', label: '轻奢高端', desc: 'luxurious premium feel with elegant materials, gold accents, and sophisticated ambiance' },
  { key: 'nordic', label: '北欧风格', desc: 'Scandinavian style with light wood, white walls, plants, and airy bright space' },
  { key: 'industrial', label: '工业风', desc: 'industrial loft style with exposed brick, metal elements, and raw textures' },
  { key: 'natural', label: '自然户外', desc: 'natural outdoor setting with greenery, sunlight, and organic environment' },
  { key: 'studio', label: '专业棚拍', desc: 'professional studio photography with controlled lighting and clean backdrop' },
  { key: 'lifestyle', label: '生活方式', desc: 'lifestyle photography showing the product in real daily use, candid and authentic' },
]

const SCENE_EXAMPLES = [
  '一个女人坐在客厅的沙发上看书，旁边有落地灯和书架',
  '产品放在厨房大理石台面上，背景是整洁的现代厨房',
  '一个男人在办公桌前使用产品，背景是明亮的办公室',
  '产品放在户外花园的木桌上，周围有绿植和阳光',
  '一个家庭在餐厅使用产品，温馨的用餐场景',
  '产品放在卧室床头柜上，柔和的灯光和舒适的床品',
]

export default function SceneGeneration() {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [productName, setProductName] = useState('')
  const [sceneDescription, setSceneDescription] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('warm')
  const [customStyle, setCustomStyle] = useState('')
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 })
  const [model, setModel] = useState('Nano Banana 2')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')

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
    if (!image) { setError('请先上传产品图片'); return }
    if (!productName.trim()) { setError('请输入产品名称'); return }
    if (!sceneDescription.trim()) { setError('请描述想要生成的场景'); return }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const compressed = await fileToCompressedDataUrl(image.file)
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const styleObj = STYLE_PRESETS.find(s => s.key === selectedStyle)
      const styleText = selectedStyle === 'custom' ? customStyle.trim() : (styleObj?.desc || '')
      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'scene-generation',
          prompt: '',
          images: [compressed],
          productName: productName.trim(),
          sceneDescription: sceneDescription.trim(),
          styleDescription: styleText,
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
      await saveBlobWithPicker(blob, `场景生成_${productName || '产品'}.png`)
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="场景生成中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">生成场景</h1>
        <p className="mt-1.5 text-base text-gray-600">
          一张产品图，千种生活场景 —— 让买家看见拥有它的样子
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">产品原图</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-56 h-56">
            <img src="/demo-scene-gen-before.png" alt="原图" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">场景效果</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-56 h-56">
            <img src="/demo-scene-gen-after.png" alt="场景效果" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* 上传按钮 */}
      <div className="flex flex-wrap gap-2 justify-center">
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          上传产品图片
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
        <button type="button" onClick={openGallery}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
          从仓库选择
        </button>
      </div>

      {/* 预览已上传图片 */}
      {image && (
        <div className="flex justify-center">
          <div className="relative">
            <img src={image.dataUrl} alt="已上传" className="max-h-60 rounded-xl border border-gray-200 shadow-sm cursor-pointer"
              onClick={() => setLightbox({ open: true, src: image.dataUrl })} />
            <button type="button" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
              onClick={() => { setImage(null); setResult(null) }}>×</button>
          </div>
        </div>
      )}

      {/* 参数表单 */}
      {image && (
        <div className="max-w-xl mx-auto space-y-4 bg-white rounded-2xl border border-gray-200 p-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">产品名称 <span className="text-red-500">*</span></label>
            <input type="text" value={productName} onChange={e => setProductName(e.target.value)}
              placeholder="例：现代简约沙发、不锈钢保温杯、无线蓝牙耳机"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">场景描述 <span className="text-red-500">*</span></label>
            <textarea value={sceneDescription} onChange={e => setSceneDescription(e.target.value)}
              placeholder="描述你想要的场景，例如：一个女人坐在客厅的沙发上看书，旁边有落地灯和书架"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SCENE_EXAMPLES.map((ex, i) => (
                <button key={i} type="button" onClick={() => setSceneDescription(ex)}
                  className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600 hover:bg-primary/10 hover:text-primary transition truncate max-w-[200px]">
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">画面风格</label>
            <div className="grid grid-cols-4 gap-2">
              {STYLE_PRESETS.map(s => (
                <button key={s.key} type="button" onClick={() => setSelectedStyle(s.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${selectedStyle === s.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50'}`}>
                  {s.label}
                </button>
              ))}
              <button type="button" onClick={() => setSelectedStyle('custom')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${selectedStyle === 'custom' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50'}`}>
                自定义
              </button>
            </div>
            {selectedStyle === 'custom' && (
              <input type="text" value={customStyle} onChange={e => setCustomStyle(e.target.value)}
                placeholder="输入自定义风格描述，例如：日式侘寂风、地中海风格"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            )}
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
            className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition">
            {generating ? '生成中...' : '生成场景'}
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}

      {/* 结果展示 */}
      {result && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <h3 className="text-lg font-bold text-gray-900">生成结果</h3>
          <img src={result} alt="场景效果" className="max-h-96 rounded-xl border border-gray-200 shadow-md cursor-pointer"
            onClick={() => setLightbox({ open: true, src: result })} />
          <button type="button" onClick={handleSaveResult}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            保存到本地
          </button>
        </div>
      )}

      {/* 仓库选图弹窗 */}
      {galleryPicker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setGalleryPicker({ open: false })}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[680px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">从仓库选择图片</h3>
              <button type="button" className="text-gray-400 hover:text-gray-700 text-xl" onClick={() => setGalleryPicker({ open: false })}>×</button>
            </div>
            {galleryLoading ? (
              <div className="text-center py-12 text-gray-400">加载中…</div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">仓库暂无图片</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {galleryItems.map(item => (
                  <GalleryThumb key={item.id} url={item.url} title={item.title} token={getToken()} onClick={() => pickFromGallery(item)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} onClose={() => setLightbox({ open: false, src: null })} />
    </div>
  )
}
