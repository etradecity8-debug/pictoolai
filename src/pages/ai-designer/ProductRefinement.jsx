import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'
import { loadImageFromGalleryUrl } from '../../lib/loadGalleryImage'

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

// 材质预设标签，Tab 顺序：电子 / 塑料 / 纺织 / 木质 / 玻璃 / 工业 / 自然 / 轻奢
const MATERIAL_TABS = [
  {
    id: 'electronics',
    label: '电子',
    items: [
      { label: 'CNC 刀痕', prompt: 'CNC machining marks', hint: '金属外壳极细螺旋加工痕迹' },
      { label: '喷砂氧化', prompt: 'Sandblasted matte oxidation', hint: '类似 MacBook 均匀磨砂质感' },
      { label: '拉丝金属', prompt: 'Linear brushed metal', hint: '强烈方向性反光，不锈钢质感' },
      { label: 'LED 漫反射', prompt: 'Diffused LED glow', hint: '指示灯光在塑料壳内散开的温和感' },
      { label: '精密接缝', prompt: 'Tight tolerance gaps', hint: '零件间极紧密、近乎无缝装配感' },
    ],
  },
  {
    id: 'plastic',
    label: '塑料',
    items: [
      { label: '磨砂哑光类', prompt: 'Matte Satin-finish Plastic', hint: '高级感、科技感，耳机/充电宝首选' },
      { label: '半透明树脂类', prompt: 'Translucent Frosted Resin', hint: '美妆瓶、透明灯具，深邃感' },
      { label: '高光钢琴漆类', prompt: 'High-gloss Polished Acrylic', hint: '汽车内饰、亮面家电，镜面感' },
      { label: '类皮质涂层', prompt: 'Soft-touch coating', hint: '模拟高端耳机/鼠标的亲肤、略粗糙触感' },
      { label: '缎面哑光', prompt: 'Satin matte finish', hint: '介于高光与全磨砂之间，优雅柔光感' },
      { label: '微观皮纹', prompt: 'Micro-stipple texture', hint: '工业塑料表面细微凹凸颗粒，防滑防指纹' },
      { label: '透明亚克力', prompt: 'Clear polished acrylic', hint: '极高透明度与边缘折射质感' },
      { label: '蜂窝透明塑料', prompt: 'Translucent Honeycomb Resin', hint: '半透明树脂，内部结构若隐若现' },
    ],
  },
  {
    id: 'textile',
    label: '纺织',
    items: [
      { label: '细致经纬线', prompt: 'Detailed warp and weft', hint: '放大可见横竖交织线头' },
      { label: '表面浮绒', prompt: 'Surface micro-fibers', hint: '边缘极细小、逆光短绒毛' },
      { label: '粗捻线感', prompt: 'Coarse slub texture', hint: '亚麻/粗布的不规则粗细线条' },
      { label: '粗粝亚麻', prompt: 'Rough Organic Linen', hint: '明显纤维交织，自然淳朴' },
      { label: '丝绸虹彩', prompt: 'Silk iridescence', hint: '随角度变化的金属般丝绸光泽' },
      { label: '重磅悬垂', prompt: 'Heavy drape folds', hint: '高克重布料深邃厚重褶皱' },
      { label: '华夫格纹', prompt: 'Waffle weave pattern', hint: '立体方格凹凸针织质感' },
      { label: '吸光天鹅绒', prompt: 'Light-absorbing velvet', hint: '极黑极深，几乎不反射直射光' },
      { label: '重磅真丝', prompt: 'Heavy Mulberry Silk', hint: '极度顺滑高光，优雅垂坠感' },
    ],
  },
  {
    id: 'wood',
    label: '木质',
    items: [
      { label: '开放漆纹理', prompt: 'Open-pore grain', hint: '能看到木材导管深度的原始质感' },
      { label: '浮雕木纹', prompt: 'Raised grain texture', hint: '木材纹理明显凹凸起伏' },
      { label: '丝绒漆面', prompt: 'Velvet lacquer finish', hint: '薄而温润的半哑光保护层' },
      { label: '碳化处理', prompt: 'Charred Yakisugi finish', hint: '表面轻微烧灼后的黑亮鳞片质感' },
      { label: '抛光蜡感', prompt: 'Wax-polished sheen', hint: '老家具打磨后透出的深层油脂光泽' },
      { label: '琥珀色光泽', prompt: 'Amber depth', hint: '光线穿透漆面照到纤维的立体感' },
    ],
  },
  {
    id: 'glass',
    label: '玻璃',
    items: [
      { label: '高折射率', prompt: 'High IOR reflections', hint: '更厚重、类水晶质感' },
      { label: '色散彩虹边缘', prompt: 'Chromatic aberration caustics', hint: '光线穿透形成的彩色焦散点' },
      { label: '磨砂酸洗', prompt: 'Acid-etched frosting', hint: '极细均匀雾面质感' },
      { label: '钢化波纹', prompt: 'Tempered glass ripples', hint: '侧光下可见独特应力纹' },
      { label: '真空镀膜', prompt: 'Vacuum-deposited coating', hint: '镜片表面的紫红或蓝色反光' },
      { label: '磨砂彩色玻', prompt: 'Frosted Dichroic Glass', hint: '半透明，随角度变化的幻彩折射' },
    ],
  },
  {
    id: 'industrial',
    label: '工业',
    items: [
      { label: '精密拉丝钢', prompt: 'Brushed Precision Steel', hint: '细腻金属线条，高端机械感' },
      { label: '阳极氧化铝', prompt: 'Anodized Matte Aluminum', hint: '哑光高级质感，类似苹果外壳' },
      { label: '生锈铸铁', prompt: 'Weathered Rusty Cast Iron', hint: '颗粒感强，红褐色锈迹' },
      { label: '锻造碳纤维', prompt: 'Forged Carbon Fiber', hint: '黑色不规则纹理，现代科技' },
      { label: '液态水银', prompt: 'Liquid Shimmering Mercury', hint: '流动金属液体，超现实反光' },
      { label: '发光光纤', prompt: 'Glowing Fiber Optic Bundle', hint: '细碎导光点，科幻氛围' },
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
      { label: '极光欧泊', prompt: 'Iridescent Aurora Opal', hint: '内部斑斓火彩' },
    ],
  },
  {
    id: 'luxury',
    label: '轻奢',
    items: [
      { label: '抛光大理石', prompt: 'Polished Italian Marble', hint: '镜面反射，天然温润石纹' },
      { label: '24K 喷砂金', prompt: 'Sandblasted 24K Gold', hint: '柔和金黄色泽，细腻颗粒感' },
      { label: '乌木雕刻', prompt: 'Carved Dark Ebony Wood', hint: '深色木纹，油润光泽' },
      { label: '顶级全粒面皮', prompt: 'Full-grain Nappa Leather', hint: '细小毛孔纹理，柔软皮革折痕' },
      { label: '亮面漆皮', prompt: 'High-gloss Patent Leather', hint: '强烈镜面反光，时尚先锋感' },
    ],
  },
]

