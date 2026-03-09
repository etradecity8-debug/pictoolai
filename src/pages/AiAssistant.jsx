import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useAuth } from '../context/AuthContext'
import { buildAmazonListingCsv, downloadAmazonListingCsv } from '../lib/exportAmazonListingCsv'
import { getPointsPerImage } from '../lib/pointsConfig'

// ── 平台列表 ──────────────────────────────────────────────────────────────────
const platforms = [
  { id: 'amazon',      name: '亚马逊',     nameEn: 'Amazon',      available: true  },
  { id: 'ebay',        name: 'eBay',        nameEn: 'eBay',        available: false },
  { id: 'aliexpress',  name: '速卖通',     nameEn: 'AliExpress',  available: false },
  { id: 'shopify',     name: 'Shopify',     nameEn: 'Shopify',     available: false },
  { id: 'tiktok',      name: 'TikTok Shop', nameEn: 'TikTok Shop', available: false },
  { id: 'walmart',     name: '沃尔玛',     nameEn: 'Walmart',     available: false },
  { id: 'etsy',        name: 'Etsy',        nameEn: 'Etsy',        available: false },
  { id: 'temu',        name: 'TEMU',        nameEn: 'TEMU',        available: false },
  { id: 'independent', name: '独立站',     nameEn: 'Independent', available: false },
]

