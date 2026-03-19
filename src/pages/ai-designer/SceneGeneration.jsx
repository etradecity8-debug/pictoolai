import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
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

const MAX_SCENES = 6

export default function SceneGeneration({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [image, setImage] = useState(null)
  const [productName, setProductName] = useState('')
  // 多场景：数组，每项为一个场景描述字符串
  const [scenes, setScenes] = useState([''])
  const [selectedStyle, setSelectedStyle] = useState('warm')
  const [customStyle, setCustomStyle] = useState('')
  // results: Array<{ scene, url, error } | null>（null 表示尚未生成）
  const [results, setResults] = useState([])
  const [generating, setGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
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

  const estimatedPoints = getEstimatedPointsForDimensions(imageDims.w, imageDims.h)
  const validScenes = scenes.filter(s => s.trim())
  const totalScenes = validScenes.length

  const addScene = () => {
    if (scenes.length >= MAX_SCENES) return
    setScenes(prev => [...prev, ''])
  }

  const removeScene = (idx) => {
    if (scenes.length <= 1) return
    setScenes(prev => prev.filter((_, i) => i !== idx))
  }

  const updateScene = (idx, val) => {
    setScenes(prev => prev.map((s, i) => i === idx ? val : s))
  }

  const applyExample = (ex) => {
    // 找第一个空的场景填入，否则填入最后一个
    const firstEmpty = scenes.findIndex(s => !s.trim())
    if (firstEmpty >= 0) {
      updateScene(firstEmpty, ex)
    } else if (scenes.length < MAX_SCENES) {
      setScenes(prev => [...prev, ex])
    } else {
      updateScene(scenes.length - 1, ex)
    }
  }

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

  const handleGenerate = async () => {
    if (!image) { setError('请先上传产品图片'); return }
    if (!productName.trim()) { setError('请输入产品名称'); return }
    if (validScenes.length === 0) { setError('请至少填写一个场景描述'); return }
    setError('')
    setGenerating(true)
    setResults([])
    setGenerateProgress({ current: 0, total: validScenes.length })

    const styleObj = STYLE_PRESETS.find(s => s.key === selectedStyle)
    const styleText = selectedStyle === 'custom' ? customStyle.trim() : (styleObj?.desc || '')

    let compressed
    try {
      compressed = await fileToCompressedDataUrl(image.file)
    } catch (e) {
      setError('图片压缩失败，请重试')
      setGenerating(false)
      return
    }

    const accumulated = []
    for (let i = 0; i < validScenes.length; i++) {
      setGenerateProgress({ current: i + 1, total: validScenes.length })
      const sceneDesc = validScenes[i]
      try {
        const headers = { 'Content-Type': 'application/json' }
        const token = getToken()
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch('/api/image-edit', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mode: 'scene-generation',
            prompt: '',
            images: [compressed],
            productName: productName.trim(),
            sceneDescription: sceneDesc,
            styleDescription: styleText,
            model,
            aspectRatio,
            clarity,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || '生成失败')
        accumulated.push({ scene: sceneDesc, url: data.image, error: null })
      } catch (e) {
        accumulated.push({ scene: sceneDesc, url: null, error: e.message || '生成失败' })
      }
      setResults([...accumulated])
    }

    if (refreshUser) refreshUser()
    setGenerating(false)
  }

  const handleSaveOne = async (url, idx) => {
    if (!url) return
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, `场景生成_${productName || '产品'}_${idx + 1}.png`)
    } catch (_) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      {/* 生成中遮罩（手写，不用 GeneratingOverlay 以便显示进度） */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl min-w-[280px]">
            <svg className="h-12 w-12 animate-spin text-gray-700" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-gray-800">
              正在生成第 {generateProgress.current} / {generateProgress.total} 张场景图...
            </p>
            <p className="text-xs text-gray-500">请勿关闭或刷新页面，每张约 20 秒～1 分钟</p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-700 rounded-full transition-all duration-500"
                style={{ width: `${generateProgress.total > 0 ? (generateProgress.current / generateProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

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
              onClick={() => { setImage(null); setResults([]) }}>×</button>
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

          {/* 多场景描述 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                场景描述 <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">（最多 {MAX_SCENES} 个场景，每个场景生成一张图）</span>
              </label>
              {scenes.length < MAX_SCENES && (
                <button type="button" onClick={addScene}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-primary hover:text-primary transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加场景
                </button>
              )}
            </div>

            <div className="space-y-2">
              {scenes.map((scene, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-shrink-0 w-6 h-6 mt-2 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                    {idx + 1}
                  </div>
                  <textarea
                    value={scene}
                    onChange={e => updateScene(idx, e.target.value)}
                    placeholder={`场景 ${idx + 1}：例如 ${SCENE_EXAMPLES[idx % SCENE_EXAMPLES.length]}`}
                    rows={2}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                  {scenes.length > 1 && (
                    <button type="button" onClick={() => removeScene(idx)}
                      className="flex-shrink-0 mt-1.5 w-6 h-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 示例快捷填入 */}
            <div className="mt-2">
              <p className="text-xs text-gray-400 mb-1.5">快捷示例（点击填入）：</p>
              <div className="flex flex-wrap gap-1.5">
                {SCENE_EXAMPLES.map((ex, i) => (
                  <button key={i} type="button" onClick={() => applyExample(ex)}
                    className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600 hover:bg-primary/10 hover:text-primary transition truncate max-w-[200px]">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">画面风格（所有场景共用）</label>
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

          {/* 积分预估 */}
          {totalScenes > 0 && (
            <p className="text-xs text-amber-700">
              预计消耗 {estimatedPoints * totalScenes} 积分（{totalScenes} 张 × {estimatedPoints} 积分/张）
            </p>
          )}

          <button type="button" onClick={handleGenerate} disabled={generating || totalScenes === 0}
            className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition">
            {generating
              ? `生成中（${generateProgress.current}/${generateProgress.total}）...`
              : totalScenes > 0
                ? `生成 ${totalScenes} 张场景图`
                : '请填写场景描述'}
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}

      {/* 结果展示 */}
      {results.length > 0 && (
        <div className="max-w-3xl mx-auto pt-2">
          <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">
            生成结果（{results.filter(r => r.url).length}/{results.length} 张）
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {results.map((r, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {r.url ? (
                  <img
                    src={r.url}
                    alt={`场景 ${idx + 1}`}
                    className="w-full object-cover cursor-pointer"
                    onClick={() => setLightbox({ open: true, src: r.url })}
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center bg-gray-50">
                    <p className="text-sm text-red-400 px-4 text-center">{r.error || '生成失败'}</p>
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <p className="text-xs text-gray-500 line-clamp-2">场景 {idx + 1}：{r.scene}</p>
                  {r.url && (
                    <button type="button" onClick={() => handleSaveOne(r.url, idx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      保存到本地
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* 正在生成中的占位卡片 */}
            {generating && generateProgress.current <= generateProgress.total && results.length < generateProgress.total && (
              Array.from({ length: generateProgress.total - results.length }).map((_, i) => (
                <div key={`pending-${i}`} className="rounded-xl border border-dashed border-gray-200 bg-gray-50 h-48 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-8 h-8 animate-spin text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-xs text-gray-400">待生成</p>
                  </div>
                </div>
              ))
            )}
          </div>
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
