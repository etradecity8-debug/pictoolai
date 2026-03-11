import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'

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

const MODEL_OPTIONS = [
  {
    id: 'Nano Banana Pro',
    label: 'Nano Banana Pro',
    benefit: '质感巅峰：微观纹理最稳，金属 / 木纹 / 织物等材质细节最真实，避免塑料感。适合追求极致质感的单品精修。',
  },
  {
    id: 'Nano Banana 2',
    label: 'Nano Banana 2',
    benefit: '速度与均衡：整体光影控制优秀、出图更快，适合批量处理或对速度有要求的场景。',
  },
]

// 材质预设标签（20 项，分三 tab：工业 / 自然 / 轻奢；点击发送英文 prompt）
const MATERIAL_TABS = [
  {
    id: 'industrial',
    label: '工业',
    items: [
      { label: '精密拉丝钢', prompt: 'Brushed Precision Steel', hint: '细腻金属线条，高端机械感' },
      { label: '阳极氧化铝', prompt: 'Anodized Matte Aluminum', hint: '哑光高级质感，类似苹果外壳' },
      { label: '生锈铸铁', prompt: 'Weathered Rusty Cast Iron', hint: '颗粒感强，红褐色锈迹' },
      { label: '锻造碳纤维', prompt: 'Forged Carbon Fiber', hint: '黑色不规则纹理，现代科技' },
    ],
  },
  {
    id: 'nature',
    label: '自然',
    items: [
      { label: '苔藓岩石', prompt: 'Moss-covered Ancient Rock', hint: '湿润绿色苔藓与粗糙石材对比' },
      { label: '抛光黑曜石', prompt: 'Polished Black Obsidian', hint: '纯黑深邃，极高反射率' },
      { label: '蜂窝几何', prompt: 'Hexagonal Bionic Structure', hint: '蜂巢状自然几何美感' },
      { label: '冰裂纹陶瓷', prompt: 'Cracked Celadon Glaze', hint: '细腻釉面，交错冰裂缝隙' },
      { label: '液态水银', prompt: 'Liquid Shimmering Mercury', hint: '流动金属液体，超现实反光' },
      { label: '极光欧泊', prompt: 'Iridescent Aurora Opal', hint: '内部斑斓火彩' },
      { label: '发光光纤', prompt: 'Glowing Fiber Optic Bundle', hint: '细碎导光点，科幻氛围' },
      { label: '蜂窝透明塑料', prompt: 'Translucent Honeycomb Resin', hint: '半透明树脂，内部结构若隐若现' },
    ],
  },
  {
    id: 'luxury',
    label: '轻奢',
    items: [
      { label: '抛光大理石', prompt: 'Polished Italian Marble', hint: '镜面反射，天然温润石纹' },
      { label: '24K 喷砂金', prompt: 'Sandblasted 24K Gold', hint: '柔和金黄色泽，细腻颗粒感' },
      { label: '乌木雕刻', prompt: 'Carved Dark Ebony Wood', hint: '深色木纹，油润光泽' },
      { label: '磨砂彩色玻', prompt: 'Frosted Dichroic Glass', hint: '半透明，随角度变化的幻彩折射' },
      { label: '顶级全粒面皮', prompt: 'Full-grain Nappa Leather', hint: '细小毛孔纹理，柔软皮革折痕' },
      { label: '重磅真丝', prompt: 'Heavy Mulberry Silk', hint: '极度顺滑高光，优雅垂坠感' },
      { label: '粗粝亚麻', prompt: 'Rough Organic Linen', hint: '明显纤维交织，自然淳朴' },
      { label: '亮面漆皮', prompt: 'High-gloss Patent Leather', hint: '强烈镜面反光，时尚先锋感' },
    ],
  },
  {
    id: 'plastic',
    label: '塑料',
    items: [
      { label: '磨砂哑光类', prompt: 'Matte Satin-finish Plastic', hint: '高级感、科技感，耳机/充电宝首选' },
      { label: '半透明树脂类', prompt: 'Translucent Frosted Resin', hint: '美妆瓶、透明灯具，深邃感' },
      { label: '高光钢琴漆类', prompt: 'High-gloss Polished Acrylic', hint: '汽车内饰、亮面家电，镜面感' },
    ],
  },
]

