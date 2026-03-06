import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import ImageLightbox from '../components/ImageLightbox'
import { getClarityOptionsForModel, resolveClarityForModel } from '../lib/clarityByModel'
import { getAspectOptionsForModel, resolveAspectForModel } from '../lib/aspectByModel'
import { saveBlobWithPicker } from '../lib/saveFileWithPicker'

// 各模式的示例展示配置
// demo: { before, after, prompt, beforeLabel, afterLabel } — 有真实图片时填入
// before/after 为 null 时显示占位图示
const MODE_DEMOS = {
  'add-remove': {
    before: '/demo-cat-original.png',
    beforeLabel: '原图',
    after: '/demo-cat-with-hat.png',
    afterLabel: '结果',
    prompt: '请在猫咪头上添加一顶小巧的针织巫师帽，使其看起来自然舒适、帽子不会滑落。',
  },
  'inpainting': {
    before: '/demo-living-room-original.png',
    beforeLabel: '原图',
    after: '/demo-living-room-edited.png',
    afterLabel: '局部修改后',
    prompt: '将图中的棕色真皮沙发改为现代深蓝色布艺沙发，保持房间其余所有元素完全不变，包括灯光、地毯、茶几摆件和装饰物。',
  },
  'style-transfer': {
    before: '/demo-city-original.png',
    beforeLabel: '原图',
    after: '/demo-city-style-transfer.png',
    afterLabel: '风格迁移后',
    prompt: '将这张城市夜景照片转换为梵高《星夜》的艺术风格，保留建筑与车辆的原有构图，以漩涡状厚涂笔触重新渲染画面，整体色调呈现深邃蓝色与明亮黄色的强烈对比。',
  },
  'composition': {
    before: ['/demo-dress.png', '/demo-model.png'],
    beforeLabels: ['图片 1：服装', '图片 2：人物'],
    after: '/demo-fashion-result.png',
    afterLabel: '合成结果',
    prompt: '将图片1中的蓝色碎花连衣裙穿在图片2的女性人物身上，生成真实感强的全身电商时装照片，根据户外光线调整阴影与光影效果。',
  },
  'hi-fidelity': {
    before: ['/demo-woman.png', '/demo-logo.png'],
    beforeLabels: ['图片 1：人物', '图片 2：标志'],
    after: '/demo-woman-with-logo.png',
    afterLabel: '融合结果',
    prompt: '将图片2中的徽标自然印在图片1人物的黑色T恤上，保持人物面部特征与发型完全不变，徽标随衣物纹理自然贴合，看起来像真实印刷效果。',
  },
  'bring-to-life': {
    before: '/demo-car-sketch.png',
    beforeLabel: '铅笔草图',
    after: '/demo-car-photo.png',
    afterLabel: '渲染成品',
    prompt: '将这张未来感超跑的铅笔草图渲染为展厅里的精致概念车成品照，保留草图的流线车身与低矮轮廓，添加金属蓝色烤漆与霓虹轮毂灯效，光影效果真实自然。',
  },
  'character-360': {
    before: '/demo-man-original.png',
    beforeLabel: '参考图',
    after: ['/demo-man-forward.png', '/demo-man-right.png'],
    afterLabels: ['正面输出', '侧面输出'],
    prompt: '基于参考图，分别生成该人物的正面白底棚拍肖像，以及右侧侧面视图，保持面部特征、发型、眼镜与服装完全一致。',
  },
  'text-replace': {
    before: null,
    beforeLabel: '含文字的图片',
    after: null,
    afterLabel: '文字替换后',
    prompt: '将图片中的文字「SALE 50% OFF」替换为「限时特惠 买一送一」，保持原有字体样式、大小、颜色、位置与排版完全不变。',
  },
  'text-translate': {
    before: null,
    beforeLabel: '原语言图片',
    after: null,
    afterLabel: '翻译后',
    prompt: '将图片中所有英文文字翻译为简体中文，保持原有字体样式、大小、颜色、位置和整体视觉设计完全不变，翻译内容自然流畅。',
  },
}

