import { useState, useRef, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useAuth } from '../context/AuthContext'
import { buildAmazonCsv, buildEbayCsv, buildAliExpressCsv, downloadCsv, downloadJson } from '../lib/exportListingCsv'
import { getPointsPerImage } from '../lib/pointsConfig'

// ── 平台列表 ──────────────────────────────────────────────────────────────────
const platforms = [
  { id: 'amazon',      name: '亚马逊',     nameEn: 'Amazon',      available: true  },
  { id: 'ebay',        name: 'eBay',        nameEn: 'eBay',        available: true  },
  { id: 'aliexpress',  name: '速卖通',     nameEn: 'AliExpress',  available: true  },
  { id: 'shopify',     name: 'Shopify',     nameEn: 'Shopify',     available: false },
  { id: 'tiktok',      name: 'TikTok Shop', nameEn: 'TikTok Shop', available: false },
  { id: 'walmart',     name: '沃尔玛',     nameEn: 'Walmart',     available: false },
  { id: 'etsy',        name: 'Etsy',        nameEn: 'Etsy',        available: false },
  { id: 'temu',        name: 'TEMU',        nameEn: 'TEMU',        available: false },
  { id: 'independent', name: '独立站',     nameEn: 'Independent', available: false },
]

const generateIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)
const optimizeIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

// ── eBay / 速卖通 功能列表 ────────────────────────────────────────────────────
const ebayFeatures = [
  { id: 'generate', title: '生成 Listing', desc: '上传产品图，AI 自动提取 Cassini 高频搜索词、买家问题与目标画像，策略化生成 80 字符标题 · 15+ Item Specifics · 产品描述与产品图，支持多市场多语言。', icon: generateIcon },
  { id: 'optimize', title: '优化 Listing', desc: '基于 Cassini 搜索算法深度诊断，AI 自动提取关键词缺口、Item Specifics 覆盖率与 GPSR 合规风险，逐项评分并一键输出优化版本。', icon: optimizeIcon },
]
const aliexpressFeatures = [
  { id: 'generate', title: '生成 Listing', desc: '上传产品图，AI 自动提取搜索高频词、买家问题与目标画像，基于标题权重 32.7% 算法策略化生成 128 字符标题 · 15+ 产品属性 · 详情描述与产品图。', icon: generateIcon },
  { id: 'optimize', title: '优化 Listing', desc: '基于速卖通搜索算法深度诊断，AI 检测关键词重复惩罚、属性覆盖缺失与 CE/UKCA 合规风险，逐项评分并一键输出优化版本。', icon: optimizeIcon },
]

// ── eBay 目标市场 ─────────────────────────────────────────────────────────────
const ebayMarkets = [
  { value: 'us', label: '美国（eBay.com）' },
  { value: 'uk', label: '英国（eBay.co.uk）' },
  { value: 'de', label: '德国（eBay.de）' },
  { value: 'fr', label: '法国（eBay.fr）' },
  { value: 'au', label: '澳大利亚（eBay.com.au）' },
  { value: 'ca', label: '加拿大（eBay.ca）' },
  { value: 'it', label: '意大利（eBay.it）' },
  { value: 'es', label: '西班牙（eBay.es）' },
]

// ── 速卖通目标市场 ────────────────────────────────────────────────────────────
const aliexpressMarkets = [
  { value: 'global', label: '全球' },
  { value: 'us', label: '美国' },
  { value: 'ru', label: '俄罗斯' },
  { value: 'br', label: '巴西' },
  { value: 'fr', label: '法国' },
  { value: 'es', label: '西班牙' },
  { value: 'de', label: '德国' },
  { value: 'uk', label: '英国' },
  { value: 'kr', label: '韩国' },
  { value: 'jp', label: '日本' },
]

