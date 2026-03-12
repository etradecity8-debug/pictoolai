import { useState, useRef, useEffect } from 'react'
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

// ── 产品类别（二级联动，与 docs/ECOMMERCE-AI-ASSISTANT.md 一致）────────────────
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

// Step 4 A+ 暂未开放：每位用户对 A+ 要求不同，研究中
const APLUS_STEP_ENABLED = false

// ── A+ 模块（亚马逊标准 17 种，与 docs/ECOMMERCE-AI-ASSISTANT.md 第三部分一致）────────
const APLUS_MODULES = [
  { id: 'header', name: '图片页头', images: 1, desc: '顶部大图横幅 16:9' },
  { id: 'single_highlights', name: '单图+亮点', images: 1, desc: '1 图 + 4 条亮点' },
  { id: 'image_dark_overlay', name: '深色文字叠加图', images: 1, desc: '图上深色区叠字' },
  { id: 'image_white_overlay', name: '浅色文字叠加图', images: 1, desc: '图上浅色区叠字' },
  { id: 'comparison_chart', name: '对比表格', images: 0, desc: '多产品对比（纯文案）' },
  { id: 'multiple_images', name: '多图模块', images: 4, desc: '4 张图+说明' },
  { id: 'product_description', name: '产品描述长文', images: 0, desc: '纯文字 ≤2000 字' },
  { id: 'company_logo', name: '品牌 Logo', images: 1, desc: '1 张品牌/Logo 图' },
  { id: 'single_image_sidebar', name: '单图+侧栏', images: 1, desc: '1 图+侧边文案' },
  { id: 'standard_text', name: '纯文字', images: 0, desc: '纯文字 ≤500 字' },
  { id: 'quad_images', name: '四图+文字', images: 4, desc: '4 个功能点图文' },
  { id: 'tech_specs', name: '技术规格', images: 0, desc: '纯文字规格表' },
  { id: 'single_right_image', name: '右图左文', images: 1, desc: '1 图在右' },
  { id: 'three_images', name: '三图+文字', images: 3, desc: '3 个功能点图文' },
  { id: 'single_left_image', name: '左图右文', images: 1, desc: '1 图在左' },
  { id: 'single_image_specs', name: '单图+规格', images: 1, desc: '1 图+要点列表' },
  { id: 'brand_story', name: '品牌故事', images: 0, desc: '纯文字品牌段落' },
]
const APLUS_PRESETS = {
  basic: ['header', 'three_images', 'tech_specs'],
  standard: ['header', 'single_highlights', 'three_images', 'tech_specs', 'brand_story'],
  full: ['header', 'single_highlights', 'quad_images', 'tech_specs', 'brand_story'],
}
function getAplusImageCount(modules) {
  return (modules || []).reduce((sum, id) => sum + (APLUS_MODULES.find((m) => m.id === id)?.images || 0), 0)
}

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
  const [productImagesResult, setProductImagesResult] = useState(null) // Step 3 主图 + 附加图 { mainImage, additionalImages?, pointsUsed }
  const [productImagesLoading, setProductImagesLoading] = useState(false)
  const [aplusCopy, setAplusCopy] = useState(null)
  const [aplusCopyLoading, setAplusCopyLoading] = useState(false)
  const [aplusImages, setAplusImages] = useState(null)
  const [aplusImagesLoading, setAplusImagesLoading] = useState(false)
  const [saveListingLoading, setSaveListingLoading] = useState(false)
  const [savedListingId, setSavedListingId] = useState(null)
  const [imageModel, setImageModel] = useState('Nano Banana') // Step 3/4 生图模型，默认 Nano Banana(2.5) 兼容性更好
  const [mainImageCount, setMainImageCount] = useState(1)   // Step 3 白底主图 0～4
  const [sceneImageCount, setSceneImageCount] = useState(1) // Step 3 场景图 0～4
  const [closeUpImageCount, setCloseUpImageCount] = useState(1) // Step 3 特写图 0～4
  const [sellingPointImageCount, setSellingPointImageCount] = useState(0) // Step 3 卖点图 0～卖点数
  const [sellingPointShowText, setSellingPointShowText] = useState(false) // 卖点图是否在图上显示文字
  const [aplusModules, setAplusModules] = useState([...APLUS_PRESETS.basic]) // Step 4 所选 A+ 模块，最多 5 个
  const step4Ref = useRef(null)

  // 步骤 4 生成文案或生图时滚动到该区域，保持展开可见、不折叠
  useEffect(() => {
    if ((aplusCopyLoading || aplusImagesLoading) && step4Ref.current) {
      step4Ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [aplusCopyLoading, aplusImagesLoading])

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
      setStep('analysis_done')
    } catch (e) {
      setError(e.message || '请求失败')
      setStep('error')
    }
  }

  /** 用户确认分析结果后，执行第二步：生成标题·五点·描述 */
  const handleConfirmAndGenerate = async () => {
    if (!analyzeResult?.productSummary || !getToken()) return
    setError('')
    setStep('generating')
    try {
      const genRes = await fetch('/api/ai-assistant/amazon/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          analyzeResult,
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
      setError(e.message || '生成失败')
      setStep('error')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {}).catch(() => {})
  }

  /** 仅重新执行 Step 1 分析，清空 Step 2～4 结果 */
  const handleRegenerateAnalyze = async () => {
    if (!productImageDataUrl || !getToken()) return
    setError('')
    setStep('analyzing')
    try {
      const analyzeRes = await fetch('/api/ai-assistant/amazon/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          images: [productImageDataUrl],
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
      if (!analyzeRes.ok) throw new Error(analyzeData.error || '分析失败')
      setAnalyzeResult(analyzeData)
      setListingResult(null)
      setProductImagesResult(null)
      setAplusCopy(null)
      setAplusImages(null)
      setStep('analysis_done')
    } catch (e) {
      setError(e.message || '分析失败')
      setStep('error')
    }
  }

  /** 仅重新生成 Step 2 标题·五点·描述 */
  const handleRegenerateListing = async () => {
    if (!analyzeResult?.productSummary || !getToken()) return
    setError('')
    setStep('generating')
    try {
      const genRes = await fetch('/api/ai-assistant/amazon/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          analyzeResult,
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
      setError(e.message || '生成失败')
      setStep('error')
    }
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
          mainCount: mainImageCount,
          sceneCount: sceneImageCount,
          closeUpCount: closeUpImageCount,
          sellingPoints: sellingPointsLines,
          sellingPointCount: sellingPointImageCount,
          sellingPointShowText: sellingPointShowText,
          lang: form.lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setProductImagesResult({
        mainImage: data.mainImage,
        mainImages: data.mainImages || [],
        sceneImages: data.sceneImages || [],
        closeUpImages: data.closeUpImages || [],
        sellingPointImages: data.sellingPointImages || [],
        sellingPointLabels: data.sellingPointLabels || [],
        mainImageIds: data.mainImageIds || [],
        sceneImageIds: data.sceneImageIds || [],
        closeUpImageIds: data.closeUpImageIds || [],
        sellingPointImageIds: data.sellingPointImageIds || [],
        additionalImages: data.additionalImages || [],
        pointsUsed: data.pointsUsed,
        mainImageId: data.mainImageId || null,
      })
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
          modules: aplusModules,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'A+ 文案生成失败')
      setAplusCopy(data.copy)
      if (data.modules?.length) setAplusModules(data.modules)
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
          modules: aplusModules,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'A+ 图片生成失败')
      setAplusImages({
        heroImage: data.heroImage,
        featureImages: data.featureImages || [],
        moduleImages: data.moduleImages || {},
        modules: data.modules || aplusModules,
        aplusImageIds: data.aplusImageIds || null,
      })
    } catch (e) {
      setError(e.message || 'A+ 图片生成失败')
    } finally {
      setAplusImagesLoading(false)
    }
  }

  /** 一步完成：先生成 A+ 文案（若无），再生成 A+ 图片；用户只点一个按钮 */
  const handleGenerateAplusCopyAndImages = async () => {
    const extra = (listingResult?.bullets || []).map(b => (b || '').trim()).filter(Boolean)
    let features = sellingPointsLines.length >= 3 ? sellingPointsLines.slice(0, 3) : [...sellingPointsLines, ...extra, ...sellingPointsLines].filter((s, i, a) => a.indexOf(s) === i).slice(0, 3)
    while (features.length < 3) features.push(features[0] || '')
    features = features.slice(0, 3)
    if (!features[0]) {
      setError('A+ 需要至少 1 条卖点')
      return
    }
    if (!productImageDataUrl) {
      setError('生成 A+ 图片需要产品图，请先在步骤 1 上传并分析')
      return
    }
    setError('')
    let copyForImages = aplusCopy
    if (!aplusCopy) {
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
            modules: aplusModules,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'A+ 文案生成失败')
        setAplusCopy(data.copy)
        if (data.modules?.length) setAplusModules(data.modules)
        copyForImages = data.copy
      } catch (e) {
        setError(e.message || 'A+ 文案生成失败')
        setAplusCopyLoading(false)
        return
      }
      setAplusCopyLoading(false)
    }
    setAplusImagesLoading(true)
    try {
      const copyToUse = copyForImages
      const res = await fetch('/api/amazon-aplus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          brand: form.brand.trim(),
          product: analyzeResult?.productName || '',
          features,
          copy: copyToUse,
          productImage: productImageDataUrl,
          style: 'minimal',
          model: imageModel,
          language: form.lang,
          modules: aplusModules,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'A+ 图片生成失败')
      setAplusImages({
        heroImage: data.heroImage,
        featureImages: data.featureImages || [],
        moduleImages: data.moduleImages || {},
        modules: data.modules || aplusModules,
        aplusImageIds: data.aplusImageIds || null,
      })
    } catch (e) {
      setError(e.message || 'A+ 图片生成失败')
    } finally {
      setAplusImagesLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {(step !== 'idle' || listingResult) && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
          {AMAZON_LISTING_STEPS.map((s, i) => {
            const locked = s.id === 4 && !APLUS_STEP_ENABLED
            const done = !locked && ((s.id === 1 && step !== 'idle' && step !== 'analyzing') || (s.id === 2 && (step === 'done' || !!listingResult)) || (s.id === 3 && !!productImagesResult) || (s.id === 4 && !!aplusImages))
            const active = !locked && ((s.id === 1 && step === 'analyzing') || (s.id === 2 && step === 'generating') || (s.id === 3 && productImagesLoading) || (s.id === 4 && (aplusCopyLoading || aplusImagesLoading)))
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-medium ${
                    locked ? 'bg-gray-100 text-gray-400 border border-dashed border-gray-300' : active ? 'bg-gray-800 text-white' : done ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s.id}
                </span>
                <span className={`text-sm ${locked ? 'text-gray-400' : active ? 'font-medium text-gray-900' : done ? 'text-gray-700' : 'text-gray-500'}`}>
                  {s.label}{locked ? '（暂未开放）' : ''}
                </span>
                {i < AMAZON_LISTING_STEPS.length - 1 && (
                  <span className="mx-1 h-px w-4 bg-gray-300" aria-hidden />
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}

      {(step === 'analysis_done' || (step === 'generating' && !listingResult)) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">1. 分析结果（请确认后再生成标题·五点·描述）</h3>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-medium text-gray-500">产品名称</p>
            <p className="text-sm text-gray-900">{analyzeResult?.productName || '—'}</p>
            <p className="text-xs font-medium text-gray-500 mt-3">产品摘要</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{analyzeResult?.productSummary || '—'}</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmAndGenerate}
              disabled={step === 'generating'}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'generating' ? '正在生成标题·五点·描述…' : '确认分析结果'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('idle')
                setAnalyzeResult(null)
                setError('')
              }}
              disabled={step === 'generating'}
              title="不认可分析结果时，返回输入界面修改后重新分析"
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              重新分析
            </button>
          </div>
        </div>
      )}

      {listingResult ? (
        <div className="space-y-4">
          {/* 1. 分析：已有 listing 时提供「重新分析」「清空全部」（重新分析会清空步骤 2～4） */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-900">1. 分析</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateAnalyze}
                  disabled={step === 'analyzing' || !productImageDataUrl}
                  title="重新识别产品并生成摘要，会清空步骤 2～4 的结果"
                  className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >
                  重新分析
                </button>
                <span className="text-gray-300">|</span>
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
                  title="清空所有结果，回到初始状态，需重新上传并分析"
                  className="text-xs text-gray-500 hover:text-gray-900"
                >
                  清空全部
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">已分析：{analyzeResult?.productName || '产品'}。分析 = AI 理解产品；下方各步的「重新生成」= 在现有分析上只重做该步。</p>
          </div>

          {/* Step 2 标题·关键词·五点·描述（与步骤 3、4 同款框） */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">2. 标题·关键词·五点·描述</h3>
              <button
                type="button"
                onClick={handleRegenerateListing}
                disabled={step === 'generating' || !analyzeResult?.productSummary}
                title="在现有分析基础上，只重新生成本步的标题、五点、描述"
                className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
              >
                重新生成
              </button>
            </div>
            <div className="space-y-4">
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
            </div>
          </div>

          {/* Step 3 产品图 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">3. 产品图</h3>
              {(productImagesResult?.mainImage || productImagesResult?.mainImages?.length || productImagesResult?.sceneImages?.length || productImagesResult?.closeUpImages?.length || productImagesResult?.sellingPointImages?.length) && (
                <button type="button" onClick={() => setProductImagesResult(null)} className="text-xs text-gray-500 hover:text-gray-900">
                  重新生成产品图
                </button>
              )}
            </div>
            {!(productImagesResult?.mainImage || productImagesResult?.mainImages?.length || productImagesResult?.sceneImages?.length || productImagesResult?.closeUpImages?.length || productImagesResult?.sellingPointImages?.length) && (
              <div className="mb-3 space-y-3">
                <div>
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
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">生成数量（各类型 0～4 张；卖点图 0～你填写的卖点数）</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">白底主图</label>
                      <select value={mainImageCount} onChange={e => setMainImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                        {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">场景图</label>
                      <select value={sceneImageCount} onChange={e => setSceneImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                        {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">特写图</label>
                      <select value={closeUpImageCount} onChange={e => setCloseUpImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                        {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">卖点图</label>
                      <select value={Math.min(sellingPointImageCount, sellingPointsLines.length)} onChange={e => setSellingPointImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                        {Array.from({ length: sellingPointsLines.length + 1 }, (_, n) => (
                          <option key={n} value={n}>{n} 张</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-0.5">最多 {sellingPointsLines.length} 张，对应你填写的 {sellingPointsLines.length} 条卖点</p>
                      {sellingPointImageCount > 0 && (
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input type="checkbox" checked={sellingPointShowText} onChange={e => setSellingPointShowText(e.target.checked)} className="rounded border-gray-300" />
                          <span className="text-xs text-gray-600">卖点图上显示文字（按所选语言）</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {(productImagesResult?.mainImage || (productImagesResult?.mainImages?.length || productImagesResult?.sceneImages?.length || productImagesResult?.closeUpImages?.length || productImagesResult?.sellingPointImages?.length)) ? (
              <div>
                {(() => {
                  const mainImgs = productImagesResult.mainImages || (productImagesResult.mainImage ? [productImagesResult.mainImage] : [])
                  const sceneImgs = productImagesResult.sceneImages || []
                  const closeUpImgs = productImagesResult.closeUpImages || []
                  const sellingPointImgs = productImagesResult.sellingPointImages || []
                  const sellingPointLbls = productImagesResult.sellingPointLabels || []
                  const legacyImgs = !productImagesResult.mainImages && !productImagesResult.sceneImages && !productImagesResult.closeUpImages && !productImagesResult.sellingPointImages?.length ? (productImagesResult.additionalImages || []) : []
                  const totalCount = mainImgs.length + sceneImgs.length + closeUpImgs.length + sellingPointImgs.length + legacyImgs.length
                  return (
                    <>
                      <div className="space-y-4">
                        {mainImgs.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">白底主图</h4>
                            <div className="flex flex-wrap gap-3">
                              {mainImgs.map((src, i) => (
                                <div key={`m-${i}`}>
                                  <img src={src} alt={`主图${i + 1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />
                                  <p className="text-xs text-gray-500 mt-1">{i + 1}/{mainImgs.length}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {sceneImgs.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">场景图</h4>
                            <div className="flex flex-wrap gap-3">
                              {sceneImgs.map((src, i) => (
                                <div key={`s-${i}`}>
                                  <img src={src} alt={`场景图${i + 1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />
                                  <p className="text-xs text-gray-500 mt-1">{i + 1}/{sceneImgs.length}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {closeUpImgs.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">特写图</h4>
                            <div className="flex flex-wrap gap-3">
                              {closeUpImgs.map((src, i) => (
                                <div key={`c-${i}`}>
                                  <img src={src} alt={`特写图${i + 1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />
                                  <p className="text-xs text-gray-500 mt-1">{i + 1}/{closeUpImgs.length}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {sellingPointImgs.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">卖点图</h4>
                            <div className="flex flex-wrap gap-3">
                              {sellingPointImgs.map((src, i) => (
                                <div key={`sp-${i}`}>
                                  <img src={src} alt={`卖点图${i + 1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />
                                  <p className="text-xs text-gray-500 mt-1">卖点 {i + 1}{sellingPointLbls[i] ? `: ${(sellingPointLbls[i] || '').slice(0, 20)}${(sellingPointLbls[i] || '').length > 20 ? '…' : ''}` : ''}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {legacyImgs.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">附加图</h4>
                            <div className="flex flex-wrap gap-3">
                              {legacyImgs.map((src, i) => (
                                <div key={i}>
                                  <img src={src} alt={`附加图${i + 2}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-3">共 {totalCount} 张已保存到仓库，消耗 {productImagesResult.pointsUsed ?? 0} 积分</p>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-2 space-y-0.5">
                  <span className="block">白底主图：纯白底、产品约 85%、无文字</span>
                  <span className="block">场景图：使用场景或生活化背景</span>
                  <span className="block">特写图：产品细节、材质特写</span>
                  <span className="block">卖点图：每张对应一条你填写的卖点，视觉化展示；可勾选「显示文字」在图上展示卖点文案</span>
                  <span className="block mt-1">亚马逊要求主图为实际拍摄，生成图建议作参考或附加图使用。</span>
                </p>
                <p className="text-xs text-gray-400 mb-2">生成后可点击上方「重新生成产品图」换一版再生成（会扣积分）。</p>
                <p className="text-xs text-amber-700 mb-2">预计消耗 {getPointsPerImage(imageModel, '1K 标准') * (mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount)} 积分（{mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount} 张 × {getPointsPerImage(imageModel, '1K 标准')} 积分/张）</p>
                {productImagesLoading && (
                  <div className="mb-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                    <p className="text-sm font-medium text-gray-800 mb-1">正在生成产品图（共 {mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount} 张）…</p>
                    <p className="text-xs text-gray-500 mb-2">请稍候，每张约 20 秒～1 分钟</p>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-600 rounded-full animate-pulse" style={{ width: '50%' }} />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  disabled={productImagesLoading || !productImageDataUrl || (mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount === 0)}
                  onClick={handleGenerateProductImages}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {productImagesLoading ? '生成中…' : `生成产品图（${mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount} 张）`}
                </button>
              </div>
            )}
          </div>

          {/* Step 4 A+（暂锁：每位用户对 A+ 要求不同，研究中） */}
          <div
            ref={step4Ref}
            className={`rounded-xl border p-4 transition-colors ${APLUS_STEP_ENABLED && aplusImagesLoading ? 'border-gray-400 bg-amber-50/50 ring-1 ring-amber-200' : 'border-gray-200 bg-gray-50'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">4. A+ 文案与图片</h3>
              {APLUS_STEP_ENABLED && (
              <div className="flex items-center gap-2">
                {aplusCopy && (
                  <button type="button" onClick={() => { setAplusCopy(null); setAplusImages(null) }} className="text-xs text-gray-500 hover:text-gray-900">
                    重新生成文案
                  </button>
                )}
                {aplusImages && (
                  <>
                    {aplusCopy && <span className="text-gray-300">|</span>}
                    <button type="button" onClick={() => setAplusImages(null)} className="text-xs text-gray-500 hover:text-gray-900">
                      重新生成图片
                    </button>
                  </>
                )}
              </div>
              )}
            </div>
            {!APLUS_STEP_ENABLED ? (
              <p className="text-sm text-gray-500 py-4">🔒 功能优化中。每位用户对 A+ 的要求不同，我们正在研究如何更好地满足个性化需求，敬请期待。</p>
            ) : !aplusImages && (
              <div className="mb-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">选择 A+ 模块</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['basic', 'standard', 'full'].map((key) => {
                      const isActive = JSON.stringify(aplusModules) === JSON.stringify(APLUS_PRESETS[key])
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAplusModules([...APLUS_PRESETS[key]])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            isActive ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {key === 'basic' ? '基础（3 模块）' : key === 'standard' ? '标准（5 模块）' : '精品（5 模块）'}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setAplusModules([])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        !['basic', 'standard', 'full'].some((key) => JSON.stringify(aplusModules) === JSON.stringify(APLUS_PRESETS[key]))
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      自定义
                    </button>
                  </div>
                  <p className="text-xs font-medium text-gray-700 mb-1">从下方 17 种亚马逊标准模块中勾选，最多 5 个</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    {APLUS_MODULES.map((m) => {
                      const on = aplusModules.includes(m.id)
                      const toggle = () => {
                        if (on) setAplusModules((prev) => prev.filter((x) => x !== m.id))
                        else if (aplusModules.length < 5) setAplusModules((prev) => [...prev, m.id])
                      }
                      return (
                        <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={on} onChange={toggle} className="rounded border-gray-300" />
                          <span>{m.name}</span>
                          {m.images > 0 && <span className="text-gray-400">({m.images} 图)</span>}
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">已选 {aplusModules.length}/5 个模块，共 {getAplusImageCount(aplusModules)} 张图</p>
                </div>
                {(aplusCopyLoading || aplusImagesLoading) && (
                  <div className="mb-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {aplusCopyLoading ? '正在生成 A+ 文案…' : `正在生成 A+ 图片（共 ${getAplusImageCount(aplusModules)} 张）…`}
                    </p>
                    {aplusImagesLoading && (
                      <p className="text-xs text-gray-600 mb-2">按模块顺序生成，每张约 20 秒～1 分钟，请勿离开页面</p>
                    )}
                    {(aplusCopyLoading || aplusImagesLoading) && (
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: aplusCopyLoading ? '30%' : '60%' }} />
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-amber-700 mb-2">预计消耗 {getPointsPerImage(imageModel, '1K 标准') * getAplusImageCount(aplusModules)} 积分（{getAplusImageCount(aplusModules)} 张 × {getPointsPerImage(imageModel, '1K 标准')} 积分/张）</p>
                <button
                  type="button"
                  onClick={handleGenerateAplusCopyAndImages}
                  disabled={aplusCopyLoading || aplusImagesLoading || aplusModules.length === 0 || !productImageDataUrl}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-600 disabled:opacity-50"
                >
                  {aplusCopyLoading || aplusImagesLoading ? '生成中…' : '生成 A+ 文案和图片'}
                </button>
              </div>
            )}
            {APLUS_STEP_ENABLED && aplusCopy && aplusImages && (
              <>
                <div className="mb-3 text-sm text-gray-700 space-y-2">
                  {(aplusCopy._modules || aplusModules).includes('header') && (aplusCopy.heroTagline || aplusCopy.heroSubtext) && (
                    <div><strong>页头：</strong> {aplusCopy.heroTagline} — {aplusCopy.heroSubtext}</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('single_highlights') && (aplusCopy.highlightTitle || aplusCopy.highlights?.length) && (
                    <div><strong>单图+亮点：</strong> {aplusCopy.highlightTitle} · {(aplusCopy.highlights || []).join('；')}</div>
                  )}
                  {['image_dark_overlay', 'image_white_overlay'].some(m => (aplusCopy._modules || aplusModules).includes(m)) && (
                    (aplusCopy.overlayDarkHeadline || aplusCopy.overlayWhiteHeadline) && (
                      <div><strong>叠加图文案：</strong> {aplusCopy.overlayDarkHeadline || aplusCopy.overlayWhiteHeadline}</div>
                    )
                  )}
                  {(aplusCopy._modules || aplusModules).includes('comparison_chart') && (aplusCopy.comparisonRows || []).length > 0 && (
                    <div><strong>对比表：</strong> {(aplusCopy.comparisonRows || []).map((r) => `${r.feature}: ${r.value1 || ''}/${r.value2 || ''}`).join('；')}</div>
                  )}
                  {['three_images', 'quad_images', 'multiple_images'].some(m => (aplusCopy._modules || aplusModules).includes(m)) && (aplusCopy.features || []).map((f, i) => (
                    <div key={i}><strong>{(f.title || '').slice(0, 20)}：</strong> {(f.desc || '').slice(0, 80)}…</div>
                  ))}
                  {(aplusCopy._modules || aplusModules).includes('product_description') && aplusCopy.productDescriptionText && (
                    <div><strong>产品描述：</strong> {(aplusCopy.productDescriptionText || '').slice(0, 120)}…</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('single_image_sidebar') && (aplusCopy.sidebarTitle || aplusCopy.sidebarBody) && (
                    <div><strong>单图侧栏：</strong> {aplusCopy.sidebarTitle} — {(aplusCopy.sidebarBody || '').slice(0, 60)}…</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('standard_text') && aplusCopy.standardTextBody && (
                    <div><strong>纯文字：</strong> {(aplusCopy.standardTextBody || '').slice(0, 80)}…</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('tech_specs') && (aplusCopy.techSpecs || []).length > 0 && (
                    <div><strong>技术规格：</strong> {(aplusCopy.techSpecs || []).map((r) => `${r.name}: ${r.value}`).join('；')}</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('single_right_image') && (aplusCopy.singleRightTitle || aplusCopy.singleRightBody) && (
                    <div><strong>右图左文：</strong> {aplusCopy.singleRightTitle} — {(aplusCopy.singleRightBody || '').slice(0, 50)}…</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('single_left_image') && (aplusCopy.singleLeftTitle || aplusCopy.singleLeftBody) && (
                    <div><strong>左图右文：</strong> {aplusCopy.singleLeftTitle} — {(aplusCopy.singleLeftBody || '').slice(0, 50)}…</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('single_image_specs') && (aplusCopy.singleSpecsTitle || (aplusCopy.singleSpecsBullets || []).length) && (
                    <div><strong>单图+规格：</strong> {aplusCopy.singleSpecsTitle} · {(aplusCopy.singleSpecsBullets || []).join('；')}</div>
                  )}
                  {(aplusCopy._modules || aplusModules).includes('brand_story') && (aplusCopy.brandStoryTitle || aplusCopy.brandStoryBody) && (
                    <div><strong>{aplusCopy.brandStoryTitle}</strong> {aplusCopy.brandStoryBody}</div>
                  )}
                </div>
                {aplusImages && (
                  <div className="space-y-3">
                    {aplusImages.moduleImages?.header && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">页头</p><img src={aplusImages.moduleImages.header} alt="Header" className="w-full max-w-md h-32 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {aplusImages.moduleImages?.single_highlights && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">单图+亮点</p><img src={aplusImages.moduleImages.single_highlights} alt="Highlights" className="w-40 h-40 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {aplusImages.moduleImages?.image_dark_overlay && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">深色叠加图</p><img src={aplusImages.moduleImages.image_dark_overlay} alt="Dark overlay" className="w-full max-w-md h-28 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {aplusImages.moduleImages?.image_white_overlay && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">浅色叠加图</p><img src={aplusImages.moduleImages.image_white_overlay} alt="White overlay" className="w-full max-w-md h-28 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {(aplusImages.moduleImages?.multiple_images || []).filter(Boolean).length > 0 && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">多图模块</p><div className="flex flex-wrap gap-2">{(aplusImages.moduleImages.multiple_images || []).filter(Boolean).map((img, i) => <img key={i} src={img} alt="" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />)}</div></div>
                    )}
                    {aplusImages.moduleImages?.company_logo && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">品牌 Logo</p><img src={aplusImages.moduleImages.company_logo} alt="Logo" className="max-w-xs h-20 object-contain rounded-lg border border-gray-200" /></div>
                    )}
                    {aplusImages.moduleImages?.single_image_sidebar && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">单图侧栏</p><img src={aplusImages.moduleImages.single_image_sidebar} alt="Sidebar" className="w-40 h-40 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {[...(aplusImages.moduleImages?.three_images || []), ...(aplusImages.moduleImages?.quad_images || []), ...(aplusImages.featureImages || [])].filter(Boolean).length > 0 && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">功能图</p><div className="flex flex-wrap gap-2">{[...(aplusImages.moduleImages?.three_images || []), ...(aplusImages.moduleImages?.quad_images || []), ...(aplusImages.featureImages || [])].filter(Boolean).map((img, i) => <img key={i} src={img} alt="" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />)}</div></div>
                    )}
                    {aplusImages.moduleImages?.single_right_image && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">右图左文</p><img src={aplusImages.moduleImages.single_right_image} alt="Right" className="w-40 h-40 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {aplusImages.moduleImages?.single_left_image && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">左图右文</p><img src={aplusImages.moduleImages.single_left_image} alt="Left" className="w-40 h-40 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    {aplusImages.moduleImages?.single_image_specs && (
                      <div><p className="text-xs font-medium text-gray-500 mb-1">单图+规格</p><img src={aplusImages.moduleImages.single_image_specs} alt="Specs" className="w-40 h-40 object-cover rounded-lg border border-gray-200" /></div>
                    )}
                    <p className="text-xs text-gray-500">A+ 图片已保存到仓库</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 所有步骤结束后：保存与导出 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 mb-2"><strong>保存到我的 Listing：</strong>将保存本页标题、后台关键词、五点、描述、分析结果与 A+ 文案；若已生成产品主图或 A+ 图片，会一并关联到本记录，可在「Listing 历史」中查看。</p>
            <p className="text-xs text-gray-500 mb-3"><strong>导出 CSV：</strong>只导出文案，如果需要图片，请到仓库中查找。</p>
            <div className="flex flex-wrap items-center gap-2">
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
                        mainImageId: productImagesResult?.mainImageId || undefined,
                        aplusImageIds: aplusImages?.aplusImageIds || undefined,
                        productImageIds: (productImagesResult?.mainImageIds?.length || productImagesResult?.sceneImageIds?.length || productImagesResult?.closeUpImageIds?.length || productImagesResult?.sellingPointImageIds?.length) ? {
                          mainImageIds: productImagesResult.mainImageIds || [],
                          sceneImageIds: productImagesResult.sceneImageIds || [],
                          closeUpImageIds: productImagesResult.closeUpImageIds || [],
                          sellingPointImageIds: productImagesResult.sellingPointImageIds || [],
                        } : undefined,
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
          </div>
        </div>
      ) : (step === 'idle' || step === 'error' || step === 'analyzing') ? (
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
              {step !== 'analyzing' && '分析产品'}
            </button>
            {!user && <p className="text-xs text-amber-600 mt-2 text-center">请先登录</p>}
            {user && !canSubmit && step === 'idle' && (
              <p className="text-xs text-gray-400 mt-2 text-center">请上传至少 1 张图、选择类目、填写品牌与至少 2 条卖点</p>
            )}
          </div>
        </>
      ) : null}
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
                      <p className="text-2xl text-gray-500 mt-3 pt-3 border-t border-gray-100">
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
                    <p className="text-2xl text-gray-500 mb-4">
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