const MODES = [
  {
    id: 'add-remove',
    label: '添加 / 移除元素',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    desc: '在图片中添加新元素，或移除现有元素，保持其余部分风格一致。',
    imageCount: 1,
    imageLabels: ['原始图片'],
    promptPlaceholder: '例如：给猫咪头上加一顶针织巫师帽，使其看起来自然舒适；或：移除背景中的杂物',
  },
  {
    id: 'inpainting',
    label: '局部重绘（语义遮盖）',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    desc: '修改图片的特定部分，其余内容（光线、构图、风格）保持完全不变。',
    imageCount: 1,
    imageLabels: ['原始图片'],
    promptPlaceholder: '例如：将棕色皮质沙发改为深蓝色布艺沙发，保持灯光、地毯、茶几和所有装饰物完全不变',
  },
  {
    id: 'style-transfer',
    label: '风格迁移',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    desc: '将照片转换为指定的艺术风格，保留原始构图和主体内容。',
    imageCount: 1,
    imageLabels: ['原始图片'],
    promptPlaceholder: '例如：将这张城市夜景转换为梵高《星夜》油画风格，保留街道与建筑构图，以漩涡状厚涂笔触重绘，主色调为深蓝与亮黄',
  },
  {
    id: 'composition',
    label: '高级合成：多图组合',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    desc: '将多张图片中的元素组合成一张全新的合成图。最多可上传 5 张参考图。',
    imageCount: 5,
    imageLabels: ['图片 1（主体）', '图片 2', '图片 3', '图片 4', '图片 5'],
    promptPlaceholder: '例如：将图片1的蓝色碎花连衣裙穿在图片2的女性人物身上，生成真实感强的全身电商时装照片，根据光线调整阴影效果',
  },
  {
    id: 'hi-fidelity',
    label: '高保真细节保留',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    desc: '将第二张图的特定细节（如品牌标志、纹理）融合到第一张图中，同时保留主体特征不变。',
    imageCount: 2,
    imageLabels: ['主体图片（人物/场景）', '细节/标志图片'],
    promptPlaceholder: '例如：将图片2的徽标自然印在图片1人物的黑色T恤上，保持人物面部与发型完全不变，徽标随衣物纹理自然贴合',
  },
  {
    id: 'bring-to-life',
    label: '让草图变生动',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    desc: '上传草图、线稿或简笔画，AI 将其渲染为精致的成品图片。',
    imageCount: 1,
    imageLabels: ['草图 / 线稿'],
    promptPlaceholder: '例如：将这张超跑铅笔草图渲染为展厅里的金属蓝色概念车，保留流线车身与低矮轮廓，加入霓虹轮毂灯效，光影真实自然',
  },
  {
    id: 'character-360',
    label: '角色一致性：360° 全景',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    desc: '基于参考图，生成该角色/人物在不同角度的一致性视图，适合产品或角色设计。',
    imageCount: 1,
    imageLabels: ['角色参考图'],
    promptPlaceholder: '例如：该人物的右侧侧面视图，白色棚拍背景，保持面部特征、发型、眼镜与服装完全一致',
  },
  {
    id: 'text-replace',
    label: '图片文字替换',
    specialUI: 'text-replace',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L12 14l-4 1 1-4 7.5-7.5z" />
      </svg>
    ),
    desc: '将图片中的指定文字替换为新内容，保持原有字体样式、大小、颜色、位置完全不变。',
    imageCount: 1,
    imageLabels: ['含文字的图片'],
    promptPlaceholder: '',
  },
  {
    id: 'text-translate',
    label: '图片文字语言转换',
    specialUI: 'text-translate',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    desc: '将图片中所有文字翻译为目标语言，保持原有字体样式、排版与视觉设计完全不变。',
    imageCount: 1,
    imageLabels: ['含文字的图片'],
    promptPlaceholder: '（可选）补充要求，例如：品牌名保留英文不翻译',
  },
]