// ── 亚马逊功能列表 ─────────────────────────────────────────────────────────────
const amazonFeatures = [
  {
    id: 'generate',
    title: '生成 Listing',
    desc: '上传产品图，AI 自动提取搜索关键词、买家问题与目标画像，基于 A9 · Cosmo · Rufus · GEO 四大算法生成高转化 Listing 与产品图，支持多市场多语言。',
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
    desc: '基于 A9 · Cosmo · Rufus · GEO 四大算法深度诊断，AI 自动提取高频搜索词、买家问题与竞品差异，逐项评分并一键输出优化版本。',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: 'competitor',
    title: '竞品对比',
    desc: '粘贴竞品 Listing，AI 对比关键词覆盖、卖点差异、标题策略，找出你的优势与机会点，输出可执行的优化行动清单。',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'keywords',
    title: '关键词研究',
    desc: '输入产品名称，AI 生成系统化关键词策略：核心词、长尾词分组、后台关键词建议与标题排布方案，覆盖 A9 全链路。',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

// ── 亚马逊产品类别（二级联动，与 docs/ECOMMERCE-AI-ASSISTANT.md 一致）─────────
const CATEGORY_TREE = [
  { id: 'home', name: 'Home & Kitchen', children: ['Kitchen & Dining', 'Storage & Organization', 'Bedding', 'Lighting', 'Cleaning Supplies', 'Bathroom Accessories'] },
  { id: 'sports', name: 'Sports & Outdoors', children: ['Outdoor Recreation', 'Exercise & Fitness', 'Cycling', 'Swimming', 'Team Sports'] },
  { id: 'electronics', name: 'Electronics', children: ['Cell Phone Accessories', 'Computer Accessories', 'Audio Equipment', 'Camera & Photo', 'Smart Home'] },
  { id: 'beauty', name: 'Beauty & Personal Care', children: ['Skin Care', 'Makeup', 'Hair Care', 'Fragrance', 'Health Care'] },
  { id: 'pet', name: 'Pet Supplies', children: ['Dog Supplies', 'Cat Supplies', 'Small Animal Supplies', 'Fish & Aquatic Pets'] },
  { id: 'baby', name: 'Baby', children: ['Feeding', 'Baby Clothing', 'Baby Toys', 'Baby Safety'] },
  { id: 'apparel', name: 'Clothing, Shoes & Jewelry', children: ['Men\'s Fashion', 'Women\'s Fashion', 'Shoes', 'Bags & Accessories'] },
  { id: 'toys', name: 'Toys & Games', children: ['Educational Toys', 'Remote Control Toys', 'Outdoor Play', 'Board Games'] },
  { id: 'auto', name: 'Automotive', children: ['Interior Accessories', 'Exterior Accessories', 'Tools & Equipment', 'Car Electronics'] },
  { id: 'tools', name: 'Tools & Home Improvement', children: ['Power Tools', 'Hand Tools', 'Hardware'] },
  { id: 'garden', name: 'Garden & Outdoor', children: ['Gardening Tools', 'Planting Supplies', 'Outdoor Furniture'] },
  { id: 'health', name: 'Health & Household', children: ['Vitamins & Supplements', 'Medical Supplies', 'First Aid'] },
  { id: 'office', name: 'Office Products', children: ['Office Supplies', 'Printer Supplies', 'Office Furniture'] },
  { id: 'other', name: 'Other', children: ['Other'] },
]

// ── eBay 产品类别（基于 eBay.com 官方 L1/L2 类目）──────────────────────────────
const EBAY_CATEGORY_TREE = [
  { id: 'electronics', name: 'Electronics', children: ['Cell Phones & Accessories', 'Computers/Tablets & Networking', 'Cameras & Photo', 'Video Games & Consoles', 'TV, Video & Home Audio', 'Portable Audio & Headphones', 'Smart Home & Surveillance', 'Major Appliances', 'Vehicle Electronics & GPS'] },
  { id: 'home_garden', name: 'Home & Garden', children: ['Home Décor', 'Kitchen, Dining & Bar', 'Yard, Garden & Outdoor Living', 'Home Improvement', 'Tools & Workshop Equipment', 'Furniture', 'Bedding', 'Lamps, Lighting & Ceiling Fans', 'Household Supplies & Cleaning', 'Bath', 'Rugs & Carpets', 'Food & Beverages'] },
  { id: 'clothing', name: 'Clothing, Shoes & Accessories', children: ['Women\'s Clothing', 'Women\'s Shoes', 'Women\'s Accessories', 'Men\'s Clothing', 'Men\'s Shoes', 'Men\'s Accessories', 'Kids\' Clothing', 'Kids\' Shoes', 'Luggage'] },
  { id: 'sporting', name: 'Sporting Goods', children: ['Golf', 'Hunting', 'Cycling', 'Fishing', 'Outdoor Sports', 'Team Sports', 'Winter Sports', 'Camping & Hiking', 'Fitness, Running & Yoga', 'Water Sports', 'Tennis & Racquet Sports'] },
  { id: 'toys', name: 'Toys & Hobbies', children: ['Collectible Card Games', 'Action Figures', 'Building Toys', 'Diecast & Toy Vehicles', 'Games', 'Radio Control', 'Models & Kits', 'Puzzles', 'Outdoor Toys & Structures', 'Preschool Toys'] },
  { id: 'health_beauty', name: 'Health & Beauty', children: ['Fragrances', 'Vitamins & Supplements', 'Skin Care', 'Hair Care & Styling', 'Makeup', 'Shaving & Hair Removal', 'Health Care', 'Bath & Body', 'Oral Care', 'Nail Care'] },
  { id: 'jewelry', name: 'Jewelry & Watches', children: ['Watches', 'Fine Jewelry', 'Fashion Jewelry', 'Men\'s Jewelry', 'Engagement & Wedding', 'Loose Diamonds & Gemstones', 'Body Jewelry', 'Children\'s Jewelry'] },
  { id: 'baby', name: 'Baby Essentials', children: ['Baby Clothing', 'Strollers & Accessories', 'Diapering', 'Feeding', 'Nursery Bedding', 'Toys for Baby', 'Baby Gear', 'Car Safety Seats', 'Nursery Furniture', 'Bathing & Grooming'] },
  { id: 'pet', name: 'Pet Supplies', children: ['Dog Supplies', 'Cat Supplies', 'Fish & Aquariums', 'Bird Supplies', 'Small Animal Supplies', 'Reptile Supplies'] },
  { id: 'motors', name: 'eBay Motors', children: ['Parts & Accessories', 'Automotive Tools & Supplies', 'Motorcycles', 'Powersports', 'Boats'] },
  { id: 'collectibles', name: 'Collectibles & Art', children: ['Sports Memorabilia', 'Collectibles', 'Dolls & Bears', 'Art', 'Crafts', 'Coins & Paper Money', 'Antiques', 'Stamps', 'Pottery & Glass'] },
  { id: 'business', name: 'Business & Industrial', children: ['Healthcare, Lab & Dental', 'CNC & Metalworking', 'Test & Measurement', 'Electrical Equipment', 'Office', 'Restaurant & Food Service', 'Heavy Equipment', 'Building Materials'] },
  { id: 'books', name: 'Books, Movies & Music', children: ['Books & Magazines', 'Music', 'Musical Instruments & Gear', 'Movies & TV'] },
  { id: 'other', name: 'Other', children: ['Other'] },
]

// ── 速卖通产品类别（基于 AliExpress 官方类目体系）──────────────────────────────
const ALIEXPRESS_CATEGORY_TREE = [
  { id: 'women_clothing', name: 'Women\'s Clothing', children: ['Dresses', 'Tops & Tees', 'Pants', 'Outerwear', 'Skirts', 'Suits & Sets', 'Activewear', 'Lingerie'] },
  { id: 'men_clothing', name: 'Men\'s Clothing', children: ['T-Shirts', 'Shirts', 'Pants', 'Jackets & Coats', 'Activewear', 'Suits', 'Underwear'] },
  { id: 'phones', name: 'Phones & Telecommunications', children: ['Phone Cases & Covers', 'Phone Accessories', 'Screen Protectors', 'Chargers & Cables', 'Bluetooth Earphones', 'Power Banks'] },
  { id: 'computer', name: 'Computer & Office', children: ['Laptop Accessories', 'Tablet Accessories', 'Keyboards & Mice', 'Storage Devices', 'Printer Supplies', 'Networking'] },
  { id: 'electronics', name: 'Consumer Electronics', children: ['Earphones & Speakers', 'Wearable Devices', 'Camera & Photo', 'Gaming Accessories', 'Projectors', 'Smart Home'] },
  { id: 'jewelry', name: 'Jewelry & Accessories', children: ['Necklaces', 'Bracelets & Bangles', 'Earrings', 'Rings', 'Brooches', 'Hair Accessories', 'Jewelry Sets'] },
  { id: 'watches', name: 'Watches', children: ['Men\'s Watches', 'Women\'s Watches', 'Kids\' Watches', 'Smart Watches', 'Watch Bands & Accessories'] },
  { id: 'shoes', name: 'Shoes', children: ['Women\'s Shoes', 'Men\'s Shoes', 'Kids\' Shoes', 'Sneakers', 'Sandals & Slippers', 'Boots'] },
  { id: 'bags', name: 'Luggage & Bags', children: ['Women\'s Bags', 'Men\'s Bags', 'Backpacks', 'Luggage & Travel', 'Wallets', 'Waist Packs & Chest Bags'] },
  { id: 'home', name: 'Home & Garden', children: ['Home Decor', 'Kitchen & Dining', 'Storage & Organization', 'Lighting', 'Bathroom', 'Garden', 'Pet Supplies', 'Festive & Party Supplies'] },
  { id: 'home_improvement', name: 'Home Improvement', children: ['Hardware & Tools', 'Electrical Equipment', 'Plumbing', 'Locks & Security', 'Paints & Coatings'] },
  { id: 'home_appliances', name: 'Home Appliances', children: ['Kitchen Appliances', 'Household Appliances', 'Personal Care Appliances', 'Cleaning Appliances', 'Climate Control'] },
  { id: 'beauty', name: 'Beauty & Health', children: ['Skin Care', 'Makeup', 'Nail Art', 'Hair Styling Tools', 'Wigs', 'Beauty Devices', 'Health Care'] },
  { id: 'mother_baby', name: 'Mother & Kids', children: ['Kids\' Clothing', 'Baby Clothing', 'Feeding', 'Maternity Clothing', 'Baby Toys', 'Baby Safety'] },
  { id: 'toys', name: 'Toys & Hobbies', children: ['RC Toys', 'Building Blocks & Models', 'Stuffed Animals & Plush', 'Educational Toys', 'Outdoor Toys', 'Board Games', 'Collectible Models'] },
  { id: 'sports', name: 'Sports & Entertainment', children: ['Sportswear', 'Fitness Equipment', 'Outdoor Gear', 'Camping', 'Cycling', 'Swimming', 'Team Sports', 'Yoga'] },
  { id: 'auto', name: 'Automobiles & Motorcycles', children: ['Car Interior', 'Car Exterior', 'Car Electronics', 'Car Care', 'Motorcycle Accessories', 'LED Car Lights'] },
  { id: 'tools', name: 'Tools', children: ['Power Tools', 'Hand Tools', 'Measuring Tools', 'Welding Equipment', 'Tool Storage'] },
  { id: 'security', name: 'Security & Protection', children: ['Surveillance Cameras', 'Access Control', 'Alarm Systems', 'Security Accessories'] },
  { id: 'office', name: 'Office & School Supplies', children: ['Stationery', 'Office Supplies', 'Teaching Equipment'] },
  { id: 'other', name: 'Other', children: ['Other'] },
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
const initOptimize = { title: '', bullets: '', description: '', searchTerms: '', market: 'us', lang: 'en' }

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
  const [genVariants, setGenVariants] = useState([])
  const [genVariantsLoading, setGenVariantsLoading] = useState(false)
  const [genActiveTab, setGenActiveTab] = useState(0)
  const [imageModel, setImageModel] = useState('Nano Banana') // Step 3/4 生图模型，默认 Nano Banana(2.5) 兼容性更好
  const [mainImageCount, setMainImageCount] = useState(1)   // Step 3 白底主图 0～4
  const [sceneImageCount, setSceneImageCount] = useState(1) // Step 3 场景图 0～4
  const [closeUpImageCount, setCloseUpImageCount] = useState(1) // Step 3 特写图 0～4
  const [sellingPointImageCount, setSellingPointImageCount] = useState(0) // Step 3 卖点图 0～卖点数
  const [sellingPointShowText, setSellingPointShowText] = useState(false) // 卖点图是否在图上显示文字
  const [interactionImageCount, setInteractionImageCount] = useState(0) // Step 3 交互图 0～4
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

  const handleGenerateVariants = async () => {
    const token = getToken()
    if (!token || !listingResult) return
    setGenVariantsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai-assistant/amazon/generate-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentListing: listingResult,
          analysis: analyzeResult || null,
          market: form.market,
          lang: form.lang,
          variantCount: 2,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '变体生成失败')
      setGenVariants(data.variants || [])
      setGenActiveTab(0)
    } catch (e) {
      setError(e.message || '变体生成失败')
    } finally {
      setGenVariantsLoading(false)
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
    setGenVariants([])
    setGenActiveTab(0)
    setGenVariants([])
    setGenActiveTab(0)
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
          interactionCount: interactionImageCount,
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
        interactionImages: data.interactionImages || [],
        mainImageIds: data.mainImageIds || [],
        sceneImageIds: data.sceneImageIds || [],
        closeUpImageIds: data.closeUpImageIds || [],
        sellingPointImageIds: data.sellingPointImageIds || [],
        interactionImageIds: data.interactionImageIds || [],
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
          {/* 产品洞察 */}
          {(analyzeResult?.topKeywords?.length > 0 || analyzeResult?.buyerQuestions?.length > 0 || analyzeResult?.buyerPersonas?.length > 0 || analyzeResult?.keyAttributes?.length > 0) && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-3">
              <p className="text-xs font-bold text-gray-800">产品洞察（以下数据将驱动 Listing 生成）</p>
              {analyzeResult.topKeywords?.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1 block">高频搜索词 · A9</span>
                  <div className="flex flex-wrap gap-1.5">
                    {analyzeResult.topKeywords.map((kw, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {analyzeResult.buyerQuestions?.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1 block">买家常见问题 · Rufus</span>
                  <ul className="space-y-0.5">
                    {analyzeResult.buyerQuestions.map((q, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                        <span className="text-blue-400 shrink-0">Q{i + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analyzeResult.buyerPersonas?.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1 block">目标买家 · Cosmo</span>
                  <ul className="space-y-0.5">
                    {analyzeResult.buyerPersonas.map((p, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                        <span className="text-blue-400 shrink-0">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analyzeResult.keyAttributes?.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1 block">关键规格 · GEO</span>
                  <div className="flex flex-wrap gap-1.5">
                    {analyzeResult.keyAttributes.map((s, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900">2. 标题·关键词·五点·描述</h3>
                {genVariants.length > 0 && (
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    {[listingResult, ...genVariants].map((_, i) => (
                      <button key={i} type="button" onClick={() => setGenActiveTab(i)}
                        className={`px-2 py-0.5 transition whitespace-nowrap ${genActiveTab === i ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >{i === 0 ? '原版' : `变体 ${String.fromCharCode(64 + i)}`}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleGenerateVariants} disabled={genVariantsLoading || step === 'generating'}
                  className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >{genVariantsLoading ? '生成变体中…' : genVariants.length > 0 ? '重新生成变体' : 'A/B 变体'}</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={handleRegenerateListing} disabled={step === 'generating' || !analyzeResult?.productSummary}
                  title="在现有分析基础上，只重新生成本步的标题、五点、描述"
                  className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >{step === 'generating' ? <span className="animate-pulse">正在重新生成…</span> : '重新生成'}</button>
              </div>
            </div>
            {step === 'generating' && (
              <div className="mb-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-sm font-medium text-gray-800 animate-pulse">正在重新生成标题·关键词·五点·描述，请稍候…</p>
              </div>
            )}
            {(() => {
              const allVer = [listingResult, ...genVariants]
              const cur = allVer[genActiveTab] || listingResult
              return (
                <div className="space-y-4">
                  {genVariants.length > 0 && cur.style && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-700">{genActiveTab === 0 ? '原始版本' : cur.style}</span>
                      {cur.styleDescription && genActiveTab > 0 && <span className="ml-1.5">— {cur.styleDescription}</span>}
                    </p>
                  )}
                  <CopyBlock label="标题" text={cur.title} onCopy={copyToClipboard} markdown />
                  <CopyBlock label="后台关键词" text={cur.searchTerms} onCopy={copyToClipboard} />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">五点描述</label>
                    {(cur.bullets || []).map((b, i) => (
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
                  <CopyBlock label="产品描述" text={cur.description} onCopy={copyToClipboard} markdown />
                </div>
              )
            })()}
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
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">交互图</label>
                      <select value={interactionImageCount} onChange={e => setInteractionImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                        {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
                      </select>
                      <p className="text-xs text-gray-400 mt-0.5">真人使用/手持产品的场景</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {(productImagesResult?.mainImage || (productImagesResult?.mainImages?.length || productImagesResult?.sceneImages?.length || productImagesResult?.closeUpImages?.length || productImagesResult?.sellingPointImages?.length || productImagesResult?.interactionImages?.length)) ? (
              <div>
                {(() => {
                  const mainImgs = productImagesResult.mainImages || (productImagesResult.mainImage ? [productImagesResult.mainImage] : [])
                  const sceneImgs = productImagesResult.sceneImages || []
                  const closeUpImgs = productImagesResult.closeUpImages || []
                  const sellingPointImgs = productImagesResult.sellingPointImages || []
                  const sellingPointLbls = productImagesResult.sellingPointLabels || []
                  const interactionImgs = productImagesResult.interactionImages || []
                  const legacyImgs = !productImagesResult.mainImages && !productImagesResult.sceneImages && !productImagesResult.closeUpImages && !productImagesResult.sellingPointImages?.length ? (productImagesResult.additionalImages || []) : []
                  const totalCount = mainImgs.length + sceneImgs.length + closeUpImgs.length + sellingPointImgs.length + interactionImgs.length + legacyImgs.length
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
                        {interactionImgs.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">交互图</h4>
                            <div className="flex flex-wrap gap-3">
                              {interactionImgs.map((src, i) => (
                                <div key={`int-${i}`}>
                                  <img src={src} alt={`交互图${i + 1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />
                                  <p className="text-xs text-gray-500 mt-1">{i + 1}/{interactionImgs.length}</p>
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
                  <span className="block">交互图：真人使用、手持或与产品互动的场景</span>
                  <span className="block mt-1">亚马逊要求主图为实际拍摄，生成图建议作参考或附加图使用。</span>
                </p>
                <p className="text-xs text-gray-400 mb-2">生成后可点击上方「重新生成产品图」换一版再生成（会扣积分）。</p>
                <p className="text-xs text-amber-700 mb-2">预计消耗 {getPointsPerImage(imageModel, '1K 标准') * (mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount + interactionImageCount)} 积分（{mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount + interactionImageCount} 张 × {getPointsPerImage(imageModel, '1K 标准')} 积分/张）</p>
                {productImagesLoading && (
                  <div className="mb-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                    <p className="text-sm font-medium text-gray-800 mb-1">正在生成产品图（共 {mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount + interactionImageCount} 张）…</p>
                    <p className="text-xs text-gray-500 mb-2">请稍候，每张约 20 秒～1 分钟</p>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-600 rounded-full animate-pulse" style={{ width: '50%' }} />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  disabled={productImagesLoading || !productImageDataUrl || (mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount + interactionImageCount === 0)}
                  onClick={handleGenerateProductImages}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {productImagesLoading ? '生成中…' : `生成产品图（${mainImageCount + sceneImageCount + closeUpImageCount + sellingPointImageCount + interactionImageCount} 张）`}
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
            <p className="text-xs text-gray-500 mb-3"><strong>导出 CSV / JSON：</strong>只导出文案，如果需要图片，请到仓库中查找。</p>
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
                        productImageIds: (productImagesResult?.mainImageIds?.length || productImagesResult?.sceneImageIds?.length || productImagesResult?.closeUpImageIds?.length || productImagesResult?.sellingPointImageIds?.length || productImagesResult?.interactionImageIds?.length) ? {
                          mainImageIds: productImagesResult.mainImageIds || [],
                          sceneImageIds: productImagesResult.sceneImageIds || [],
                          closeUpImageIds: productImagesResult.closeUpImageIds || [],
                          sellingPointImageIds: productImagesResult.sellingPointImageIds || [],
                          interactionImageIds: productImagesResult.interactionImageIds || [],
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
                title="按亚马逊通用列头(item_name, bullet_point_1~5, product_description, generic_keyword)"
                onClick={() => {
                  const csv = buildAmazonCsv({ title: listingResult.title, searchTerms: listingResult.searchTerms, bullets: listingResult.bullets || [], description: listingResult.description })
                  downloadCsv(csv, `amazon-listing-${Date.now()}.csv`)
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                导出 CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadJson({ title: listingResult.title, searchTerms: listingResult.searchTerms, bullets: listingResult.bullets || [], description: listingResult.description }, `amazon-listing-${Date.now()}.json`)
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                导出 JSON
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

// ── eBay / 速卖通 通用优化表单 ──────────────────────────────────────────────────
function PlatformOptimizeForm({ platform }) {
  const { getToken } = useAuth()
  const isEbay = platform === 'ebay'
  const titleLimit = isEbay ? 80 : 128
  const attrLabel = isEbay ? 'Item Specifics' : '产品属性'
  const attrField = isEbay ? 'itemSpecifics' : 'productAttributes'
  const platformLabel = isEbay ? 'eBay' : '速卖通'
  const marketsForPlatform = isEbay ? ebayMarkets : aliexpressMarkets
  const langOptions = isEbay
    ? [{ v: 'en', l: 'English' }, { v: 'zh', l: '中文' }, { v: 'de', l: 'Deutsch' }, { v: 'fr', l: 'Français' }, { v: 'ja', l: '日本語' }, { v: 'es', l: 'Español' }]
    : [{ v: 'en', l: 'English' }, { v: 'zh', l: '中文' }, { v: 'ru', l: 'Русский' }, { v: 'pt', l: 'Português' }, { v: 'es', l: 'Español' }, { v: 'fr', l: 'Français' }, { v: 'de', l: 'Deutsch' }, { v: 'ko', l: '한국어' }, { v: 'ja', l: '日本語' }]

  const [title, setTitle] = useState('')
  const [attrs, setAttrs] = useState('')
  const [description, setDescription] = useState('')
  const [market, setMarket] = useState(isEbay ? 'us' : 'global')
  const [lang, setLang] = useState('en')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [diagLang, setDiagLang] = useState('original')
  const [smartPasteText, setSmartPasteText] = useState('')
  const [smartPasteLoading, setSmartPasteLoading] = useState(false)
  const [smartPasteMode, setSmartPasteMode] = useState(false)

  const canSubmit = title.trim() || description.trim()
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text).catch(() => {}) }

  const handleSmartPaste = async () => {
    const token = getToken()
    if (!token) { setError('请先登录'); return }
    if (!smartPasteText.trim() || smartPasteText.trim().length < 20) { setError('粘贴内容太短，请复制完整的 Listing 页面内容'); return }
    setSmartPasteLoading(true); setError('')
    try {
      const res = await fetch('/api/ai-assistant/smart-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: smartPasteText, platform }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '识别失败')
      if (data.title) setTitle(data.title)
      if (data.description) setDescription(data.description)
      const specsArr = isEbay ? data.itemSpecifics : data.productAttributes
      if (Array.isArray(specsArr) && specsArr.length > 0) {
        setAttrs(specsArr.map(s => `${s.name}: ${s.value}`).join('\n'))
      }
      setSmartPasteMode(false)
      setSmartPasteText('')
    } catch (e) { setError(e.message || '智能识别失败') }
    finally { setSmartPasteLoading(false) }
  }

  const copyAll = (opt) => {
    const parts = [`标题：${opt.title || ''}`]
    if (opt[attrField]?.length) parts.push(`\n${attrLabel}：\n${opt[attrField].map(s => `${s.name}: ${s.value}`).join('\n')}`)
    if (opt.description) parts.push(`\n描述：\n${opt.description}`)
    copyToClipboard(parts.join('\n'))
  }

  const handleOptimize = async () => {
    const token = getToken()
    if (!token) { setError('请先登录'); return }
    setLoading(true); setError(''); setResult(null); setDiagLang('original')
    try {
      const body = { title: title.trim(), description: description.trim(), market, lang }
      if (attrs.trim()) {
        const parsed = attrs.trim().split('\n').map(line => {
          const idx = line.indexOf(':')
          if (idx < 0) return null
          return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
        }).filter(Boolean)
        body[attrField] = parsed
      }
      const res = await fetch(`/api/ai-assistant/${platform}/optimize-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '优化失败')
      setResult(data)
    } catch (e) { setError(e.message || '优化失败') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      {/* 方法论卡 */}
      {!result && (
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 space-y-3">
          <h3 className="text-base font-bold text-gray-900">{platformLabel} Listing 深度优化</h3>
          <div className="grid grid-cols-2 gap-3">
            {isEbay ? (<>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">Cassini 搜索引擎</p>
                <p className="text-xs text-gray-500 mt-0.5">标题前 3-4 词权重最高，Item Specifics 决定筛选可见性</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">Item Specifics</p>
                <p className="text-xs text-gray-500 mt-0.5">缺失关键属性 = 在筛选搜索中不可见，必须覆盖 15+ 属性</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">80 字符标题</p>
                <p className="text-xs text-gray-500 mt-0.5">无后台搜索词，所有关键词必须在标题和属性中</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">GPSR 合规</p>
                <p className="text-xs text-gray-500 mt-0.5">EU 市场需 GPSR 合规信息，制造商信息必须填写</p>
              </div>
            </>) : (<>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">标题权重 32.7%</p>
                <p className="text-xs text-gray-500 mt-0.5">速卖通标题占搜索排名第一权重，前 60 字符最关键</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">关键词去重</p>
                <p className="text-xs text-gray-500 mt-0.5">关键词重复会被惩罚 15-40% 排名下降，每词只出现一次</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">产品属性</p>
                <p className="text-xs text-gray-500 mt-0.5">直接影响类目筛选和搜索可见性，需覆盖 15+ 属性</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-800">CE/UKCA 合规</p>
                <p className="text-xs text-gray-500 mt-0.5">EU 需 CE 认证、UK 需 UKCA 认证，缺失可能被下架</p>
              </div>
            </>)}
          </div>
          <p className="text-xs text-gray-500">粘贴现有 Listing → AI 诊断评分 → 输出优化版本 · 支持跨语言转换 · 不扣积分</p>
        </div>
      )}

      {/* 智能粘贴 */}
      {!result && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" onClick={() => setSmartPasteMode(m => !m)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-sm font-medium text-gray-800">智能粘贴</span>
              <span className="text-xs text-gray-400">打开 {platformLabel} 商品页 → 全选复制 → 粘贴到这里 → AI 自动识别填充</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition ${smartPasteMode ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {smartPasteMode && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <textarea value={smartPasteText} onChange={e => setSmartPasteText(e.target.value)} rows={8}
                placeholder={`在 ${platformLabel} 商品页面上按 Ctrl+A 全选 → Ctrl+C 复制 → 粘贴到这里\n\nAI 会自动识别出标题、${attrLabel}、产品描述等字段`}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-50 resize-none"
                disabled={smartPasteLoading} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleSmartPaste}
                  disabled={smartPasteLoading || !smartPasteText.trim()}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${smartPasteText.trim() && !smartPasteLoading ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                  {smartPasteLoading ? '正在识别…' : '智能识别并填充'}
                </button>
                <button type="button" onClick={() => { setSmartPasteMode(false); setSmartPasteText('') }}
                  className="text-xs text-gray-500 hover:text-gray-900">取消</button>
                {smartPasteLoading && <span className="text-xs text-gray-400 animate-pulse">AI 正在从粘贴内容中提取 Listing 字段…</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 输入表单 */}
      {!result && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题 <span className="text-xs text-gray-400">（≤{titleLimit} 字符）</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`粘贴你的 ${platformLabel} 标题`} disabled={loading}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{attrLabel} <span className="text-xs text-gray-400">（每行一个，格式：名称: 值）</span></label>
            <textarea value={attrs} onChange={e => setAttrs(e.target.value)} rows={6}
              placeholder={isEbay ? 'Brand: MyBrand\nMaterial: Stainless Steel\nColor: Black\nType: Water Bottle\n...' : 'Brand: MyBrand\n材质: 不锈钢\n颜色: 黑色\n类型: 保温杯\n...'}
              disabled={loading}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">产品描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} placeholder="粘贴你的产品描述" disabled={loading}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标市场</label>
              <select value={market} onChange={e => setMarket(e.target.value)} disabled={loading}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                {marketsForPlatform.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标语言 <span className="text-xs text-gray-400 font-normal">优化后 Listing 以此语言输出</span></label>
              <select value={lang} onChange={e => setLang(e.target.value)} disabled={loading}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                {langOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          </div>
          <button disabled={!canSubmit || loading} onClick={handleOptimize}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition ${canSubmit && !loading ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            {loading ? '正在优化…' : `开始优化 ${platformLabel} Listing`}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* 结果 */}
      {result && (
        <div className="space-y-6">
          {/* 产品分析 */}
          {result.analysis && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
              <h3 className="text-base font-bold text-gray-900">产品分析</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <p><span className="text-gray-500">品类：</span>{result.analysis.productCategory || '—'}</p>
                <p><span className="text-gray-500">品牌：</span>{result.analysis.brand || '—'}</p>
              </div>
              {result.analysis.topKeywords?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">搜索关键词</p>
                  <div className="flex flex-wrap gap-1">{result.analysis.topKeywords.map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs">{k}</span>)}</div>
                </div>
              )}
              {result.analysis.buyerQuestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">买家常问</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">{result.analysis.buyerQuestions.map((q, i) => <li key={i}>• {q}</li>)}</ul>
                </div>
              )}
              {(result.analysis.missingSpecifics || result.analysis.missingAttributes)?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-600 mb-1">缺失的{attrLabel}</p>
                  <div className="flex flex-wrap gap-1">{(result.analysis.missingSpecifics || result.analysis.missingAttributes).map((s, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs">{s}</span>)}</div>
                </div>
              )}
            </div>
          )}

          {/* 诊断报告 */}
          {result.diagnosis && (() => {
            const diag = diagLang === 'zh' && result.diagnosisZh ? result.diagnosisZh : result.diagnosis
            const hasZh = !!result.diagnosisZh
            const inputLangLabel = result.inputLanguage || '原文'
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-base font-bold text-gray-900">诊断报告</h3>
                  {hasZh && (
                    <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
                      <button onClick={() => setDiagLang('original')} className={`px-2.5 py-1 rounded-md transition ${diagLang !== 'zh' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>{inputLangLabel}</button>
                      <button onClick={() => setDiagLang('zh')} className={`px-2.5 py-1 rounded-md transition ${diagLang === 'zh' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>中文</button>
                    </div>
                  )}
                </div>

                {diag.overallScore != null && <ScoreBadge score={diag.overallScore} />}
                {diag.summary && <p className="text-sm text-gray-700">{diag.summary}</p>}

                {/* 分项 */}
                {Array.isArray(diag.issues) && diag.issues.length > 0 && (
                  <div className="space-y-3">
                    {diag.issues.map((issue, i) => (
                      <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">{issue.area}</span>
                          {issue.score != null && <ScoreBadge score={issue.score} small />}
                        </div>
                        <p className="text-xs text-gray-600">{issue.problem}</p>
                        {issue.suggestion && <p className="text-xs text-green-700">→ {issue.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 合规自检 */}
                {Array.isArray(diag.complianceFlags) && diag.complianceFlags.length > 0 && (() => {
                  const isStructured = typeof diag.complianceFlags[0] === 'object'
                  if (!isStructured) {
                    return (
                      <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                        <p className="text-sm font-medium text-red-700 mb-1.5">合规风险</p>
                        <ul className="space-y-1">
                          {diag.complianceFlags.map((flag, i) => (
                            <li key={i} className="text-xs text-red-600 flex gap-1.5">
                              <span className="shrink-0">⚠</span>
                              <span>{typeof flag === 'string' ? flag : JSON.stringify(flag)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  }
                  const errors = diag.complianceFlags.filter(f => f.level === 'error')
                  const warnings = diag.complianceFlags.filter(f => f.level === 'warning')
                  const infos = diag.complianceFlags.filter(f => f.level === 'info')
                  const groups = [
                    { items: errors, label: '必须修改', border: 'border-red-200', bg: 'bg-red-50/60', badge: 'bg-red-100 text-red-700', text: 'text-red-700', icon: '✕' },
                    { items: warnings, label: '建议修改', border: 'border-yellow-200', bg: 'bg-yellow-50/60', badge: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-700', icon: '⚠' },
                    { items: infos, label: '优化建议', border: 'border-gray-200', bg: 'bg-gray-50/60', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-600', icon: 'ⓘ' },
                  ]
                  return (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-900">合规自检 <span className="text-xs font-normal text-gray-500 ml-1">共 {diag.complianceFlags.length} 项</span></p>
                      {groups.map(({ items, label, border, bg, badge, text, icon }) => items.length > 0 && (
                        <div key={label} className={`rounded-lg border ${border} ${bg} p-3 space-y-2`}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${badge}`}>{icon} {label}</span>
                            <span className="text-xs text-gray-400">{items.length} 项</span>
                          </div>
                          {items.map((f, i) => (
                            <div key={i} className="text-xs space-y-0.5 pl-1">
                              <div className={`font-medium ${text}`}>
                                {f.location && <span className="text-gray-500 font-normal mr-1">[{f.location}]</span>}
                                {f.category && <span className="mr-1">{f.category}：</span>}
                                {f.text}
                              </div>
                              {f.suggestion && <p className="text-gray-500 pl-2">→ {f.suggestion}</p>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* 优化后版本 */}
          {result.optimized && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-gray-900">优化后版本</h3>
                <button type="button" onClick={() => copyAll(result.optimized)} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1">一键复制全部</button>
              </div>
              <CopyBlock label={`标题 (${(result.optimized.title || '').length}/${titleLimit} 字符)`} text={result.optimized.title} onCopy={copyToClipboard} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{attrLabel}</label>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {(result.optimized[attrField] || []).length === 0 ? <p className="text-sm text-gray-500">无</p> : (
                    <div className="space-y-1.5">
                      {(result.optimized[attrField] || []).map((spec, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 shrink-0">{spec.name}:</span>
                          <span className="text-gray-800">{spec.value}</span>
                          <button type="button" onClick={() => copyToClipboard(`${spec.name}: ${spec.value}`)} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">复制</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <CopyBlock label="产品描述" text={result.optimized.description} onCopy={copyToClipboard} markdown />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={handleOptimize} disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
              {loading ? '优化中…' : '重新优化'}
            </button>
            <button onClick={() => { setResult(null); setDiagLang('original') }}
              className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
              修改输入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── eBay / 速卖通 通用生成表单（共用结构，通过 platform 参数区分） ──────────────
function PlatformGenerateForm({ platform }) {
  const { user, getToken } = useAuth()
  const [images, setImages] = useState([])
  const [form, setForm] = useState({
    category1: '', category2: '', brand: '',
    sellingPoint1: '', sellingPoint2: '', sellingPoint3: '', sellingPoint4: '', sellingPoint5: '',
    market: platform === 'aliexpress' ? 'global' : 'us', lang: 'en', keywords: '', notes: '',
  })
  const [step, setStep] = useState('idle')
  const [error, setError] = useState('')
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [listingResult, setListingResult] = useState(null)
  const [productImageDataUrl, setProductImageDataUrl] = useState('')
  const [productImagesResult, setProductImagesResult] = useState(null)
  const [productImagesLoading, setProductImagesLoading] = useState(false)
  const [saveListingLoading, setSaveListingLoading] = useState(false)
  const [savedListingId, setSavedListingId] = useState(null)
  const [imageModel, setImageModel] = useState('Nano Banana')
  const [mainImageCount, setMainImageCount] = useState(1)
  const [sceneImageCount, setSceneImageCount] = useState(1)
  const [closeUpImageCount, setCloseUpImageCount] = useState(1)
  const [sellingPointImageCount, setSellingPointImageCount] = useState(0)
  const [sellingPointShowText, setSellingPointShowText] = useState(false)
  const [interactionImageCount, setInteractionImageCount] = useState(0)

  const apiBase = `/api/ai-assistant/${platform}`
  const isEbay = platform === 'ebay'
  const isAliExpress = platform === 'aliexpress'
  const titleLimit = isEbay ? 80 : 128
  const attrLabel = isEbay ? 'Item Specifics' : '产品属性'
  const attrField = isEbay ? 'itemSpecifics' : 'productAttributes'
  const platformLabel = isEbay ? 'eBay' : '速卖通'
  const marketsForPlatform = isAliExpress ? aliexpressMarkets : isEbay ? ebayMarkets : markets
  const langOptions = isAliExpress
    ? [{ v: 'en', l: 'English' }, { v: 'zh', l: '中文' }, { v: 'ru', l: 'Русский' }, { v: 'pt', l: 'Português' }, { v: 'es', l: 'Español' }, { v: 'fr', l: 'Français' }, { v: 'de', l: 'Deutsch' }, { v: 'ko', l: '한국어' }, { v: 'ja', l: '日本語' }]
    : [{ v: 'en', l: 'English' }, { v: 'zh', l: '中文' }, { v: 'de', l: 'Deutsch' }, { v: 'fr', l: 'Français' }, { v: 'ja', l: '日本語' }, { v: 'es', l: 'Español' }]

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const categoryTree = isEbay ? EBAY_CATEGORY_TREE : isAliExpress ? ALIEXPRESS_CATEGORY_TREE : CATEGORY_TREE
  const category1 = categoryTree.find(c => c.id === form.category1)
  const secondOptions = category1?.children || []
  const sellingPointsLines = [form.sellingPoint1, form.sellingPoint2, form.sellingPoint3, form.sellingPoint4, form.sellingPoint5]
    .map(s => (s || '').trim()).filter(Boolean)
  const canSubmit = images.length >= 1 && form.category1 && form.category2 && form.brand.trim() && sellingPointsLines.length >= 2 && form.market && form.lang

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    setImages(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 5))
  }
  const removeImage = (i) => setImages(prev => prev.filter((_, j) => j !== i))
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text).catch(() => {}) }

  const doAnalyze = async (dataUrl) => {
    const res = await fetch(`${apiBase}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ images: [dataUrl], category1: category1?.name, category2: form.category2, brand: form.brand.trim(), sellingPoints: sellingPointsLines, market: form.market, lang: form.lang, keywords: form.keywords.trim() || undefined, notes: form.notes.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '分析失败')
    return data
  }

  const doGenerate = async () => {
    const res = await fetch(`${apiBase}/generate-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ analyzeResult, category1: category1?.name, category2: form.category2, brand: form.brand.trim(), sellingPoints: sellingPointsLines, market: form.market, lang: form.lang, keywords: form.keywords.trim() || undefined, notes: form.notes.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '生成失败')
    return data
  }

  const handleSubmit = async () => {
    if (!user || !getToken()) { setError('请先登录后再使用'); return }
    setError(''); setStep('analyzing')
    try {
      const dataUrl = await fileToCompressedDataUrl(images[0].file)
      setProductImageDataUrl(dataUrl)
      const data = await doAnalyze(dataUrl)
      setAnalyzeResult(data); setListingResult(null); setProductImagesResult(null); setStep('analysis_done')
    } catch (e) { setError(e.message || '请求失败'); setStep('error') }
  }

  const handleConfirmAndGenerate = async () => {
    if (!analyzeResult?.productSummary || !getToken()) return
    setError(''); setStep('generating')
    try { const data = await doGenerate(); setListingResult(data); setStep('done') }
    catch (e) { setError(e.message || '生成失败'); setStep('error') }
  }

  const handleRegenerateAnalyze = async () => {
    if (!productImageDataUrl || !getToken()) return
    setError(''); setStep('analyzing')
    try { const data = await doAnalyze(productImageDataUrl); setAnalyzeResult(data); setListingResult(null); setProductImagesResult(null); setStep('analysis_done') }
    catch (e) { setError(e.message || '分析失败'); setStep('error') }
  }

  const handleRegenerateListing = async () => {
    if (!analyzeResult?.productSummary || !getToken()) return
    setError(''); setStep('generating')
    try { const data = await doGenerate(); setListingResult(data); setStep('done') }
    catch (e) { setError(e.message || '生成失败'); setStep('error') }
  }

  const handleGenerateProductImages = async () => {
    if (!productImageDataUrl || !analyzeResult?.productName || !getToken()) return
    setError(''); setProductImagesLoading(true)
    try {
      const res = await fetch(`${apiBase}/generate-product-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ productImage: productImageDataUrl, productName: analyzeResult.productName, brand: form.brand.trim(), model: imageModel, mainCount: mainImageCount, sceneCount: sceneImageCount, closeUpCount: closeUpImageCount, sellingPoints: sellingPointsLines, sellingPointCount: sellingPointImageCount, sellingPointShowText, interactionCount: interactionImageCount, lang: form.lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setProductImagesResult({ mainImage: data.mainImage, mainImages: data.mainImages || [], sceneImages: data.sceneImages || [], closeUpImages: data.closeUpImages || [], sellingPointImages: data.sellingPointImages || [], sellingPointLabels: data.sellingPointLabels || [], interactionImages: data.interactionImages || [], mainImageIds: data.mainImageIds || [], sceneImageIds: data.sceneImageIds || [], closeUpImageIds: data.closeUpImageIds || [], sellingPointImageIds: data.sellingPointImageIds || [], interactionImageIds: data.interactionImageIds || [], mainImageId: data.mainImageId || null })
    } catch (e) { setError(e.message || '生成失败') }
    finally { setProductImagesLoading(false) }
  }

  const hasImages = productImagesResult?.mainImage || productImagesResult?.mainImages?.length || productImagesResult?.sceneImages?.length || productImagesResult?.closeUpImages?.length || productImagesResult?.sellingPointImages?.length || productImagesResult?.interactionImages?.length

  const platformSteps = [
    { id: 1, label: '分析' },
    { id: 2, label: `标题·${attrLabel}·描述` },
    { id: 3, label: '产品图' },
  ]

  return (
    <div className="space-y-6">
      {/* 步骤进度条 */}
      {(step !== 'idle' || listingResult) && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            {platformSteps.map((s, i) => {
              const done = (s.id === 1 && step !== 'idle' && step !== 'analyzing' && step !== 'error') || (s.id === 2 && (step === 'done' || !!listingResult)) || (s.id === 3 && !!hasImages)
              const active = (s.id === 1 && step === 'analyzing') || (s.id === 2 && step === 'generating') || (s.id === 3 && productImagesLoading)
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-medium ${active ? 'bg-gray-800 text-white animate-pulse' : done ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{s.id}</span>
                  <span className={`text-sm ${active ? 'font-medium text-gray-900' : done ? 'text-gray-700' : 'text-gray-500'}`}>{s.label}</span>
                  {i < platformSteps.length - 1 && <span className="mx-1 h-px w-4 bg-gray-300" aria-hidden />}
                </div>
              )
            })}
          </div>
          {step === 'analyzing' && <p className="text-xs text-gray-500 mt-2 animate-pulse">正在分析产品，请稍候…</p>}
          {step === 'generating' && <p className="text-xs text-gray-500 mt-2 animate-pulse">正在生成标题·{attrLabel}·描述…</p>}
        </div>
      )}

      {(step === 'analysis_done' || (step === 'generating' && !listingResult)) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">1. 分析结果（请确认后再生成标题·{attrLabel}·描述）</h3>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-medium text-gray-500">产品名称</p>
            <p className="text-sm text-gray-900">{analyzeResult?.productName || '—'}</p>
            <p className="text-xs font-medium text-gray-500 mt-3">产品摘要</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{analyzeResult?.productSummary || '—'}</p>
          </div>
          {/* 产品洞察 */}
          {(analyzeResult?.topKeywords?.length > 0 || analyzeResult?.buyerQuestions?.length > 0 || analyzeResult?.buyerPersonas?.length > 0 || analyzeResult?.keyAttributes?.length > 0) && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-3">
              <p className="text-xs font-bold text-gray-800">产品洞察（以下数据将驱动 Listing 生成）</p>
              {analyzeResult.topKeywords?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">搜索关键词 · {isEbay ? 'Cassini' : '速卖通搜索'}</p>
                  <div className="flex flex-wrap gap-1">{analyzeResult.topKeywords.map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-100">{k}</span>)}</div>
                </div>
              )}
              {analyzeResult.buyerQuestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">买家常见问题</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">{analyzeResult.buyerQuestions.map((q, i) => <li key={i}>• {q}</li>)}</ul>
                </div>
              )}
              {analyzeResult.buyerPersonas?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">买家画像</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">{analyzeResult.buyerPersonas.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                </div>
              )}
              {analyzeResult.keyAttributes?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">关键规格</p>
                  <div className="flex flex-wrap gap-1">{analyzeResult.keyAttributes.map((a, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">{a}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleConfirmAndGenerate} disabled={step === 'generating'} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">{step === 'generating' ? `正在生成标题·${attrLabel}·描述…` : '确认分析结果'}</button>
            <button type="button" onClick={() => { setStep('idle'); setAnalyzeResult(null); setError('') }} disabled={step === 'generating'} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">重新分析</button>
          </div>
        </div>
      )}

      {listingResult && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-900">1. 分析</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleRegenerateAnalyze} disabled={step === 'analyzing' || !productImageDataUrl} className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50">重新分析</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={() => { setListingResult(null); setStep('idle'); setAnalyzeResult(null); setProductImageDataUrl(''); setProductImagesResult(null); setSavedListingId(null) }} className="text-xs text-gray-500 hover:text-gray-900">清空全部</button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">已分析：{analyzeResult?.productName || '产品'}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">2. 标题·{attrLabel}·描述</h3>
              <button type="button" onClick={handleRegenerateListing} disabled={step === 'generating' || !analyzeResult?.productSummary} className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50">{step === 'generating' ? <span className="animate-pulse">正在重新生成…</span> : '重新生成'}</button>
            </div>
            {step === 'generating' && (
              <div className="mb-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                <p className="text-sm font-medium text-gray-800 animate-pulse">正在重新生成标题·{attrLabel}·描述，请稍候…</p>
              </div>
            )}
            <div className="space-y-4">
              <CopyBlock label={`标题 (${(listingResult.title || '').length}/${titleLimit} 字符)`} text={listingResult.title} onCopy={copyToClipboard} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{attrLabel}</label>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {(listingResult[attrField] || []).length === 0 ? <p className="text-sm text-gray-500">无</p> : (
                    <div className="space-y-1.5">
                      {(listingResult[attrField] || []).map((spec, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 shrink-0">{spec.name}:</span>
                          <span className="text-gray-800">{spec.value}</span>
                          <button type="button" onClick={() => copyToClipboard(`${spec.name}: ${spec.value}`)} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">复制</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <CopyBlock label="产品描述" text={listingResult.description} onCopy={copyToClipboard} markdown />
            </div>
          </div>

          {/* Step 3 产品图 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">3. 产品图</h3>
              {hasImages && <button type="button" onClick={() => setProductImagesResult(null)} className="text-xs text-gray-500 hover:text-gray-900">重新生成产品图</button>}
            </div>
            {!hasImages && (
              <div className="mb-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">生图模型</label>
                  <select value={imageModel} onChange={e => setImageModel(e.target.value)} className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    {IMAGE_MODEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div><label className="block text-xs text-gray-500 mb-1">白底主图</label><select value={mainImageCount} onChange={e => setMainImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">{[1,2,3,4].map(n=><option key={n} value={n}>{n} 张</option>)}</select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">场景图</label><select value={sceneImageCount} onChange={e => setSceneImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">{[0,1,2,3,4].map(n=><option key={n} value={n}>{n} 张</option>)}</select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">特写图</label><select value={closeUpImageCount} onChange={e => setCloseUpImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">{[0,1,2,3,4].map(n=><option key={n} value={n}>{n} 张</option>)}</select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">卖点图</label><select value={Math.min(sellingPointImageCount, sellingPointsLines.length)} onChange={e => setSellingPointImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">{Array.from({length: sellingPointsLines.length+1},(_,n)=><option key={n} value={n}>{n} 张</option>)}</select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">交互图</label><select value={interactionImageCount} onChange={e => setInteractionImageCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">{[0,1,2,3,4].map(n=><option key={n} value={n}>{n} 张</option>)}</select></div>
                </div>
                {sellingPointImageCount > 0 && (
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={sellingPointShowText} onChange={e => setSellingPointShowText(e.target.checked)} className="rounded border-gray-300" />卖点图上显示文字</label>
                )}
                <p className="text-xs text-amber-700">预计消耗 {getPointsPerImage(imageModel, '1K 标准') * (mainImageCount + sceneImageCount + closeUpImageCount + Math.min(sellingPointImageCount, sellingPointsLines.length) + interactionImageCount)} 积分（{mainImageCount + sceneImageCount + closeUpImageCount + Math.min(sellingPointImageCount, sellingPointsLines.length) + interactionImageCount} 张 × {getPointsPerImage(imageModel, '1K 标准')} 积分/张）</p>
                {productImagesLoading && (
                  <div className="my-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                    <p className="text-sm font-medium text-gray-800 mb-1">正在生成产品图（共 {mainImageCount + sceneImageCount + closeUpImageCount + Math.min(sellingPointImageCount, sellingPointsLines.length) + interactionImageCount} 张）…</p>
                    <p className="text-xs text-gray-500 mb-2">请稍候，每张约 20 秒～1 分钟</p>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-600 rounded-full animate-pulse" style={{ width: '50%' }} />
                    </div>
                  </div>
                )}
                <button type="button" onClick={handleGenerateProductImages} disabled={productImagesLoading || !productImageDataUrl || !analyzeResult?.productName} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-600 disabled:opacity-50">{productImagesLoading ? '生成中…' : `生成产品图（${mainImageCount + sceneImageCount + closeUpImageCount + Math.min(sellingPointImageCount, sellingPointsLines.length) + interactionImageCount} 张）`}</button>
              </div>
            )}
            {hasImages && (
              <div className="space-y-4">
                {productImagesResult.mainImages?.length > 0 && <div><h4 className="text-xs font-semibold text-gray-700 mb-2">白底主图</h4><div className="flex flex-wrap gap-3">{productImagesResult.mainImages.map((src,i) => <img key={i} src={src} alt={`主图${i+1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />)}</div></div>}
                {productImagesResult.sceneImages?.length > 0 && <div><h4 className="text-xs font-semibold text-gray-700 mb-2">场景图</h4><div className="flex flex-wrap gap-3">{productImagesResult.sceneImages.map((src,i) => <img key={i} src={src} alt={`场景${i+1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />)}</div></div>}
                {productImagesResult.closeUpImages?.length > 0 && <div><h4 className="text-xs font-semibold text-gray-700 mb-2">特写图</h4><div className="flex flex-wrap gap-3">{productImagesResult.closeUpImages.map((src,i) => <img key={i} src={src} alt={`特写${i+1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />)}</div></div>}
                {productImagesResult.sellingPointImages?.length > 0 && <div><h4 className="text-xs font-semibold text-gray-700 mb-2">卖点图</h4><div className="flex flex-wrap gap-3">{productImagesResult.sellingPointImages.map((src,i) => <div key={i}><img src={src} alt="" className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />{productImagesResult.sellingPointLabels?.[i] && <p className="text-xs text-gray-500 mt-1 truncate max-w-[160px]">{productImagesResult.sellingPointLabels[i]}</p>}</div>)}</div></div>}
                {productImagesResult.interactionImages?.length > 0 && <div><h4 className="text-xs font-semibold text-gray-700 mb-2">交互图</h4><div className="flex flex-wrap gap-3">{productImagesResult.interactionImages.map((src,i) => <img key={i} src={src} alt={`交互图${i+1}`} className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white" />)}</div></div>}
                <p className="text-xs text-gray-500">产品图已保存到仓库</p>
              </div>
            )}
          </div>

          {/* 保存 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 mb-3">保存到 Listing 历史，可在「Listing 历史」中查看。</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={saveListingLoading} onClick={async () => {
                if (!getToken()) return; setSaveListingLoading(true)
                try {
                  const body = { name: analyzeResult?.productName ? `${analyzeResult.productName} ${platformLabel}` : '', title: listingResult.title, description: listingResult.description, analyzeResult: analyzeResult || undefined, mainImageId: productImagesResult?.mainImageId || undefined, productImageIds: (productImagesResult?.mainImageIds?.length || productImagesResult?.sceneImageIds?.length || productImagesResult?.closeUpImageIds?.length || productImagesResult?.sellingPointImageIds?.length || productImagesResult?.interactionImageIds?.length) ? { mainImageIds: productImagesResult.mainImageIds || [], sceneImageIds: productImagesResult.sceneImageIds || [], closeUpImageIds: productImagesResult.closeUpImageIds || [], sellingPointImageIds: productImagesResult.sellingPointImageIds || [], interactionImageIds: productImagesResult.interactionImageIds || [] } : undefined }
                  if (isEbay) body.itemSpecifics = listingResult.itemSpecifics || []
                  else body.productAttributes = listingResult.productAttributes || []
                  const res = await fetch(`${apiBase}/save-listing`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) })
                  const data = await res.json(); if (!res.ok) throw new Error(data.error || '保存失败'); setSavedListingId(data.id)
                } catch (e) { setError(e.message || '保存失败') } finally { setSaveListingLoading(false) }
              }} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50">
                {saveListingLoading ? '保存中…' : savedListingId ? '已保存' : '保存到我的 Listing'}
              </button>
              {savedListingId && <Link to={`/dashboard/listings?platform=${platform}`} className="text-xs text-gray-500 hover:text-gray-900">查看历史 →</Link>}
              <button type="button" onClick={() => {
                let csv
                if (isEbay) csv = buildEbayCsv({ title: listingResult.title, description: listingResult.description, itemSpecifics: listingResult.itemSpecifics || [] })
                else csv = buildAliExpressCsv({ title: listingResult.title, description: listingResult.description, productAttributes: listingResult.productAttributes || [] })
                downloadCsv(csv, `${platform}-listing-${Date.now()}.csv`)
              }} className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">导出 CSV</button>
              <button type="button" onClick={() => {
                const obj = { title: listingResult.title, description: listingResult.description }
                obj[attrField] = listingResult[attrField] || []
                downloadJson(obj, `${platform}-listing-${Date.now()}.json`)
              }} className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">导出 JSON</button>
            </div>
          </div>
        </div>
      )}

      {(step === 'idle' || step === 'error' || step === 'analyzing') && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">产品图片 <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/60 text-white text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-2xl cursor-pointer hover:bg-gray-50">
                  <input type="file" accept="image/*" className="hidden" multiple onChange={handleImageChange} /> +
                </label>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">一级类目 <span className="text-red-500">*</span></label><select value={form.category1} onChange={e => { set('category1', e.target.value); set('category2', '') }} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"><option value="">请选择</option>{categoryTree.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">二级类目 <span className="text-red-500">*</span></label><select value={form.category2} onChange={e => set('category2', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" disabled={!form.category1}><option value="">请选择</option>{secondOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">品牌名 <span className="text-red-500">*</span></label><input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder={isEbay ? '无品牌填 Unbranded' : isAliExpress ? '无品牌填 无品牌 或 NONE' : '无品牌可填 Generic'} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">核心卖点 <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">至少 2 条</span></label>
            <div className="space-y-2 mt-1">{[1,2,3,4,5].map(i => <input key={i} value={form[`sellingPoint${i}`]} onChange={e => set(`sellingPoint${i}`, e.target.value)} placeholder={`第 ${i} 条卖点`} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">参考关键词 <span className="text-gray-400">可选</span></label>
            <input value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder={isEbay ? '会直接融入 80 字符标题和 Item Specifics' : isAliExpress ? '会融入 128 字符标题，前 60 字符权重最高' : '多个关键词用逗号或空格分隔'} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
            {isEbay && <p className="text-xs text-gray-400 mt-1">eBay 无后台搜索词，关键词需直接体现在标题中</p>}
            {isAliExpress && <p className="text-xs text-gray-400 mt-1">速卖通无后台搜索词，关键词需体现在标题和产品属性中</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">特殊认证/备注 <span className="text-gray-400">可选</span></label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={isEbay ? 'CE、GPSR、FCC 等（卖欧洲需 CE + GPSR 合规）' : isAliExpress ? 'CE、UKCA、CPC、UL 等（欧洲需 CE，英国需 UKCA）' : 'CE、FCC、BPA-free 等'} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
            {isEbay && <p className="text-xs text-gray-400 mt-1">认证会写入 Item Specifics 和描述中</p>}
            {isAliExpress && <p className="text-xs text-gray-400 mt-1">认证写入产品属性和描述；实际证书需在卖家后台另行上传</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">目标市场 <span className="text-red-500">*</span></label><select value={form.market} onChange={e => set('market', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">{marketsForPlatform.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">输出语言 <span className="text-red-500">*</span></label><select value={form.lang} onChange={e => set('lang', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">{langOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="pt-2">
            <button disabled={!canSubmit || step === 'analyzing' || step === 'generating'} className={`w-full py-3 rounded-xl text-sm font-semibold transition ${canSubmit && step !== 'analyzing' && step !== 'generating' ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} onClick={handleSubmit}>{step === 'analyzing' ? '正在分析产品…' : '分析产品'}</button>
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

function ScoreBadge({ score }) {
  const color = score >= 8 ? 'bg-green-100 text-green-700' : score >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{score}/10</span>
}

function OptimizeForm() {
  const { getToken } = useAuth()
  const [form, setForm] = useState(initOptimize)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSubmit = form.title.trim() && form.bullets.trim()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [diagLang, setDiagLang] = useState('original')
  const [variants, setVariants] = useState([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [smartPasteText, setSmartPasteText] = useState('')
  const [smartPasteLoading, setSmartPasteLoading] = useState(false)
  const [smartPasteMode, setSmartPasteMode] = useState(false)

  const handleSmartPaste = async () => {
    const token = getToken()
    if (!token) { setError('请先登录'); return }
    if (!smartPasteText.trim() || smartPasteText.trim().length < 20) { setError('粘贴内容太短，请复制完整的 Listing 页面内容'); return }
    setSmartPasteLoading(true); setError('')
    try {
      const res = await fetch('/api/ai-assistant/smart-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: smartPasteText, platform: 'amazon' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '识别失败')
      setForm(f => ({
        ...f,
        title: data.title || f.title,
        bullets: data.bullets?.length ? data.bullets.join('\n') : f.bullets,
        description: data.description || f.description,
        searchTerms: f.searchTerms,
      }))
      setSmartPasteMode(false)
      setSmartPasteText('')
    } catch (e) { setError(e.message || '智能识别失败') }
    finally { setSmartPasteLoading(false) }
  }

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text).catch(() => {}) }

  const handleGenerateVariants = async () => {
    const token = getToken()
    if (!token || !result?.optimized) return
    setVariantsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai-assistant/amazon/generate-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentListing: result.optimized,
          analysis: result.analysis || null,
          market: form.market,
          lang: form.lang,
          variantCount: 2,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '变体生成失败')
      setVariants(data.variants || [])
      setActiveTab(0)
    } catch (e) {
      setError(e.message || '变体生成失败')
    } finally {
      setVariantsLoading(false)
    }
  }

  const handleOptimize = async () => {
    const token = getToken()
    if (!token) { setError('请先登录'); return }
    setLoading(true)
    setError('')
    setResult(null)
    setDiagLang('original')
    setVariants([])
    setActiveTab(0)
    try {
      const res = await fetch('/api/ai-assistant/amazon/optimize-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          bullets: form.bullets,
          description: form.description,
          searchTerms: form.searchTerms || '',
          market: form.market,
          lang: form.lang,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '优化失败')
      setResult(data)
    } catch (e) {
      setError(e.message || '优化失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const copyAllOptimized = () => {
    if (!result?.optimized) return
    const o = result.optimized
    const lines = [
      `标题：\n${o.title}`,
      `\n五点描述：\n${(o.bullets || []).map((b, i) => `${i + 1}. ${b}`).join('\n')}`,
      o.description ? `\n产品描述：\n${o.description}` : '',
      o.searchTerms ? `\n后台关键词：\n${o.searchTerms}` : '',
    ].filter(Boolean).join('\n')
    copyToClipboard(lines)
  }

  return (
    <div className="space-y-5">
      {/* 方法论说明 */}
      {!result && (
        <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">四大算法驱动的深度优化</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">A9</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">传统搜索优化</p>
                <p className="text-xs text-gray-500">提取高频搜索词，前置核心关键词，优化搜索排名</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0 leading-none">Co</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">语义搜索适配</p>
                <p className="text-xs text-gray-500">场景化自然语言，匹配买家意图，提升语义相关性</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0 leading-none">Ru</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">AI 助手问答优化</p>
                <p className="text-xs text-gray-500">预判买家问题，用具体参数回答，被 Rufus 优先推荐</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0 leading-none">GE</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">结构化内容强化</p>
                <p className="text-xs text-gray-500">精确规格数据、市场适配单位，提升 AI 引擎可读性</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">粘贴现有 Listing → AI 先分析产品关键词、买家画像与规格 → 逐项诊断评分 → 输出优化版本 · 支持跨语言转换 · 不扣积分</p>
        </div>
      )}

      {/* 智能粘贴 */}
      {!result && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" onClick={() => setSmartPasteMode(m => !m)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-sm font-medium text-gray-800">智能粘贴</span>
              <span className="text-xs text-gray-400">打开 Listing 页面 → 全选复制 → 粘贴到这里 → AI 自动识别填充</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition ${smartPasteMode ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {smartPasteMode && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <textarea value={smartPasteText} onChange={e => setSmartPasteText(e.target.value)} rows={8}
                placeholder="在亚马逊商品页面上按 Ctrl+A 全选 → Ctrl+C 复制 → 粘贴到这里&#10;&#10;AI 会自动识别出标题、五点描述、产品描述等字段"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-50 resize-none"
                disabled={smartPasteLoading} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleSmartPaste}
                  disabled={smartPasteLoading || !smartPasteText.trim()}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${smartPasteText.trim() && !smartPasteLoading ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                  {smartPasteLoading ? '正在识别…' : '智能识别并填充'}
                </button>
                <button type="button" onClick={() => { setSmartPasteMode(false); setSmartPasteText('') }}
                  className="text-xs text-gray-500 hover:text-gray-900">取消</button>
                {smartPasteLoading && <span className="text-xs text-gray-400 animate-pulse">AI 正在从粘贴内容中提取 Listing 字段…</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 输入区 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          现有标题 <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="粘贴你现有的 Listing 标题"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
          disabled={loading}
        />
      </div>

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
          disabled={loading}
        />
      </div>

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
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          后台关键词（Search Terms）
          <span className="text-gray-400 font-normal text-xs ml-1">可选</span>
        </label>
        <input
          value={form.searchTerms || ''}
          onChange={e => set('searchTerms', e.target.value)}
          placeholder="粘贴你现有的后台关键词（可选）"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标市场</label>
          <select
            value={form.market}
            onChange={e => set('market', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            disabled={loading}
          >
            {markets.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标语言</label>
          <select
            value={form.lang}
            onChange={e => set('lang', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            disabled={loading}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="ja">日本語</option>
            <option value="es">Español</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">优化后的 Listing 将以此语言输出，支持跨语言转换</p>
        </div>
      </div>

      {/* 优化按钮 */}
      <div className="pt-2">
        <button
          disabled={!canSubmit || loading}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
            canSubmit && !loading
              ? 'bg-gray-900 text-white hover:bg-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          onClick={handleOptimize}
        >
          {loading ? '正在分析并优化…' : '诊断并优化 Listing'}
        </button>
        {!canSubmit && !loading && (
          <p className="text-xs text-gray-400 mt-2 text-center">请填写标题和五点描述</p>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {/* ── 结果区 ── */}
      {result && (
        <div className="mt-8 space-y-8">
          {/* 产品洞察 */}
          {result.analysis && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 space-y-4">
              <h3 className="text-base font-bold text-gray-900">产品洞察</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs font-medium text-gray-500">品类</span>
                  <p className="text-gray-800">{result.analysis.productCategory || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">品牌</span>
                  <p className="text-gray-800">{result.analysis.brand || '—'}</p>
                </div>
              </div>
              {Array.isArray(result.analysis.topKeywords) && result.analysis.topKeywords.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">高频搜索词（优化依据）</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analysis.topKeywords.map((kw, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(result.analysis.buyerQuestions) && result.analysis.buyerQuestions.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">买家常见问题（Rufus 优化依据）</span>
                  <ul className="space-y-1">
                    {result.analysis.buyerQuestions.map((q, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                        <span className="text-blue-400 shrink-0">Q{i + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(result.analysis.buyerPersonas) && result.analysis.buyerPersonas.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">目标买家画像（Cosmo 优化依据）</span>
                  <ul className="space-y-1">
                    {result.analysis.buyerPersonas.map((p, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                        <span className="text-blue-400 shrink-0">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(result.analysis.keySpecs) && result.analysis.keySpecs.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">关键规格（GEO 优化依据）</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analysis.keySpecs.map((s, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 诊断报告 */}
          {result.diagnosis && (() => {
            const diag = diagLang === 'zh' && result.diagnosisZh ? result.diagnosisZh : result.diagnosis
            const hasZh = !!result.diagnosisZh
            const inputLangLabel = result.inputLanguage || '原文'
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-gray-900">诊断报告</h3>
                    {hasZh && (
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setDiagLang('original')}
                          className={`px-2.5 py-1 transition ${diagLang === 'original' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          {inputLangLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiagLang('zh')}
                          className={`px-2.5 py-1 transition ${diagLang === 'zh' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          中文
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">综合评分</span>
                    {diag.overallScore != null && <ScoreBadge score={diag.overallScore} />}
                  </div>
                </div>
                {diag.summary && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{diag.summary}</p>
                )}

                {/* 各项评分 */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '标题', score: diag.titleScore, issues: diag.titleIssues },
                    { label: '五点描述', score: diag.bulletsScore, issues: diag.bulletsIssues },
                    { label: '产品描述', score: diag.descriptionScore, issues: diag.descriptionIssues },
                    { label: '后台关键词', score: diag.searchTermsScore, issues: diag.searchTermsIssues },
                  ].map(({ label, score, issues }) => (
                    <div key={label} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        {score != null && <ScoreBadge score={score} />}
                      </div>
                      {Array.isArray(issues) && issues.length > 0 && (
                        <ul className="space-y-1">
                          {issues.map((issue, i) => (
                            <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                              <span className="text-red-400 shrink-0">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* 合规自检 */}
                {Array.isArray(diag.complianceFlags) && diag.complianceFlags.length > 0 && (() => {
                  const isStructured = typeof diag.complianceFlags[0] === 'object'
                  if (!isStructured) {
                    return (
                      <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                        <p className="text-sm font-medium text-red-700 mb-1.5">合规风险</p>
                        <ul className="space-y-1">
                          {diag.complianceFlags.map((flag, i) => (
                            <li key={i} className="text-xs text-red-600 flex gap-1.5">
                              <span className="shrink-0">⚠</span>
                              <span>{typeof flag === 'string' ? flag : JSON.stringify(flag)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  }
                  const errors = diag.complianceFlags.filter(f => f.level === 'error')
                  const warnings = diag.complianceFlags.filter(f => f.level === 'warning')
                  const infos = diag.complianceFlags.filter(f => f.level === 'info')
                  const groups = [
                    { items: errors, label: '必须修改', border: 'border-red-200', bg: 'bg-red-50/60', badge: 'bg-red-100 text-red-700', text: 'text-red-700', icon: '✕' },
                    { items: warnings, label: '建议修改', border: 'border-yellow-200', bg: 'bg-yellow-50/60', badge: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-700', icon: '⚠' },
                    { items: infos, label: '优化建议', border: 'border-gray-200', bg: 'bg-gray-50/60', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-600', icon: 'ⓘ' },
                  ]
                  return (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-900">合规自检 <span className="text-xs font-normal text-gray-500 ml-1">共 {diag.complianceFlags.length} 项</span></p>
                      {groups.map(({ items, label, border, bg, badge, text, icon }) => items.length > 0 && (
                        <div key={label} className={`rounded-lg border ${border} ${bg} p-3 space-y-2`}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${badge}`}>{icon} {label}</span>
                            <span className="text-xs text-gray-400">{items.length} 项</span>
                          </div>
                          {items.map((f, i) => (
                            <div key={i} className="text-xs space-y-0.5 pl-1">
                              <div className={`font-medium ${text}`}>
                                {f.location && <span className="text-gray-500 font-normal mr-1">[{f.location}]</span>}
                                {f.category && <span className="mr-1">{f.category}：</span>}
                                {f.text}
                              </div>
                              {f.suggestion && <p className="text-gray-500 pl-2">→ {f.suggestion}</p>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* 优化后版本 + A/B 变体 */}
          {result.optimized && (() => {
            const allVersions = [
              { ...result.optimized, style: '优化版本', styleDescription: '基于诊断结果的深度优化' },
              ...variants,
            ]
            const current = allVersions[activeTab] || allVersions[0]
            const copyAll = (v) => {
              const lines = [
                `标题：\n${v.title}`,
                `\n五点描述：\n${(v.bullets || []).map((b, i) => `${i + 1}. ${b}`).join('\n')}`,
                v.description ? `\n产品描述：\n${v.description}` : '',
                v.searchTerms ? `\n后台关键词：\n${v.searchTerms}` : '',
              ].filter(Boolean).join('\n')
              copyToClipboard(lines)
            }
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-gray-900">{variants.length > 0 ? '文案版本' : '优化后版本'}</h3>
                    {variants.length > 0 && (
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                        {allVersions.map((v, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveTab(i)}
                            className={`px-2.5 py-1 transition whitespace-nowrap ${activeTab === i ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          >
                            {i === 0 ? '优化版' : `变体 ${String.fromCharCode(65 + i)}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => copyAll(current)} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1">一键复制全部</button>
                </div>

                {current.style && variants.length > 0 && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700">{current.style}</span>
                    {current.styleDescription && <span className="ml-1.5">— {current.styleDescription}</span>}
                  </p>
                )}

                <CopyBlock label={`标题 (${(current.title || '').length}/200 字符)`} text={current.title} onCopy={copyToClipboard} />

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">五点描述</label>
                  <ol className="space-y-2">
                    {(current.bullets || []).map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                        <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 mt-0.5">{i + 1}</span>
                        <p className="flex-1 whitespace-pre-wrap break-words">{b}</p>
                        <button type="button" onClick={() => copyToClipboard(b)} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">复制</button>
                      </li>
                    ))}
                  </ol>
                </div>

                <CopyBlock label="产品描述" text={current.description} onCopy={copyToClipboard} markdown />
                <CopyBlock label="后台关键词" text={current.searchTerms} onCopy={copyToClipboard} />
              </div>
            )
          })()}

          {/* A/B 变体按钮 + 重新优化 */}
          <div className="flex items-center justify-center gap-4">
            {result.optimized && (
              <button
                type="button"
                onClick={handleGenerateVariants}
                disabled={variantsLoading || loading}
                className={`text-sm px-4 py-2 rounded-xl font-medium transition ${
                  variantsLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {variantsLoading ? '正在生成变体…' : variants.length > 0 ? '重新生成变体' : '生成 A/B 变体'}
              </button>
            )}
            <button
              type="button"
              onClick={handleOptimize}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-gray-900 underline"
            >
              {loading ? '优化中…' : '重新优化'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 竞品对比表单 ──────────────────────────────────────────────────────────────
function CompetitorForm() {
  const { getToken } = useAuth()
  const [myListing, setMyListing] = useState({ title: '', bullets: '', description: '' })
  const [competitors, setCompetitors] = useState([{ title: '', bullets: '', description: '' }])
  const [activeCompTab, setActiveCompTab] = useState(0)
  const [market, setMarket] = useState('us')
  const [lang, setLang] = useState('zh')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [smartPasteTarget, setSmartPasteTarget] = useState(null)
  const [smartPasteText, setSmartPasteText] = useState('')
  const [smartPasteLoading, setSmartPasteLoading] = useState(false)

  const canSubmit = myListing.title.trim() && competitors[0]?.title?.trim()

  const handleSmartPaste = async () => {
    const token = getToken()
    if (!token || !smartPasteText.trim() || smartPasteText.trim().length < 20) return
    setSmartPasteLoading(true); setError('')
    try {
      const res = await fetch('/api/ai-assistant/smart-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: smartPasteText, platform: 'amazon' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '识别失败')
      const filled = {
        title: data.title || '',
        bullets: data.bullets?.length ? data.bullets.join('\n') : '',
        description: data.description || '',
      }
      if (smartPasteTarget === 'my') {
        setMyListing(p => ({ ...p, ...filled }))
      } else if (typeof smartPasteTarget === 'number') {
        setCompetitors(prev => prev.map((c, i) => i === smartPasteTarget ? { ...c, ...filled } : c))
      }
      setSmartPasteTarget(null); setSmartPasteText('')
    } catch (e) { setError(e.message || '智能识别失败') }
    finally { setSmartPasteLoading(false) }
  }

  const handleCompare = async () => {
    const token = getToken()
    if (!token) { setError('请先登录'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/ai-assistant/amazon/competitor-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ myListing, competitors: competitors.filter(c => c.title.trim()), market, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '分析失败')
      setResult(data)
    } catch (e) { setError(e.message || '分析失败') }
    finally { setLoading(false) }
  }

  const addCompetitor = () => {
    if (competitors.length < 5) {
      setCompetitors(prev => [...prev, { title: '', bullets: '', description: '' }])
      setActiveCompTab(competitors.length)
    }
  }
  const removeCompetitor = (idx) => {
    if (competitors.length <= 1) return
    setCompetitors(prev => prev.filter((_, i) => i !== idx))
    setActiveCompTab(t => t >= idx ? Math.max(0, t - 1) : t)
  }
  const updateCompetitor = (idx, field, val) => setCompetitors(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))

  const SmartPasteInline = ({ target, label }) => (
    <div className="mt-2">
      {smartPasteTarget === target ? (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <textarea value={smartPasteText} onChange={e => setSmartPasteText(e.target.value)} rows={5}
            placeholder={`在亚马逊商品页面上按 Ctrl+A 全选 → Ctrl+C 复制 → 粘贴到这里`}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none"
            disabled={smartPasteLoading} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSmartPaste} disabled={smartPasteLoading || !smartPasteText.trim()}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${smartPasteText.trim() && !smartPasteLoading ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {smartPasteLoading ? '识别中…' : '智能识别'}
            </button>
            <button type="button" onClick={() => { setSmartPasteTarget(null); setSmartPasteText('') }} className="text-xs text-gray-500 hover:text-gray-900">取消</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setSmartPasteTarget(target); setSmartPasteText('') }}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1" disabled={loading}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          智能粘贴{label}
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 我的 Listing */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">我的 Listing</h4>
        <SmartPasteInline target="my" label="" />
        <input value={myListing.title} onChange={e => setMyListing(p => ({ ...p, title: e.target.value }))} placeholder="粘贴你的标题 *" disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
        <textarea value={myListing.bullets} onChange={e => setMyListing(p => ({ ...p, bullets: e.target.value }))} rows={4} placeholder="粘贴你的五点描述（可选）" disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none" />
        <textarea value={myListing.description} onChange={e => setMyListing(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="粘贴你的描述（可选）" disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none" />
      </div>

      {/* 竞品 Tab */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center border-b border-gray-200 bg-gray-50 px-1 pt-1 gap-0.5 overflow-x-auto">
          {competitors.map((c, idx) => (
            <button key={idx} type="button" onClick={() => setActiveCompTab(idx)}
              className={`relative group flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition whitespace-nowrap ${activeCompTab === idx ? 'bg-white text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
              <span>竞品 {idx + 1}</span>
              {c.title.trim() && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
              {competitors.length > 1 && (
                <span onClick={e => { e.stopPropagation(); removeCompetitor(idx) }}
                  className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px]">✕</span>
              )}
            </button>
          ))}
          {competitors.length < 5 && (
            <button type="button" onClick={addCompetitor} disabled={loading}
              className="px-2.5 py-2 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-t-lg transition whitespace-nowrap">+ 添加</button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <SmartPasteInline target={activeCompTab} label={` · 竞品 ${activeCompTab + 1}`} />
          <input value={competitors[activeCompTab]?.title || ''} onChange={e => updateCompetitor(activeCompTab, 'title', e.target.value)}
            placeholder={`粘贴竞品 ${activeCompTab + 1} 标题 *`} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
          <textarea value={competitors[activeCompTab]?.bullets || ''} onChange={e => updateCompetitor(activeCompTab, 'bullets', e.target.value)}
            rows={4} placeholder={`粘贴竞品 ${activeCompTab + 1} 五点描述（可选）`} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none" />
          <textarea value={competitors[activeCompTab]?.description || ''} onChange={e => updateCompetitor(activeCompTab, 'description', e.target.value)}
            rows={3} placeholder={`粘贴竞品 ${activeCompTab + 1} 描述（可选）`} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none" />
          <p className="text-[11px] text-gray-400">已填 {competitors.filter(c => c.title.trim()).length}/{competitors.length} 个竞品 · 至少填写 1 个竞品标题即可分析</p>
        </div>
      </div>

      {/* 设置 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标市场</label>
          <select value={market} onChange={e => setMarket(e.target.value)} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
            {markets.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">输出语言</label>
          <select value={lang} onChange={e => setLang(e.target.value)} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
            <option value="zh">中文</option><option value="en">English</option>
          </select>
        </div>
      </div>

      <button disabled={!canSubmit || loading} onClick={handleCompare}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition ${canSubmit && !loading ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
        {loading ? '正在分析竞品…' : '开始对比分析'}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 结果 */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* 关键词差异 */}
          {result.keywordGap && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900">关键词差异</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-medium text-green-600 mb-1.5">我的优势词</p>
                  <div className="flex flex-wrap gap-1">{(result.keywordGap.myAdvantage || []).map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs">{k}</span>)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-600 mb-1.5">待补充词</p>
                  <div className="flex flex-wrap gap-1">{(result.keywordGap.myOpportunity || []).map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs">{k}</span>)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">共有词</p>
                  <div className="flex flex-wrap gap-1">{(result.keywordGap.shared || []).map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs">{k}</span>)}</div>
                </div>
              </div>
            </div>
          )}

          {/* 卖点矩阵 */}
          {Array.isArray(result.sellingPointMatrix) && result.sellingPointMatrix.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900">卖点矩阵</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 font-medium text-gray-500">卖点</th>
                    <th className="py-2 px-2 font-medium text-gray-500">我</th>
                    {competitors.filter(c => c.title.trim()).map((_, i) => <th key={i} className="py-2 px-2 font-medium text-gray-500">竞品{i + 1}</th>)}
                  </tr></thead>
                  <tbody>{result.sellingPointMatrix.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 pr-3 text-gray-700">{row.feature}</td>
                      <td className="py-1.5 px-2 text-center">{row.mine ? <span className="text-green-500">✓</span> : <span className="text-gray-300">—</span>}</td>
                      {(row.competitors || []).map((v, j) => <td key={j} className="py-1.5 px-2 text-center">{v ? <span className="text-blue-500">✓</span> : <span className="text-gray-300">—</span>}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* 标题 & 五点分析 */}
          {(result.titleAnalysis || result.bulletAnalysis) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h3 className="text-base font-bold text-gray-900">策略分析</h3>
              {result.titleAnalysis && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">标题</p>
                  <p className="text-xs text-green-600">优势：{result.titleAnalysis.myStrength}</p>
                  <p className="text-xs text-orange-600">不足：{result.titleAnalysis.myWeakness}</p>
                  <p className="text-xs text-gray-600">建议：{result.titleAnalysis.bestPractice}</p>
                </div>
              )}
              {result.bulletAnalysis && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">五点描述</p>
                  <p className="text-xs text-green-600">优势：{result.bulletAnalysis.myStrength}</p>
                  {(result.bulletAnalysis.gaps || []).length > 0 && <p className="text-xs text-orange-600">缺口：{result.bulletAnalysis.gaps.join('；')}</p>}
                  {(result.bulletAnalysis.competitorTactics || []).length > 0 && <p className="text-xs text-gray-600">可借鉴：{result.bulletAnalysis.competitorTactics.join('；')}</p>}
                </div>
              )}
            </div>
          )}

          {/* 行动计划 */}
          {Array.isArray(result.actionPlan) && result.actionPlan.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900">行动计划</h3>
              <ol className="space-y-2">
                {result.actionPlan.map((a, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs mt-0.5">{a.priority || i + 1}</span>
                    <div>
                      <p className="text-sm text-gray-800 font-medium">{a.action}</p>
                      <p className="text-xs text-gray-500">{a.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 关键词研究表单 ────────────────────────────────────────────────────────────
function KeywordResearchForm() {
  const { getToken } = useAuth()
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [market, setMarket] = useState('us')
  const [lang, setLang] = useState('zh')
  const [existingKeywords, setExistingKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text).catch(() => {}) }

  const handleResearch = async () => {
    const token = getToken()
    if (!token) { setError('请先登录'); return }
    if (!productName.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/ai-assistant/amazon/keyword-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productName, category, market, lang, existingKeywords }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '研究失败')
      setResult(data)
    } catch (e) { setError(e.message || '研究失败') }
    finally { setLoading(false) }
  }

  const copyAllKeywords = () => {
    if (!result) return
    const parts = []
    if (result.coreTerms?.length) parts.push(`核心词：${result.coreTerms.map(t => t.term || t).join(', ')}`)
    if (result.longTailGroups?.length) {
      result.longTailGroups.forEach(g => { parts.push(`\n${g.group}：${(g.keywords || []).join(', ')}`) })
    }
    if (result.backendSuggestions?.length) parts.push(`\n后台关键词建议：${result.backendSuggestions.join(' ')}`)
    copyToClipboard(parts.join('\n'))
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">产品名称 <span className="text-red-500">*</span></label>
        <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="如：不锈钢保温杯、瑜伽垫、蓝牙耳机" disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">产品类目 <span className="text-gray-400 font-normal text-xs ml-1">可选</span></label>
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="如：Kitchen > Water Bottles" disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">已有关键词 <span className="text-gray-400 font-normal text-xs ml-1">可选，AI 会做差异分析</span></label>
        <textarea value={existingKeywords} onChange={e => setExistingKeywords(e.target.value)} rows={2} placeholder="粘贴你目前使用的关键词（可选）" disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标市场</label>
          <select value={market} onChange={e => setMarket(e.target.value)} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
            {markets.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">输出语言</label>
          <select value={lang} onChange={e => setLang(e.target.value)} disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
            <option value="zh">中文</option><option value="en">English</option>
          </select>
        </div>
      </div>

      <button disabled={!productName.trim() || loading} onClick={handleResearch}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition ${productName.trim() && !loading ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
        {loading ? '正在研究关键词…' : '开始关键词研究'}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="mt-6 space-y-6">
          {/* 核心词 */}
          {result.coreTerms?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">核心搜索词</h3>
                <button type="button" onClick={copyAllKeywords} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1">复制全部关键词</button>
              </div>
              <div className="space-y-2">
                {result.coreTerms.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold">{t.term || t}</span>
                    {t.reasoning && <span className="text-xs text-gray-500">{t.reasoning}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 长尾词分组 */}
          {result.longTailGroups?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h3 className="text-base font-bold text-gray-900">长尾关键词</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.longTailGroups.map((g, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-700">{g.icon || ''} {g.group}</p>
                    <div className="flex flex-wrap gap-1">
                      {(g.keywords || []).map((kw, j) => (
                        <button key={j} type="button" onClick={() => copyToClipboard(kw)}
                          className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition" title="点击复制">{kw}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 后台关键词建议 */}
          {result.backendSuggestions?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">后台关键词建议</h3>
                <button type="button" onClick={() => copyToClipboard(result.backendSuggestions.join(' '))} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1">复制</button>
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 break-words">{result.backendSuggestions.join(' ')}</p>
              <p className="text-xs text-gray-400">以上关键词不与标题/五点重复，可直接粘贴到亚马逊后台 Search Terms</p>
            </div>
          )}

          {/* 标题策略 */}
          {result.titleStrategy && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900">标题排布建议</h3>
              {result.titleStrategy.priorityKeywords?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">前 80 字符优先词</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.titleStrategy.priorityKeywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs font-medium">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.titleStrategy.templateSuggestion && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">推荐结构</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-2 font-mono">{result.titleStrategy.templateSuggestion}</p>
                </div>
              )}
              {result.titleStrategy.coverageNotes && <p className="text-xs text-gray-500">{result.titleStrategy.coverageNotes}</p>}
            </div>
          )}

          {/* 趋势 */}
          {result.trends && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{result.trends}</p>}

          {/* 差异分析 */}
          {result.gapAnalysis && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900">现有关键词差异分析</h3>
              {result.gapAnalysis.missing?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-600 mb-1">建议补充</p>
                  <div className="flex flex-wrap gap-1">{result.gapAnalysis.missing.map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs">{k}</span>)}</div>
                </div>
              )}
              {result.gapAnalysis.redundant?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">可精简</p>
                  <div className="flex flex-wrap gap-1">{result.gapAnalysis.redundant.map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-xs line-through">{k}</span>)}</div>
                </div>
              )}
              {result.gapAnalysis.wellCovered?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-600 mb-1">覆盖良好</p>
                  <div className="flex flex-wrap gap-1">{result.gapAnalysis.wellCovered.map((k, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs">{k}</span>)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
                    {platformId === 'ebay' && (
                      <p className="text-2xl text-gray-500 mt-3 pt-3 border-t border-gray-100">
                        生成符合 eBay Cassini 搜索规则的标题（80 字符）、Item Specifics、产品描述与产品图。
                      </p>
                    )}
                    {platformId === 'aliexpress' && (
                      <p className="text-2xl text-gray-500 mt-3 pt-3 border-t border-gray-100">
                        生成符合速卖通规则的标题（128 字符）、产品属性、详情描述与产品图，支持多语言多市场。
                      </p>
                    )}
                  </div>

                  {/* 功能卡片 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(platformId === 'ebay' ? ebayFeatures : platformId === 'aliexpress' ? aliexpressFeatures : amazonFeatures).map(f => (
                      <div
                        key={f.id}
                        className={`text-left p-5 rounded-xl border transition ${
                          f.disabled
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-75'
                            : 'group border-gray-200 hover:border-gray-900 hover:shadow-sm bg-white cursor-pointer'
                        }`}
                        role={f.disabled ? undefined : 'button'}
                        tabIndex={f.disabled ? -1 : 0}
                        onClick={() => !f.disabled && setSelectedFeature(f.id)}
                        onKeyDown={(e) => !f.disabled && (e.key === 'Enter' || e.key === ' ') && setSelectedFeature(f.id)}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition ${
                          f.disabled ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 group-hover:bg-gray-900 text-gray-600 group-hover:text-white'
                        }`}>
                          {f.icon}
                        </div>
                        <h3 className={`text-base font-semibold mb-2 ${f.disabled ? 'text-gray-500' : 'text-gray-900'}`}>{f.title}</h3>
                        <p className={`text-sm leading-relaxed ${f.disabled ? 'text-gray-400' : 'text-gray-500'}`}>{f.desc}</p>
                        <div className={`mt-4 flex items-center text-xs font-medium ${f.disabled ? 'text-gray-400' : 'text-gray-400 group-hover:text-gray-900 transition'}`}>
                          <span>{f.disabled ? '即将上线' : '开始使用'}</span>
                          {!f.disabled && (
                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>
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
                      {(platformId === 'ebay' ? ebayFeatures : platformId === 'aliexpress' ? aliexpressFeatures : amazonFeatures).find(f => f.id === selectedFeature)?.title}
                    </span>
                  </div>
                  {platformId === 'amazon' && (
                    <p className="text-2xl text-gray-500 mb-4">
                      本模块的生成/优化功能严格遵守亚马逊平台规则，并智能符合 A9、Cosmo、Rufus、GEO 等原则。
                    </p>
                  )}

                  {/* 表单内容 */}
                  <div className="max-w-2xl">
                    {platformId === 'amazon' && selectedFeature === 'generate' && <GenerateForm />}
                    {platformId === 'amazon' && selectedFeature === 'optimize' && <OptimizeForm />}
                    {platformId === 'amazon' && selectedFeature === 'competitor' && <CompetitorForm />}
                    {platformId === 'amazon' && selectedFeature === 'keywords' && <KeywordResearchForm />}
                    {(platformId === 'ebay' || platformId === 'aliexpress') && selectedFeature === 'generate' && <PlatformGenerateForm key={platformId} platform={platformId} />}
                    {(platformId === 'ebay' || platformId === 'aliexpress') && selectedFeature === 'optimize' && <PlatformOptimizeForm key={`${platformId}-optimize`} platform={platformId} />}
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
