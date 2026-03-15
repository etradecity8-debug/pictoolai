import { useState, useRef, useEffect } from 'react'
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
    after: ['/demo-man-right.png'],
    afterLabels: ['右侧图'],
    prompt: '基于参考图，生成该人物的右侧侧面白底棚拍肖像图，保持面部特征、发型、眼镜与服装完全一致。',
  },
  'text-replace': {
    before: '/demo-text-replace-before.png',
    beforeLabel: '含文字的图片',
    after: '/demo-text-replace-after.png',
    afterLabel: '文字替换后',
    prompt: '', // 只显示箭头，不显示文字
  },
  'text-translate': {
    before: '/demo-text-translate-before.png',
    beforeLabel: '原语言图片',
    after: '/demo-text-translate-after.png',
    afterLabel: '翻译后',
    prompt: '', // 只显示箭头，不显示文字
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
    label: '文字替换',
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
    label: '语言转换',
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

// 与 server/points.js POINTS_MAP 保持一致
const POINTS_MAP = {
  'Nano Banana':     { '1K 标准': 3 },
  'Nano Banana Pro': { '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
  'Nano Banana 2':   { '0.5K 快速': 3, '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
}
function getPointsEstimate(model, clarity) {
  return POINTS_MAP[model]?.[clarity] ?? 3
}

const LANGUAGE_OPTIONS = [
  { value: 'Simplified Chinese',  label: '简体中文' },
  { value: 'Traditional Chinese', label: '繁体中文' },
  { value: 'English',             label: '英文' },
  { value: 'Japanese',            label: '日语' },
  { value: 'Korean',              label: '韩语' },
  { value: 'French',              label: '法语' },
  { value: 'Spanish',             label: '西班牙语' },
  { value: 'German',              label: '德语' },
  { value: 'Portuguese',          label: '葡萄牙语' },
  { value: 'Italian',             label: '意大利语' },
  { value: 'Russian',             label: '俄语' },
  { value: 'Arabic',              label: '阿拉伯语' },
  { value: 'Thai',                label: '泰语' },
  { value: 'Vietnamese',          label: '越南语' },
]

const FONT_STYLE_OPTIONS = [
  { value: 'original', label: '与原图保持一致', prompt: '' },
  { value: 'sans-serif', label: '无衬线体 — 现代简洁', prompt: '字体使用现代无衬线风格（如 Helvetica / Arial 类），线条干净简洁' },
  { value: 'serif', label: '衬线体 — 经典优雅', prompt: '字体使用衬线风格（如 Times / Georgia 类），笔画末端带装饰衬线，气质经典优雅' },
  { value: 'bold-black', label: '粗黑体 — 醒目有力', prompt: '字体使用极粗黑体风格，笔画粗壮有力、视觉冲击强' },
  { value: 'thin', label: '细线体 — 轻盈精致', prompt: '字体使用超细线体风格，笔画纤细轻盈，气质高级精致' },
  { value: 'handwritten', label: '手写体 — 活泼自然', prompt: '字体使用手写风格，笔触自然随性，富有人情味' },
  { value: 'tech', label: '等宽体 — 科技感', prompt: '字体使用等宽字体风格（如 Courier / Consolas 类），具有代码与科技感' },
  { value: 'display', label: '展示体 — 设计感强', prompt: '字体使用装饰性展示字体风格，独特有设计感，适合标题与品牌展示' },
]

const FONT_SIZE_DIR_OPTIONS = [
  { value: 'original', label: '与原文字相同' },
  { value: 'larger', label: '放大' },
  { value: 'smaller', label: '缩小' },
]

// 字体风格 + 字号选择器（文字替换/语言转换模式专用）
function FontStylePicker({ fontStyle, setFontStyle, fontSizeDir, setFontSizeDir, fontSizePercent, setFontSizePercent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">字体设置（AI 近似渲染）</p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">字体风格</label>
        <select
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          value={fontStyle}
          onChange={(e) => setFontStyle(e.target.value)}
        >
          {FONT_STYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">字号大小</label>
        <div className="flex items-center gap-2">
          <select
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={fontSizeDir}
            onChange={(e) => setFontSizeDir(e.target.value)}
          >
            {FONT_SIZE_DIR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {fontSizeDir !== 'original' && (
            <>
              <input
                type="number"
                min={5}
                max={200}
                step={5}
                className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 text-center focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={fontSizePercent}
                onChange={(e) => {
                  const v = Math.min(200, Math.max(5, Number(e.target.value) || 5))
                  setFontSizePercent(v)
                }}
              />
              <span className="text-sm text-gray-500 shrink-0">%</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

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

// 用 auth header 加载图库图片缩略图；绝对 URL（COS 签名）无需 Authorization
function GalleryThumb({ url, title, token, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null)
  useEffect(() => {
    if (!url) return
    let revoked = false
    const isAbsolute = typeof url === 'string' && url.startsWith('http')
    const headers = (token && !isAbsolute) ? { Authorization: `Bearer ${token}` } : {}
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

/** 框选提取文字：在图片上拖拽选择区域，调用 OCR 提取文字 */
function ImageTextSelector({ imageSrc, onExtract, onCancel }) {
  const stageRef = useRef(null)
  const imgRef = useRef(null)
  const [rect, setRect] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [start, setStart] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  const handleMouseDown = (e) => {
    if (!stageRef.current) return
    const stage = stageRef.current
    const rect = stage.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setStart({ x, y })
    setRect({ x, y, w: 0, h: 0 })
    setDragging(true)
    setExtractError('')
  }
  const handleMouseMove = (e) => {
    if (!dragging || !start || !stageRef.current) return
    const stage = stageRef.current
    const r = stage.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const x = Math.min(start.x, mx)
    const y = Math.min(start.y, my)
    const w = Math.abs(mx - start.x)
    const h = Math.abs(my - start.y)
    setRect({ x, y, w, h })
  }
  const handleMouseUp = () => setDragging(false)

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, start])

  const handleExtract = async () => {
    if (!imgRef.current || !stageRef.current || !rect || rect.w < 8 || rect.h < 8) {
      setExtractError('请先框选要提取的文字区域')
      return
    }
    const img = imgRef.current
    const stage = stageRef.current
    const stageRect = stage.getBoundingClientRect()
    const scaleX = img.naturalWidth / stageRect.width
    const scaleY = img.naturalHeight / stageRect.height
    const cx = Math.round(rect.x * scaleX)
    const cy = Math.round(rect.y * scaleY)
    const cw = Math.round(rect.w * scaleX)
    const ch = Math.round(rect.h * scaleY)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    canvas.getContext('2d').drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setExtracting(true)
    setExtractError('')
    try {
      const res = await fetch('/api/image-edit/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '提取失败')
      const text = (data.text || '').trim()
      if (!text) throw new Error('未识别到文字，请调整框选区域后重试')
      onExtract(text)
      onCancel()
    } catch (e) {
      setExtractError(e.message || '文字提取失败')
    } finally {
      setExtracting(false)
    }
  }

  const handleExtractFull = async () => {
    if (!imgRef.current) return
    const img = imgRef.current
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setExtracting(true)
    setExtractError('')
    try {
      const res = await fetch('/api/image-edit/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '提取失败')
      const text = (data.text || '').trim()
      if (!text) throw new Error('未识别到文字，请尝试框选具体区域')
      onExtract(text)
      onCancel()
    } catch (e) {
      setExtractError(e.message || '文字提取失败')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">框选文字区域</h3>
          <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">在图片上拖拽框选要提取的文字区域</p>
          <div className="flex justify-center items-center max-h-[60vh] bg-gray-100 rounded-xl overflow-hidden">
            <div
              ref={stageRef}
              className="relative inline-block cursor-crosshair"
              onMouseDown={handleMouseDown}
              style={{ touchAction: 'none' }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                className="max-h-[60vh] max-w-full object-contain block select-none"
                draggable={false}
                style={{ userSelect: 'none', display: 'block', verticalAlign: 'bottom' }}
              />
              {rect && rect.w > 0 && rect.h > 0 && (
                <div
                  className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                />
              )}
            </div>
          </div>
          {extractError && <p className="mt-2 text-sm text-red-600">{extractError}</p>}
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-between gap-2">
          <button
            type="button"
            onClick={handleExtractFull}
            disabled={extracting}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            {extracting ? '提取中…' : '全图识别'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting}
              className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {extracting ? '提取中…' : '确认提取'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const VALID_MODE_IDS = new Set(MODES.map((m) => m.id))

export default function ImageEdit({ initialMode, hideModeSelector = false }) {
  const { getToken, refreshUser = null } = useAuth()
  const resolvedInitial = VALID_MODE_IDS.has(initialMode) ? initialMode : MODES[0].id
  const [selectedMode, setSelectedMode] = useState(resolvedInitial)
  const [images, setImages] = useState([]) // [{ file, dataUrl, slot }]
  const [prompt, setPrompt] = useState('')
  // text-replace 专用字段
  const [textOriginal, setTextOriginal] = useState('')
  const [textReplacement, setTextReplacement] = useState('')
  // text-translate 专用字段
  const [targetLang, setTargetLang] = useState('Simplified Chinese')
  // 文字替换 / 语言转换共用的字体选项
  const [fontStyle, setFontStyle] = useState('original')
  const [fontSizeDir, setFontSizeDir] = useState('original')
  const [fontSizePercent, setFontSizePercent] = useState(30)
  const [model, setModel] = useState('Nano Banana 2')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null) // data URL
  const [lastPointsUsed, setLastPointsUsed] = useState(null)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  // 文字替换：框选提取
  const [textExtractModal, setTextExtractModal] = useState({ open: false })
  // 从图库选取
  const [galleryPicker, setGalleryPicker] = useState({ open: false, slot: 0 })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const fileInputRefs = useRef({})

  const mode = MODES.find((m) => m.id === selectedMode)

  // 从 AiDesigner 进入时，根据 URL 的 initialMode 同步选中模式；切换模式时重置表单
  useEffect(() => {
    if (initialMode && VALID_MODE_IDS.has(initialMode)) {
      setSelectedMode(initialMode)
      if (hideModeSelector) {
        setImages([])
        setPrompt('')
        setTextOriginal('')
        setTextReplacement('')
        setTargetLang('Simplified Chinese')
        setFontStyle('original')
        setFontSizeDir('original')
        setFontSizePercent(30)
        setResult(null)
        setLastPointsUsed(null)
        setError('')
        setTextExtractModal({ open: false })
      }
    }
  }, [initialMode, hideModeSelector])

  const handleModeChange = (id) => {
    setSelectedMode(id)
    setImages([])
    setPrompt('')
    setTextOriginal('')
    setTextReplacement('')
    setTargetLang('Simplified Chinese')
    setFontStyle('original')
    setFontSizeDir('original')
    setFontSizePercent(30)
    setResult(null)
    setLastPointsUsed(null)
    setError('')
    setTextExtractModal({ open: false })
  }

  // 根据专属字段或通用 prompt 组装最终指令
  const buildFinalPrompt = () => {
    const fontStylePrompt = FONT_STYLE_OPTIONS.find((o) => o.value === fontStyle)?.prompt || ''
    const fontSizePrompt = fontSizeDir === 'larger'
      ? `新文字字号比原文字放大约${fontSizePercent}%`
      : fontSizeDir === 'smaller'
        ? `新文字字号比原文字缩小约${fontSizePercent}%`
        : ''
    const fontDesc = [fontStylePrompt, fontSizePrompt].filter(Boolean).join('；')

    if (selectedMode === 'text-replace') {
      const orig = textOriginal.trim()
      const repl = textReplacement.trim()
      const fontInstruction = fontDesc ? ` 新文字字体要求：${fontDesc}。` : ''
      const base = `Replace the text "${orig}" with "${repl}" in this image.${fontInstruction} Do not change any other elements of the image.`
      const extra = prompt.trim() ? ` ${prompt.trim()}` : ''
      return base + extra
    }
    if (selectedMode === 'text-translate') {
      const fontInstruction = fontDesc ? ` 翻译后文字字体要求：${fontDesc}。` : ''
      const base = `Update all text in this image to be in ${targetLang}. Translate each text element naturally as a complete phrase, not word by word.${fontInstruction} Do not change any other elements of the image.`
      const extra = prompt.trim() ? ` ${prompt.trim()}` : ''
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

  const openGalleryPicker = async (slotIndex) => {
    setGalleryPicker({ open: true, slot: slotIndex })
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

  const handlePickFromGallery = async (item) => {
    setGalleryPicker((p) => ({ ...p, open: false }))
    const slotIndex = galleryPicker.slot
    try {
      const token = getToken()
      const isAbsolute = typeof item.url === 'string' && item.url.startsWith('http')
      const headers = (token && !isAbsolute) ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(item.url, { headers })
      const blob = await res.blob()
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
      setImages((prev) => {
        const next = prev.filter((img) => img.slot !== slotIndex)
        return [...next, { file, dataUrl, slot: slotIndex }]
      })
      setResult(null)
      setError('')
    } catch (_) {}
  }

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
      if (data.pointsUsed != null) setLastPointsUsed(data.pointsUsed)
      if (refreshUser) refreshUser()
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

      <div className={hideModeSelector ? 'space-y-4 min-h-[240px]' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        {hideModeSelector ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{mode?.label || '修改图片'}</h1>
            <p className="mt-1.5 text-base text-gray-600">
              {selectedMode === 'text-replace'
                ? '替换图片中的指定文字，保持原有字体样式、大小、颜色与排版不变'
                : selectedMode === 'text-translate'
                ? '将图中文字翻译为目标语言，保持字体样式与排版不变'
                : '上传图片并描述你的需求，AI 一键生成'}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">修改图片</h1>
            <p className="mt-1 text-sm text-gray-500">选择修改模式，上传图片并描述你的需求，AI 一键生成</p>
          </>
        )}
        <div className={hideModeSelector ? 'max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white p-4' : 'mt-8 grid lg:grid-cols-[280px_1fr] gap-6'}>
          {/* 左侧：模式选择（hideModeSelector 时隐藏） */}
          {!hideModeSelector && (
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
          )}

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
                            <div className="flex gap-2">
                              <label className="flex flex-1 h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 transition">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  ref={(el) => { fileInputRefs.current[i] = el }}
                                  onChange={(e) => handleFileChange(e, i)}
                                />
                                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="mt-1 text-xs text-gray-400">{hideModeSelector ? '上传图片' : '本地上传'}</span>
                              </label>
                              {getToken() && (
                                <button
                                  type="button"
                                  onClick={() => openGalleryPicker(i)}
                                  className="flex flex-1 h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 transition"
                                >
                                  <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="mt-1 text-xs text-gray-400">{hideModeSelector ? '从作品库选择' : '从图库选取'}</span>
                                </button>
                              )}
                            </div>
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
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="text-sm font-semibold text-gray-900">
                          原文字 <span className="text-red-500">*</span>
                        </label>
                        {getImageForSlot(0) && (
                          <button
                            type="button"
                            onClick={() => setTextExtractModal({ open: true })}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            框选提取
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="输入图片中要替换的原始文字，或点击「框选提取」在图上框选识别"
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
                    <FontStylePicker fontStyle={fontStyle} setFontStyle={setFontStyle} fontSizeDir={fontSizeDir} setFontSizeDir={setFontSizeDir} fontSizePercent={fontSizePercent} setFontSizePercent={setFontSizePercent} />
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
                        {LANGUAGE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <FontStylePicker fontStyle={fontStyle} setFontStyle={setFontStyle} fontSizeDir={fontSizeDir} setFontSizeDir={setFontSizeDir} fontSizePercent={fontSizePercent} setFontSizePercent={setFontSizePercent} />
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
                <details open className="group rounded-xl border border-gray-200 bg-white">
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
                      {(mode.specialUI === 'text-replace' || mode.specialUI === 'text-translate') && model === 'Nano Banana' && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          文字编辑任务建议选择 <strong className="font-semibold">Nano Banana 2</strong> 或 <strong className="font-semibold">Pro</strong>
                        </p>
                      )}
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

                {/* 积分预估提示 */}
                <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                  <span className="text-xs text-gray-500">本次预计消耗</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                    <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3 3.25a.75.75 0 001.1 0l3-3.25a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
                    </svg>
                    {getPointsEstimate(model, clarity)} 积分
                  </span>
                </div>

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
                    {lastPointsUsed != null && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                        <svg className="h-3.5 w-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm.75 4.75a.75.75 0 00-1.5 0v3.5l-1.72 1.72a.75.75 0 001.06 1.06l2-2a.75.75 0 00.22-.53V6.75z" />
                        </svg>
                        本次消耗 <span className="font-semibold text-gray-700">{lastPointsUsed}</span> 积分，已自动保存至仓库
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
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

      {textExtractModal.open && selectedMode === 'text-replace' && getImageForSlot(0) && (
        <ImageTextSelector
          imageSrc={getImageForSlot(0).dataUrl}
          onExtract={(text) => setTextOriginal(text)}
          onCancel={() => setTextExtractModal({ open: false })}
        />
      )}
      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt="图片预览"
        onClose={() => setLightbox((p) => ({ ...p, open: false }))}
      />

      {/* 图库选取弹窗 */}
      {galleryPicker.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">从图库选取图片</h3>
              <button
                type="button"
                onClick={() => setGalleryPicker((p) => ({ ...p, open: false }))}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">加载中…</div>
              ) : galleryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-sm text-gray-400 gap-2">
                  <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  图库暂无图片
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryItems.map((item) => (
                    <GalleryThumb
                      key={item.id}
                      url={item.url}
                      title={item.title}
                      token={getToken()}
                      onClick={() => handlePickFromGallery(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