const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']

const LANGUAGE_OPTIONS = [
  '简体中文', '繁體中文', 'English', '日本語', '한국어',
  'Français', 'Español', 'Deutsch', 'Português', 'Italiano',
  'Русский', 'العربية', 'ภาษาไทย', 'Tiếng Việt',
]

// 占位图：用 SVG 内联表示「暂无示例图」
function PlaceholderImage({ label }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl bg-gray-100 text-gray-400 select-none">
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-xs">{label}</span>
    </div>
  )
}

function ModeDemo({ mode }) {
  const demo = MODE_DEMOS[mode.id]
  const isMultiBefore = Array.isArray(demo?.before)
  const hasRealBefore = isMultiBefore ? demo.before.length > 0 : !!demo?.before
  const hasRealAfter = !!demo?.after

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-0 p-4">

        {/* ── Before 区域：单图 或 多图竖排 ── */}
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          {isMultiBefore ? (
            /* 多图：两张小图竖向排列 */
            <div className="flex flex-col gap-2">
              {demo.before.map((src, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {demo.beforeLabels?.[i] || `图片 ${i + 1}`}
                  </span>
                  <div className="relative w-full overflow-hidden rounded-xl border border-gray-200" style={{ aspectRatio: '1/1' }}>
                    <img src={src} alt={`input-${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 单图 */
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {demo?.beforeLabel || '原图'}
              </span>
              <div className="relative w-full overflow-hidden rounded-xl border border-gray-200" style={{ aspectRatio: '1/1' }}>
                {hasRealBefore ? (
                  <img src={demo.before} alt="before" className="h-full w-full object-cover" />
                ) : (
                  <PlaceholderImage label="示例图" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 箭头 + 提示词 ── */}
        <div className="flex flex-col items-center justify-center px-3 gap-3 flex-shrink-0 w-[152px]">
          <div className="flex items-center gap-1">
            <div className="h-px w-8 bg-gray-300" />
            <svg className="h-5 w-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          {demo?.prompt && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-[11px] leading-snug text-gray-600 italic text-center max-h-[160px] overflow-y-auto">
              {demo.prompt}
            </div>
          )}
        </div>

        {/* ── After 区域：单图 或 多图竖排 ── */}
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          {Array.isArray(demo?.after) ? (
            /* 多图：竖向排列 */
            <div className="flex flex-col gap-2">
              {demo.after.map((src, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {demo.afterLabels?.[i] || `结果 ${i + 1}`}
                  </span>
                  <div className="relative w-full overflow-hidden rounded-xl border border-gray-200" style={{ aspectRatio: '1/1' }}>
                    <img src={src} alt={`output-${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 单图 */
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {demo?.afterLabel || '结果'}
              </span>
              <div className="relative w-full overflow-hidden rounded-xl border border-gray-200" style={{ aspectRatio: '1/1' }}>
                {hasRealAfter ? (
                  <img src={demo.after} alt="after" className="h-full w-full object-cover" />
                ) : (
                  <PlaceholderImage label="示例图" />
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 底部文字描述 */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5">
        <p className="text-xs text-gray-500">{mode.desc}</p>
      </div>
    </div>
  )
}

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

export default function ImageEdit() {
  const { getToken } = useAuth()
  const [selectedMode, setSelectedMode] = useState(MODES[0].id)
  const [images, setImages] = useState([]) // [{ file, dataUrl, slot }]
  const [prompt, setPrompt] = useState('')
  // text-replace 专用字段
  const [textOriginal, setTextOriginal] = useState('')
  const [textReplacement, setTextReplacement] = useState('')
  // text-translate 专用字段
  const [targetLang, setTargetLang] = useState('简体中文')
  const [model, setModel] = useState('Nano Banana 2')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null) // data URL
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const fileInputRefs = useRef({})

  const mode = MODES.find((m) => m.id === selectedMode)

  const handleModeChange = (id) => {
    setSelectedMode(id)
    setImages([])
    setPrompt('')
    setTextOriginal('')
    setTextReplacement('')
    setTargetLang('简体中文')
    setResult(null)
    setError('')
  }

  // 根据专属字段或通用 prompt 组装最终指令
  const buildFinalPrompt = () => {
    if (selectedMode === 'text-replace') {
      const base = `将图片中的文字「${textOriginal.trim()}」替换为「${textReplacement.trim()}」，保持原有字体样式、大小、颜色、位置和整体排版设计完全不变，替换后文字需与周围视觉元素自然融合`
      const extra = prompt.trim() ? `。${prompt.trim()}` : ''
      return base + extra
    }
    if (selectedMode === 'text-translate') {
      const base = `将图片中所有文字翻译为${targetLang}，保持原有字体样式、大小、颜色、位置和整体视觉设计完全不变，翻译内容需自然流畅、符合目标语言习惯`
      const extra = prompt.trim() ? `。${prompt.trim()}` : ''
      return base + extra
    }
    return prompt.trim()
  }

  const handleModelChange = (m) => {
    setModel(m)
    setClarity((prev) => resolveClarityForModel(m, prev))
    setAspectRatio((prev) => resolveAspectForModel(m, prev))
  }

  const handleFileChange = (e, slotIndex) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = URL.createObjectURL(file)
    setImages((prev) => {
      const next = prev.filter((img) => img.slot !== slotIndex)
      return [...next, { file, dataUrl, slot: slotIndex }]
    })
    setResult(null)
    setError('')
  }

  const removeImage = (slotIndex) => {
    setImages((prev) => {
      const item = prev.find((img) => img.slot === slotIndex)
      if (item?.dataUrl) URL.revokeObjectURL(item.dataUrl)
      return prev.filter((img) => img.slot !== slotIndex)
    })
  }

  const getImageForSlot = (slotIndex) => images.find((img) => img.slot === slotIndex)

  const handleGenerate = async () => {
    const finalPrompt = buildFinalPrompt()
    if (!finalPrompt) {
      if (selectedMode === 'text-replace') { setError('请填写原文字和替换文字'); return }
      if (selectedMode === 'text-translate') { setError('请选择目标语言'); return }
      setError('请填写修改指令')
      return
    }
    const requiredImages = selectedMode === 'composition' ? 2 : 1
    if (images.length < requiredImages) {
      setError(requiredImages === 1 ? '请上传图片' : `请至少上传 ${requiredImages} 张图片`)
      return
    }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      // 按 slot 顺序排列图片
      const sorted = [...images].sort((a, b) => a.slot - b.slot)
      const base64Images = await Promise.all(sorted.map((img) => fileToCompressedDataUrl(img.file)))
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: selectedMode,
          prompt: finalPrompt,
          images: base64Images,
          model,
          aspectRatio,
          clarity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '生成失败')
      setResult(data.image)
    } catch (err) {
      setError(err.message || '生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = (() => {
    const hasImages = images.length >= (selectedMode === 'composition' ? 2 : 1)
    if (!hasImages) return false
    if (selectedMode === 'text-replace') return textOriginal.trim() && textReplacement.trim()
    if (selectedMode === 'text-translate') return !!targetLang
    return !!prompt.trim()
  })()

  return (
    <div className="min-h-screen bg-gray-100/80">
      {/* 全屏遮罩 */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl min-w-[280px]">
            <svg className="h-12 w-12 animate-spin text-gray-700" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-gray-800">正在处理图片...</p>
            <p className="text-xs text-gray-500">请勿关闭或刷新页面</p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-700 rounded-full animate-[slide_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900">修改图片</h1>
        <p className="mt-1 text-sm text-gray-500">选择修改模式，上传图片并描述你的需求，AI 一键生成</p>

        <div className="mt-8 grid lg:grid-cols-[280px_1fr] gap-6">
          {/* 左侧：模式选择 */}
          <div className="space-y-1.5">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">选择模式</p>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeChange(m.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  selectedMode === m.id
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className={selectedMode === m.id ? 'text-white' : 'text-gray-500'}>{m.icon}</span>
                <span className="text-sm font-medium leading-tight">{m.label}</span>
              </button>
            ))}
          </div>

          {/* 右侧：输入 + 结果 */}
          <div className="space-y-6">
            {/* 当前模式说明：可视化 Before → After 示例 */}
            <ModeDemo mode={mode} />

            <div className="grid lg:grid-cols-[400px_1fr] gap-6">
              {/* 输入区 */}
              <div className="space-y-5">
                {/* 图片上传槽 */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">上传图片</h2>
                  <div className="space-y-3">
                    {Array.from({ length: mode.imageCount }).map((_, i) => {
                      const imgItem = getImageForSlot(i)
                      return (
                        <div key={i}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {mode.imageLabels[i] || `图片 ${i + 1}`}
                            {i === 0 && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          {imgItem ? (
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setLightbox({ open: true, src: imgItem.dataUrl })}
                              >
                                <img
                                  src={imgItem.dataUrl}
                                  alt=""
                                  className="h-24 w-24 rounded-xl object-cover border border-gray-200 shadow-sm"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-700"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 transition">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[i] = el }}
                                onChange={(e) => handleFileChange(e, i)}
                              />
                              <svg className="h-7 w-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="mt-1 text-xs text-gray-400">点击上传</span>
                            </label>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 修改指令 —— 根据模式渲染不同 UI */}
                {mode.specialUI === 'text-replace' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                        原文字 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="输入图片中要替换的原始文字"
                        value={textOriginal}
                        onChange={(e) => setTextOriginal(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                        替换为 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="输入新的文字内容"
                        value={textReplacement}
                        onChange={(e) => setTextReplacement(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        补充要求（可选）
                      </label>
                      <textarea
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={2}
                        placeholder="例如：替换后保持与图片整体色调一致"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                  </div>
                ) : mode.specialUI === 'text-translate' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                        翻译成 <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                      >
                        {LANGUAGE_OPTIONS.map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        补充要求（可选）
                      </label>
                      <textarea
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={2}
                        placeholder={mode.promptPlaceholder}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      修改指令 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      rows={4}
                      placeholder={mode.promptPlaceholder}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>
                )}

                {/* 设置（可折叠） */}
                <details className="group rounded-xl border border-gray-200 bg-white">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 select-none">
                    <span>输出设置</span>
                    <svg className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">模型</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        value={model}
                        onChange={(e) => handleModelChange(e.target.value)}
                      >
                        {MODEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">输出尺寸比例</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                      >
                        {getAspectOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">清晰度</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        value={clarity}
                        onChange={(e) => setClarity(e.target.value)}
                      >
                        {getClarityOptionsForModel(model).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>
                </details>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="button"
                  disabled={generating || !canGenerate}
                  onClick={handleGenerate}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {generating ? '处理中...' : '开始修改'}
                </button>
              </div>

              {/* 结果区 */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">生成结果</h2>
                {result ? (
                  <div>
                    <button
                      type="button"
                      className="block w-full overflow-hidden rounded-xl border border-gray-200"
                      onClick={() => setLightbox({ open: true, src: result })}
                    >
                      <img src={result} alt="修改结果" className="w-full h-auto object-contain" />
                    </button>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(result)
                            const blob = await res.blob()
                            await saveBlobWithPicker(blob, `image-edit-${Date.now()}.png`)
                          } catch (_) {}
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        保存到本地
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResult(null)
                          handleGenerate()
                        }}
                        disabled={generating}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重新生成
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                    <div className="rounded-full bg-gray-100 p-6">
                      <svg className="h-14 w-14 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-600">选择模式并上传图片后点击「开始修改」</p>
                    <p className="mt-1 text-xs text-gray-400">修改结果将显示在这里</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt="图片预览"
        onClose={() => setLightbox((p) => ({ ...p, open: false }))}
      />
    </div>
  )
}