export default function ProductRefinement() {
  const { getToken, refreshUser } = useAuth()
  const [model, setModel] = useState('Nano Banana Pro')
  const [materialPrompt, setMaterialPrompt] = useState('')
  const [materialTab, setMaterialTab] = useState('industrial')
  const [image, setImage] = useState(null)
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false })
  const [guideModalOpen, setGuideModalOpen] = useState(false)
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
    setMaterialPrompt('')
  }

  const appendMaterialTag = (item) => {
    setMaterialPrompt((prev) => (prev ? `${prev}, ${item.prompt}` : item.prompt))
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
          mode: 'product-refinement',
          images: [dataUrl],
          model,
          materialPrompt: materialPrompt.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '提升质感失败')
      setResult(data.image)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '提升质感失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveResult = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, '提升质感结果.png')
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-6 min-h-[320px]">
      <GeneratingOverlay open={generating} message="提升中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">提升质感</h1>
        <p className="mt-2 text-gray-600">
          一键提升商品质感，改善商品的轮廓、光泽、材质与颜色等
        </p>
        <p className="mt-1 text-sm text-gray-500">
          内置 20+ 物理级材质引擎，一键让你的产品图从「地摊货」变身「奢侈品」。
        </p>
      </div>

      {/* 示例对比（与局部重绘等模块一致：固定尺寸、紧凑布局） */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">原图</p>
          <button
            type="button"
            onClick={() => setLightbox({ open: true, src: '/demo-product-refinement-before.png' })}
            className="rounded-xl overflow-hidden border border-gray-200 shadow-sm w-48 h-48 hover:border-gray-300 transition"
          >
            <img src="/demo-product-refinement-before.png" alt="原图" className="w-full h-full object-cover" />
          </button>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">Pro vs 2 效果对比</p>
          <button
            type="button"
            onClick={() => setLightbox({ open: true, src: '/demo-product-refinement-pro-vs-2.png' })}
            className="rounded-xl overflow-hidden border border-gray-200 shadow-sm w-48 h-48 hover:border-gray-300 transition"
          >
            <img src="/demo-product-refinement-pro-vs-2.png" alt="Pro vs 2 效果对比" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* 上传按钮 */}
      <div className="flex flex-wrap gap-3 justify-center">
        <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium cursor-pointer hover:bg-primary/90 transition">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-primary text-primary font-medium hover:bg-primary/5 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            从作品库选择
          </button>
        )}
      </div>

      {/* 精修前/精修后对比 */}
      {image && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col items-center">
              <p className="text-sm font-medium text-gray-500 mb-2">精修前</p>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-[320px] flex items-center justify-center">
                <img src={image.dataUrl} alt="精修前" className="max-h-[320px] w-auto object-contain" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-sm font-medium text-gray-500 mb-2">精修后</p>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-[320px] flex items-center justify-center">
                {result ? (
                  <button type="button" onClick={() => setLightbox({ open: true, src: result })} className="block">
                    <img src={result} alt="精修后" className="max-h-[320px] w-auto object-contain" />
                  </button>
                ) : (
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    {generating ? '生成中...' : '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {image && (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">材质 / 质感描述（可选）</p>
                <p className="text-xs text-gray-500 mb-2">指定材质可避免 AI 猜错，让效果更精准。点选预设或自行填写英文关键词。</p>
                <div className="flex gap-1 mb-2 border-b border-gray-200">
                  {MATERIAL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMaterialTab(tab.id)}
                      className={`px-3 py-2 text-xs font-medium -mb-px border-b-2 transition ${
                        materialTab === tab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {MATERIAL_TABS.find((t) => t.id === materialTab)?.items.map((item) => (
                    <button
                      key={item.prompt}
                      type="button"
                      onClick={() => appendMaterialTag(item)}
                      title={item.hint}
                      className="px-2.5 py-1 rounded-lg text-xs border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={materialPrompt}
                  onChange={(e) => setMaterialPrompt(e.target.value)}
                  placeholder="如：Brushed Precision Steel、Full-grain Nappa Leather… 留空则使用通用增强"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">选择模型</p>
                  <button
                    type="button"
                    onClick={() => setGuideModalOpen(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    如何选择？
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModel(opt.id)}
                      className={`rounded-xl border-2 p-3 text-left transition ${
                        model === opt.id
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{opt.label}</p>
                      <p className="mt-1 text-xs text-gray-500 leading-snug">{opt.benefit}</p>
                    </button>
                  ))}
                </div>
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
                {generating ? '提升中...' : '开始提升质感'}
              </button>
            </>
          )}
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
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSaveResult}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            保存到本地
          </button>
        </div>
      )}

      <ImageLightbox open={lightbox.open} src={lightbox.src} alt="精修后" onClose={() => setLightbox({ open: false, src: null })} />

      {/* 模型选择指南弹窗 */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-gray-900">模型选择指南 · 质感增强篇</h3>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 text-sm">
              <section className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">专家建议：黄金法则</h4>
                <p className="text-gray-600 mb-3">不确定如何选择时，可按以下三类场景对应：</p>
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                    <p className="font-medium text-gray-800">精密零件、珠宝、高级家具</p>
                    <p className="text-gray-600 mt-0.5">→ 建议选择 <span className="font-medium text-primary">Nano Banana Pro</span></p>
                    <p className="text-gray-500 text-xs mt-1">能捕捉微小的加工痕迹和复杂的环境反射，让物体看起来「很贵」</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                    <p className="font-medium text-gray-800">美食、风景、时尚人像</p>
                    <p className="text-gray-600 mt-0.5">→ 建议选择 <span className="font-medium text-primary">Nano Banana 2</span></p>
                    <p className="text-gray-500 text-xs mt-1">色彩处理更讨喜，光影通透，能让画面看起来非常清新、高级</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                    <p className="font-medium text-gray-800">只想让模糊的图变清晰</p>
                    <p className="text-gray-600 mt-0.5">→ 先尝试 <span className="font-medium text-primary">Nano Banana 2</span></p>
                    <p className="text-gray-500 text-xs mt-1">边缘锐化处理非常干练，且不需要等待太久</p>
                  </div>
                </div>
              </section>
              <section className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">详细对比：Pro vs 2</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 pr-3 font-medium text-gray-700">维度</th>
                        <th className="py-2 pr-3 font-medium text-gray-700">Nano Banana 2（速度优先）</th>
                        <th className="py-2 font-medium text-gray-700">Nano Banana Pro（极致细节）</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600">
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-700">核心优势</td>
                        <td className="py-2 pr-3">快如闪电、极高效率，保持约 95% 质感下生图快 3～5 倍</td>
                        <td className="py-2">深层推理、材质大师，能理解金属折射、织物纤维等复杂物理属性</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-700">质感表现</td>
                        <td className="py-2 pr-3">现代感强，光影明亮生动，色彩饱和度高</td>
                        <td className="py-2">极度真实，纹理细节（划痕、锈迹、颗粒）深邃且富有层次</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-700">推荐场景</td>
                        <td className="py-2 pr-3">批量处理、社交媒体、初步预览；追求一眼惊艳</td>
                        <td className="py-2">商业摄影、工业设计、微距、4K 需求；追求经得起放大的真实感</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-700">生成时间</td>
                        <td className="py-2 pr-3">约 4～6 秒（1K）</td>
                        <td className="py-2">约 10～20 秒</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