// ── 亚马逊功能列表 ─────────────────────────────────────────────────────────────
const amazonFeatures = [
  {
    id: 'generate',
    title: '生成 Listing',
    desc: '输入产品信息，AI 一键生成符合亚马逊规则的高质量标题、五点描述与详情，支持多市场多语言。',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: 'optimize',
    title: '优化 Listing',
    desc: '粘贴现有 Listing，AI 分析标题权重、关键词密度与转化逻辑，提供可直接使用的优化版本。',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
]

// ── 目标市场 ───────────────────────────────────────────────────────────────────
const markets = [
  { value: 'us', label: '美国（Amazon.com）' },
  { value: 'uk', label: '英国（Amazon.co.uk）' },
  { value: 'de', label: '德国（Amazon.de）' },
  { value: 'fr', label: '法国（Amazon.fr）' },
  { value: 'jp', label: '日本（Amazon.co.jp）' },
  { value: 'ca', label: '加拿大（Amazon.ca）' },
  { value: 'mx', label: '墨西哥（Amazon.com.mx）' },
  { value: 'au', label: '澳大利亚（Amazon.com.au）' },
]

// ── 产品类别（二级联动，与 AMAZON-LISTING-SPEC 一致）────────────────────────────
const CATEGORY_TREE = [
  { id: 'home', name: '家居厨房', children: ['厨具', '收纳整理', '家纺', '灯具', '清洁用品', '浴室用品'] },
  { id: 'sports', name: '运动户外', children: ['户外装备', '健身器材', '自行车', '游泳用品', '球类运动'] },
  { id: 'electronics', name: '电子数码', children: ['手机配件', '电脑配件', '音频设备', '摄影器材', '智能家居'] },
  { id: 'beauty', name: '美容个护', children: ['护肤', '彩妆', '发型护理', '香水', '健康护理'] },
  { id: 'pet', name: '宠物用品', children: ['犬用', '猫用', '小动物', '水族'] },
  { id: 'baby', name: '婴儿用品', children: ['喂养', '婴儿衣物', '婴儿玩具', '婴儿安全'] },
  { id: 'apparel', name: '服装鞋包', children: ['男装', '女装', '鞋类', '箱包配件'] },
  { id: 'toys', name: '玩具游戏', children: ['益智玩具', '遥控玩具', '户外玩具', '桌游'] },
  { id: 'auto', name: '汽车用品', children: ['内饰配件', '外饰改装', '工具', '电子设备'] },
  { id: 'tools', name: '工具五金', children: ['电动工具', '手工具', '建材五金'] },
  { id: 'garden', name: '园艺', children: ['园林工具', '种植用品', '户外家具'] },
  { id: 'health', name: '健康医疗', children: ['维生素/保健品', '医疗器具', '急救用品'] },
  { id: 'office', name: '办公文具', children: ['文具耗材', '打印耗材', '办公家具'] },
  { id: 'other', name: '其他', children: ['其他'] },
]

function fileToCompressedDataUrl(file, maxSize = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width
      let h = img.height
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round((h * maxSize) / w)
          w = maxSize
        } else {
          w = Math.round((w * maxSize) / h)
          h = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

// ── 生图模型（与 DetailSet / gemini-models 一致）────────────────────────────────────
const IMAGE_MODEL_OPTIONS = ['Nano Banana', 'Nano Banana 2', 'Nano Banana Pro']

// ── 亚马逊生成 Listing 步骤（与产品组图一致的圆形数字 + 横线连接）────────────────────
const AMAZON_LISTING_STEPS = [
  { id: 1, label: '分析' },
  { id: 2, label: '标题·关键词·五点·描述' },
  { id: 3, label: '产品图' },
  { id: 4, label: 'A+' },
]

// ── 初始表单 ───────────────────────────────────────────────────────────────────
const initOptimize = { title: '', bullets: '', description: '', market: 'us', lang: 'zh' }

// ── 生成 Listing 表单（必填：图片≥1、二级类目、品牌、卖点≥2、市场、语言）────────
function GenerateForm() {
  const { user, getToken } = useAuth()
  const [images, setImages] = useState([])
  const [form, setForm] = useState({
    category1: '',
    category2: '',
    brand: '',
    sellingPoint1: '',
    sellingPoint2: '',
    sellingPoint3: '',
    sellingPoint4: '',
    sellingPoint5: '',
    market: 'us',
    lang: 'en',
    keywords: '',
    notes: '',
  })
  const [step, setStep] = useState('idle')
  const [error, setError] = useState('')
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [listingResult, setListingResult] = useState(null)
  const [productImageDataUrl, setProductImageDataUrl] = useState('') // 步骤 1 压缩图，供 Step 3/4 用
  const [productImagesResult, setProductImagesResult] = useState(null) // Step 3 主图
  const [productImagesLoading, setProductImagesLoading] = useState(false)
  const [aplusCopy, setAplusCopy] = useState(null)
  const [aplusCopyLoading, setAplusCopyLoading] = useState(false)
  const [aplusImages, setAplusImages] = useState(null)
  const [aplusImagesLoading, setAplusImagesLoading] = useState(false)
  const [saveListingLoading, setSaveListingLoading] = useState(false)
  const [savedListingId, setSavedListingId] = useState(null)
  const [imageModel, setImageModel] = useState('Nano Banana') // Step 3/4 生图模型，默认 Nano Banana(2.5) 兼容性更好

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const category1 = CATEGORY_TREE.find(c => c.id === form.category1)
  const secondOptions = category1?.children || []
  const sellingPointsLines = [form.sellingPoint1, form.sellingPoint2, form.sellingPoint3, form.sellingPoint4, form.sellingPoint5]
    .map(s => (s || '').trim()).filter(Boolean)
  const canSubmit =
    images.length >= 1 &&
    form.category1 &&
    form.category2 &&
    form.brand.trim() &&
    sellingPointsLines.length >= 2 &&
    form.market &&
    form.lang

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    const newOnes = files.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setImages(prev => [...prev, ...newOnes].slice(0, 5))
  }
  const removeImage = (i) => setImages(prev => prev.filter((_, j) => j !== i))

  const handleSubmit = async () => {
    if (!user || !getToken()) {
      setError('请先登录后再使用')
      return
    }
    setError('')
    setStep('analyzing')
    try {
      const dataUrl = await fileToCompressedDataUrl(images[0].file)
      setProductImageDataUrl(dataUrl)
      const token = getToken()
      const analyzeRes = await fetch('/api/ai-assistant/amazon/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          images: [dataUrl],
          category1: category1?.name,
          category2: form.category2,
          brand: form.brand.trim(),
          sellingPoints: sellingPointsLines,
          market: form.market,
          lang: form.lang,
          keywords: form.keywords.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const analyzeData = await analyzeRes.json()
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || '分析失败')
      }
      setAnalyzeResult(analyzeData)
      setStep('generating')
      const genRes = await fetch('/api/ai-assistant/amazon/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          analyzeResult: analyzeData,
          category1: category1?.name,
          category2: form.category2,
          brand: form.brand.trim(),
          sellingPoints: sellingPointsLines,
          market: form.market,
          lang: form.lang,
          keywords: form.keywords.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error || '生成失败')
      setListingResult(genData)
      setStep('done')
    } catch (e) {
      setError(e.message || '请求失败')
      setStep('error')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {}).catch(() => {})
  }

  const handleGenerateProductImages = async () => {
    if (!productImageDataUrl || !analyzeResult?.productName || !getToken()) return
    setError('')
    setProductImagesLoading(true)
    try {
      const res = await fetch('/api/ai-assistant/amazon/generate-product-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          productImage: productImageDataUrl,
          productName: analyzeResult.productName,
          brand: form.brand.trim(),
          model: imageModel,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setProductImagesResult({ mainImage: data.mainImage, pointsUsed: data.pointsUsed })
    } catch (e) {
      setError(e.message || '产品图生成失败')
    } finally {
      setProductImagesLoading(false)
    }
  }

  const handleGenerateAplusCopy = async () => {
    const extra = (listingResult?.bullets || []).map(b => (b || '').trim()).filter(Boolean)
    let features = sellingPointsLines.length >= 3 ? sellingPointsLines.slice(0, 3) : [...sellingPointsLines, ...extra, ...sellingPointsLines].filter((s, i, a) => a.indexOf(s) === i).slice(0, 3)
    while (features.length < 3) features.push(features[0] || '')
    features = features.slice(0, 3)
    if (!features[0]) {
      setError('A+ 需要至少 1 条卖点')
      return
    }
    setError('')
    setAplusCopyLoading(true)
    try {
      const res = await fetch('/api/amazon-aplus/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: form.brand.trim(),
          product: analyzeResult?.productName || '',
          features,
          story: form.notes.trim() || listingResult?.description?.slice(0, 200) || '',
          style: 'minimal',
          language: form.lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'A+ 文案生成失败')
      setAplusCopy(data.copy)
    } catch (e) {
      setError(e.message || 'A+ 文案生成失败')
    } finally {
      setAplusCopyLoading(false)
    }
  }

  const handleGenerateAplusImages = async () => {
    if (!aplusCopy || !productImageDataUrl) return
    const extra = (listingResult?.bullets || []).map(b => (b || '').trim()).filter(Boolean)
    let features = sellingPointsLines.length >= 3 ? sellingPointsLines.slice(0, 3) : [...sellingPointsLines, ...extra, ...sellingPointsLines].filter((s, i, a) => a.indexOf(s) === i).slice(0, 3)
    while (features.length < 3) features.push(features[0] || '')
    features = features.slice(0, 3)
    setError('')
    setAplusImagesLoading(true)
    try {
      const res = await fetch('/api/amazon-aplus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          brand: form.brand.trim(),
          product: analyzeResult?.productName || '',
          features,
          copy: aplusCopy,
          productImage: productImageDataUrl,
          style: 'minimal',
          model: imageModel,
          language: form.lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'A+ 图片生成失败')
      setAplusImages({ heroImage: data.heroImage, featureImages: data.featureImages || [] })
    } catch (e) {
      setError(e.message || 'A+ 图片生成失败')
    } finally {
      setAplusImagesLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {(step !== 'idle' || listingResult) && (
        <div className="flex items-center gap-2 mb-4">
          {AMAZON_LISTING_STEPS.map((s, i) => {
            const done = (s.id === 1 && step !== 'idle' && step !== 'analyzing') || (s.id === 2 && (step === 'done' || !!listingResult)) || (s.id === 3 && !!productImagesResult) || (s.id === 4 && !!aplusImages)
            const active = (s.id === 1 && step === 'analyzing') || (s.id === 2 && step === 'generating') || (s.id === 3 && productImagesLoading) || (s.id === 4 && (aplusCopyLoading || aplusImagesLoading))
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-medium ${
                    active ? 'bg-gray-800 text-white' : done ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s.id}
                </span>
                <span className={`text-sm ${active ? 'font-medium text-gray-900' : done ? 'text-gray-700' : 'text-gray-500'}`}>
                  {s.label}
                </span>
                {i < AMAZON_LISTING_STEPS.length - 1 && (
                  <span className="mx-1 h-px w-4 bg-gray-300" aria-hidden />
                )}
              </div>
            )
          })}
        </div>
      )}

      {listingResult ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">生成结果（可复制）</h3>
            <button
              type="button"
              onClick={() => {
                setListingResult(null)
                setStep('idle')
                setAnalyzeResult(null)
                setProductImageDataUrl('')
                setProductImagesResult(null)
                setAplusCopy(null)
                setAplusImages(null)
                setSavedListingId(null)
              }}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              重新生成
            </button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              disabled={saveListingLoading}
              onClick={async () => {
                if (!getToken()) return
                setSaveListingLoading(true)
                try {
                  const res = await fetch('/api/ai-assistant/amazon/save-listing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                    body: JSON.stringify({
                      name: analyzeResult?.productName ? `${analyzeResult.productName} Listing` : '',
                      title: listingResult.title,
                      searchTerms: listingResult.searchTerms,
                      bullets: listingResult.bullets || [],
                      description: listingResult.description,
                      analyzeResult: analyzeResult || undefined,
                      aplusCopy: aplusCopy || undefined,
                    }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || '保存失败')
                  setSavedListingId(data.id)
                } catch (e) {
                  setError(e.message || '保存失败')
                } finally {
                  setSaveListingLoading(false)
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {saveListingLoading ? '保存中…' : savedListingId ? '已保存' : '保存到我的 Listing'}
            </button>
            {savedListingId && (
              <Link to="/dashboard/listings" className="text-xs text-gray-500 hover:text-gray-900">查看历史 →</Link>
            )}
            <button
              type="button"
              title="按亚马逊通用列头(item_name, bullet_point_1~5, product_description, generic_keyword)，可复制到上传表格"
              onClick={() => {
                const csv = buildAmazonListingCsv({
                  title: listingResult.title,
                  searchTerms: listingResult.searchTerms,
                  bullets: listingResult.bullets || [],
                  description: listingResult.description,
                })
                downloadAmazonListingCsv(csv)
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              导出 CSV
            </button>
          </div>
          <CopyBlock label="标题" text={listingResult.title} onCopy={copyToClipboard} markdown />
          <CopyBlock label="后台关键词" text={listingResult.searchTerms} onCopy={copyToClipboard} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">五点描述</label>
            {(listingResult.bullets || []).map((b, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <span className="text-xs text-gray-400 shrink-0">{i + 1}.</span>
                <div className="flex-1 flex items-start gap-2">
                  <div className="text-sm text-gray-800 flex-1 [&_strong]:font-semibold [&_p]:inline">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]} components={{ p: ({ children }) => <span>{children}</span> }}>
                      {(b || '—').replace(/\n/g, '\n\n')}
                    </ReactMarkdown>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(b)} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">复制</button>
                </div>
              </div>
            ))}
          </div>
          <CopyBlock label="产品描述" text={listingResult.description} onCopy={copyToClipboard} markdown />

          {/* Step 3 产品图 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">3. 产品图</h3>
            {!productImagesResult?.mainImage && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">生图模型</label>
                <select
                  value={imageModel}
                  onChange={e => setImageModel(e.target.value)}
                  className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                >
                  {IMAGE_MODEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Nano Banana(2.5) 兼容性较好；若遇网络错误可优先选此</p>
              </div>
            )}
            {productImagesResult?.mainImage ? (
              <div className="flex flex-wrap gap-2">
                <img src={productImagesResult.mainImage} alt="主图" className="w-48 h-48 object-contain rounded-lg border border-gray-200 bg-white" />
                <p className="text-xs text-gray-500">主图已生成并保存到仓库，消耗 {productImagesResult.pointsUsed ?? 0} 积分</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-2">生成符合亚马逊主图规范的白底产品图（纯白底、产品约 85%、无文字）。亚马逊要求主图为实际拍摄，生成图建议作参考或附加图使用。</p>
                <p className="text-xs text-amber-700 mb-2">预计消耗 {getPointsPerImage(imageModel, '1K 标准')} 积分（1 张 × {getPointsPerImage(imageModel, '1K 标准')} 积分/张）</p>
                {productImagesLoading && (
                  <div className="mb-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                    <p className="text-sm font-medium text-gray-800 mb-1">正在生成主图（第 1 张）…</p>
                    <p className="text-xs text-gray-500 mb-2">请稍候，通常需 20 秒～1 分钟</p>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full w-2/5 bg-gray-600 rounded-full animate-pulse" style={{ width: '40%' }} />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  disabled={productImagesLoading || !productImageDataUrl}
                  onClick={handleGenerateProductImages}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {productImagesLoading ? '生成中…' : '生成产品图'}
                </button>
              </div>
            )}
          </div>

          {/* Step 4 A+ */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">4. A+ 文案与图片</h3>
            {!aplusCopy && !aplusCopyLoading && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">生成 A+ 模块文案（不扣积分），可再生成 A+ 配图（扣积分）。</p>
                <button
                  type="button"
                  onClick={handleGenerateAplusCopy}
                  disabled={aplusCopyLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-600 disabled:opacity-50"
                >
                  {aplusCopyLoading ? '生成中…' : '生成 A+ 文案'}
                </button>
              </div>
            )}
            {aplusCopy && (
              <>
                <div className="mb-3 text-sm text-gray-700 space-y-1">
                  <p><strong>Hero:</strong> {aplusCopy.heroTagline}</p>
                  <p className="text-gray-600">{aplusCopy.heroSubtext}</p>
                  {(aplusCopy.features || []).map((f, i) => (
                    <p key={i}>{f.title}: {f.desc}</p>
                  ))}
                  <p><strong>{aplusCopy.brandStoryTitle}</strong> {aplusCopy.brandStoryBody}</p>
                </div>
                {!aplusImages ? (
                  <>
                    <p className="text-xs text-amber-700 mb-2">预计消耗 {getPointsPerImage(imageModel, '1K 标准') * 4} 积分（4 张 × {getPointsPerImage(imageModel, '1K 标准')} 积分/张）</p>
                    {aplusImagesLoading && (
                      <div className="mb-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                        <p className="text-sm font-medium text-gray-800 mb-1">正在生成 A+ 图片（共 4 张）…</p>
                        <p className="text-xs text-gray-500 mb-2">顺序生成 Hero + 3 张特点图，请稍候，通常需 1～3 分钟</p>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full w-2/5 bg-gray-600 rounded-full animate-pulse" style={{ width: '40%' }} />
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={aplusImagesLoading}
                      onClick={handleGenerateAplusImages}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {aplusImagesLoading ? '生成中…' : '生成 A+ 图片（扣积分）'}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {aplusImages.heroImage && (
                      <img src={aplusImages.heroImage} alt="A+ Hero" className="w-full max-w-md h-32 object-cover rounded-lg border border-gray-200" />
                    )}
                    {(aplusImages.featureImages || []).filter(Boolean).map((img, i) => (
                      <img key={i} src={img} alt={`A+ 图${i + 1}`} className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
                    ))}
                    <p className="text-xs text-gray-500 w-full">A+ 图片已保存到仓库</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              产品图片 <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">至少 1 张，建议 1–5 张</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/60 text-white text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-2xl cursor-pointer hover:bg-gray-50">
                  <input type="file" accept="image/*" className="hidden" multiple onChange={handleImageChange} />
                  +
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">一级类目 <span className="text-red-500">*</span></label>
              <select
                value={form.category1}
                onChange={e => { set('category1', e.target.value); set('category2', '') }}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
              >
                <option value="">请选择</option>
                {CATEGORY_TREE.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">二级类目 <span className="text-red-500">*</span></label>
              <select
                value={form.category2}
                onChange={e => set('category2', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                disabled={!form.category1}
              >
                <option value="">请选择</option>
                {secondOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">品牌名 <span className="text-red-500">*</span></label>
            <input
              value={form.brand}
              onChange={e => set('brand', e.target.value)}
              placeholder="无品牌可填 Generic"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              核心卖点 <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal">至少填写 2 条</span>
            </label>
            <div className="space-y-2 mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  value={form[`sellingPoint${i}`]}
                  onChange={e => set(`sellingPoint${i}`, e.target.value)}
                  placeholder={`第 ${i} 条卖点`}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                />
              ))}
            </div>
            {sellingPointsLines.length > 0 && sellingPointsLines.length < 2 && (
              <p className="text-xs text-amber-600 mt-1">请至少填写 2 条卖点</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">参考关键词 <span className="text-gray-400 font-normal text-xs">可选</span></label>
            <p className="text-xs text-gray-500 mb-1">多个关键词请用英文逗号或空格分隔</p>
            <input
              value={form.keywords}
              onChange={e => set('keywords', e.target.value)}
              placeholder="例如：insulated water bottle, stainless steel tumbler"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">特殊认证/备注 <span className="text-gray-400 font-normal text-xs">可选</span></label>
            <input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="如 CE、FCC、BPA-free、专利等"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标市场 <span className="text-red-500">*</span></label>
              <select
                value={form.market}
                onChange={e => set('market', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
              >
                {markets.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">输出语言 <span className="text-red-500">*</span></label>
              <select
                value={form.lang}
                onChange={e => set('lang', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="ja">日本語</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="pt-2">
            <button
              disabled={!canSubmit || step === 'analyzing' || step === 'generating'}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
                canSubmit && step !== 'analyzing' && step !== 'generating'
                  ? 'bg-gray-900 text-white hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              onClick={handleSubmit}
            >
              {step === 'analyzing' && '正在分析产品…'}
              {step === 'generating' && '正在生成 Listing…'}
              {step !== 'analyzing' && step !== 'generating' && '生成 Listing'}
            </button>
            {!user && <p className="text-xs text-amber-600 mt-2 text-center">请先登录</p>}
            {user && !canSubmit && step === 'idle' && (
              <p className="text-xs text-gray-400 mt-2 text-center">请上传至少 1 张图、选择类目、填写品牌与至少 2 条卖点</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CopyBlock({ label, text, onCopy, markdown }) {
  if (text == null || text === '') return null
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-start gap-2">
        {markdown ? (
          <div className="text-sm text-gray-800 flex-1 break-words [&_strong]:font-semibold [&_p]:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkBreaks]} components={{ p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p> }}>
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-gray-800 flex-1 whitespace-pre-wrap break-words">{text}</p>
        )}
        <button type="button" onClick={() => onCopy(text)} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">复制</button>
      </div>
    </div>
  )
}

// ── 优化 Listing 表单 ─────────────────────────────────────────────────────────
function OptimizeForm() {
  const [form, setForm] = useState(initOptimize)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSubmit = form.title.trim() && form.bullets.trim()

  return (
    <div className="space-y-5">
      {/* 现有标题 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          现有标题 <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="粘贴你现有的 Listing 标题"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        />
      </div>

      {/* 五点描述 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          五点描述（Bullet Points）<span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.bullets}
          onChange={e => set('bullets', e.target.value)}
          rows={5}
          placeholder="粘贴你现有的五点描述，每条占一行"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none"
        />
      </div>

      {/* 详情描述 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          详情描述（Product Description）
          <span className="text-gray-400 font-normal text-xs ml-1">可选</span>
        </label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={4}
          placeholder="粘贴你现有的详情描述（可选）"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none"
        />
      </div>

      {/* 目标市场 + 输出语言 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标市场</label>
          <select
            value={form.market}
            onChange={e => set('market', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
          >
            {markets.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">输出语言</label>
          <select
            value={form.lang}
            onChange={e => set('lang', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="ja">日本語</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>

      {/* 优化按钮 */}
      <div className="pt-2">
        <button
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
            canSubmit
              ? 'bg-gray-900 text-white hover:bg-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          onClick={() => alert('AI 优化功能即将上线，敬请期待！')}
        >
          优化 Listing
        </button>
        {!canSubmit && (
          <p className="text-xs text-gray-400 mt-2 text-center">请填写标题和五点描述</p>
        )}
      </div>
    </div>
  )
}

// ── 主页面 ─────────────────────────────────────────────────────────────────────
export default function AiAssistant() {
  const [searchParams, setSearchParams] = useSearchParams()
  const platformId = searchParams.get('platform') || 'amazon'
  const [selectedFeature, setSelectedFeature] = useState(null) // null | 'generate' | 'optimize'

  const currentPlatform = platforms.find(p => p.id === platformId) || platforms[0]

  const selectPlatform = (id) => {
    setSearchParams({ platform: id })
    setSelectedFeature(null)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页头 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">AI 运营助手</h1>
          <p className="text-sm text-gray-500 mt-0.5">选择平台，AI 助你快速生成与优化跨境电商运营内容</p>
        </div>

        <div className="flex gap-5">
          {/* ── 左侧：平台侧栏 ── */}
          <aside className="w-44 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">平台</span>
              </div>
              <nav className="py-1.5">
                {platforms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => p.available && selectPlatform(p.id)}
                    disabled={!p.available}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition ${
                      p.available
                        ? platformId === p.id
                          ? 'bg-gray-900 text-white font-medium'
                          : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <span>{p.name}</span>
                    {!p.available && (
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                        即将
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── 右侧：主内容区 ── */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-200 min-h-[560px]">

              {/* 功能列表视图 */}
              {!selectedFeature && currentPlatform.available && (
                <div className="p-6">
                  {/* 平台标题 */}
                  <div className="mb-6 pb-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">{currentPlatform.name}运营工具</h2>
                    <p className="text-sm text-gray-500 mt-1">选择你需要的功能</p>
                    {platformId === 'amazon' && (
                      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                        本模块的生成/优化功能严格遵守亚马逊平台规则，并智能符合 A9、Cosmo、Rufus、GEO 等原则。
                      </p>
                    )}
                  </div>

                  {/* 功能卡片 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {amazonFeatures.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFeature(f.id)}
                        className="group text-left p-5 rounded-xl border border-gray-200 hover:border-gray-900 hover:shadow-sm transition bg-white"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-gray-900 flex items-center justify-center mb-4 transition text-gray-600 group-hover:text-white">
                          {f.icon}
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                        <div className="mt-4 flex items-center text-xs font-medium text-gray-400 group-hover:text-gray-900 transition">
                          <span>开始使用</span>
                          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 功能表单视图 */}
              {selectedFeature && currentPlatform.available && (
                <div className="p-6">
                  {/* 面包屑 */}
                  <div className="flex items-center gap-2 mb-6 pb-5 border-b border-gray-100">
                    <button
                      onClick={() => setSelectedFeature(null)}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      {currentPlatform.name}运营工具
                    </button>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {amazonFeatures.find(f => f.id === selectedFeature)?.title}
                    </span>
                  </div>
                  {platformId === 'amazon' && (
                    <p className="text-xs text-gray-500 mb-4">
                      本模块的生成/优化功能严格遵守亚马逊平台规则，并智能符合 A9、Cosmo、Rufus、GEO 等原则。
                    </p>
                  )}

                  {/* 表单内容 */}
                  <div className="max-w-2xl">
                    {selectedFeature === 'generate' && <GenerateForm />}
                    {selectedFeature === 'optimize' && <OptimizeForm />}
                  </div>
                </div>
              )}

              {/* 即将上线占位 */}
              {!currentPlatform.available && (
                <div className="flex flex-col items-center justify-center h-[400px] text-center px-8">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    {currentPlatform.name} 模块即将上线
                  </h3>
                  <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                    我们正在开发 {currentPlatform.name} 运营工具，敬请期待。
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