export default function ProductRefinement({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [model, setModel] = useState('Nano Banana')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')
  const [materialPrompt, setMaterialPrompt] = useState('')
  const [materialTab, setMaterialTab] = useState('electronics')
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
          aspectRatio,
          clarity,
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
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="提升中..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">提升质感</h1>
        <p className="mt-1.5 text-base text-gray-600">
          内置专业材质引擎，一键让你的产品图从「地摊货」变身「奢侈品」。
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">原图</p>
          <button
            type="button"
            onClick={() => setLightbox({ open: true, src: '/demo-product-refinement-before.png' })}
            className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72 hover:border-gray-300 transition"
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
            className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-72 h-72 hover:border-gray-300 transition"
          >
            <img src="/demo-product-refinement-pro-vs-2.png" alt="Pro vs 2 效果对比" className="w-full h-full object-cover" />
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

      {/* 精修前/精修后对比 */}
      {image && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 max-w-3xl mx-auto">
          <div className="flex items-start justify-center gap-2 sm:gap-3 mb-4">
            <div className="flex flex-col items-center shrink-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">精修前</p>
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-h-[220px] flex items-center justify-center">
                <img src={image.dataUrl} alt="精修前" className="max-h-[220px] w-auto object-contain" />
              </div>
            </div>
            <div className="flex items-center pt-6 text-primary shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">精修后</p>
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-h-[220px] flex items-center justify-center min-w-[120px]">
                {result ? (
                  <button type="button" onClick={() => setLightbox({ open: true, src: result })} className="block">
                    <img src={result} alt="精修后" className="max-h-[220px] w-auto object-contain" />
                  </button>
                ) : (
                  <div className="w-24 h-24 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                    {generating ? '生成中...' : '—'}
                  </div>
                )}
              </div>
              {result && (
                <button
                  type="button"
                  onClick={handleSaveResult}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
                >
                  保存到本地
                </button>
              )}
            </div>
          </div>

          {image && (
            <>
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">材质 / 质感描述（可选）</p>
                <p className="text-xs text-gray-500 mb-1.5">点选预设或填写英文关键词，悬停可看说明。</p>
                <div className="flex gap-1 mb-1.5 border-b border-gray-200 overflow-x-auto">
                  {MATERIAL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMaterialTab(tab.id)}
                      className={`shrink-0 px-3 py-2 text-xs font-medium -mb-px border-b-2 transition ${
                        materialTab === tab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {MATERIAL_TABS.find((t) => t.id === materialTab)?.items.map((item) => (
                    <div key={item.prompt} className="relative group">
                      <button
                        type="button"
                        onClick={() => appendMaterialTag(item)}
                        title={item.hint}
                        className="px-2.5 py-1 rounded-lg text-xs border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition"
                      >
                        {item.label}
                      </button>
                      {item.hint && (
                        <div className="absolute left-0 bottom-full mb-1 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 max-w-[220px] shadow-lg pointer-events-none">
                          {item.hint}
                          <span className="absolute left-3 top-full border-4 border-transparent border-t-gray-800" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={materialPrompt}
                  onChange={(e) => setMaterialPrompt(e.target.value)}
                  placeholder="如：Brushed Precision Steel、Full-grain Nappa Leather… 留空则通用增强"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setGuideModalOpen(true)}
                  className="text-xs text-primary hover:underline"
                >
                  如何选择模型？
                </button>
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
