import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { saveBlobWithPicker } from '../lib/saveFileWithPicker'

// ── 常量 ──────────────────────────────────────────────────────────
const POINTS_PER_IMAGE = { 'Nano Banana 2': 3, 'Nano Banana Pro': 3, 'Nano Banana': 3 }
const MODEL_OPTIONS = ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']

const LANGUAGE_OPTIONS = [
  { value: 'English',    label: '英文',   hint: '美国 / 英国 / 加拿大站' },
  { value: 'German',     label: '德文',   hint: '德国站' },
  { value: 'French',     label: '法文',   hint: '法国 / 加拿大站' },
  { value: 'Italian',    label: '意大利文', hint: '意大利站' },
  { value: 'Spanish',    label: '西班牙文', hint: '西班牙 / 墨西哥站' },
  { value: 'Japanese',   label: '日文',   hint: '日本站' },
  { value: 'Chinese',    label: '中文',   hint: '中国站 / 内部使用' },
  { value: 'Dutch',      label: '荷兰文', hint: '荷兰站' },
  { value: 'Swedish',    label: '瑞典文', hint: '瑞典站' },
  { value: 'Polish',     label: '波兰文', hint: '波兰站' },
]

const STYLE_OPTIONS = [
  { id: 'minimal',   label: '白底简洁', desc: '白色/浅灰棚拍，适合 3C / 家电 / 工具' },
  { id: 'lifestyle', label: '场景生活', desc: '温暖居家场景，适合家居 / 母婴 / 食品' },
  { id: 'luxury',    label: '高端黑金', desc: '深色暗调戏剧光，适合美妆 / 奢品 / 珠宝' },
]

const STEPS = [
  { id: 1, label: '填写信息' },
  { id: 2, label: '确认文案' },
  { id: 3, label: '生成图片' },
  { id: 4, label: '查看结果' },
]

// ── 工具函数 ──────────────────────────────────────────────────────
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text) } catch (_) {}
}

async function downloadDataUrl(dataUrl, filename) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  await saveBlobWithPicker(blob, filename)
}

// ── 步骤指示器 ────────────────────────────────────────────────────
function StepBar({ currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-0 flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition ${
              currentStep > s.id ? 'bg-gray-800 text-white' :
              currentStep === s.id ? 'bg-gray-800 text-white ring-4 ring-gray-200' :
              'bg-gray-200 text-gray-400'
            }`}>
              {currentStep > s.id ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : s.id}
            </div>
            <span className={`text-[11px] whitespace-nowrap ${currentStep === s.id ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 mb-4 transition ${currentStep > s.id ? 'bg-gray-800' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── 可复制文字 ────────────────────────────────────────────────────
function CopyableText({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={handle}
      title="点击复制"
      className={`group relative text-left hover:bg-amber-50 rounded px-1 -mx-1 transition ${className}`}
    >
      {text}
      <span className="ml-1.5 opacity-0 group-hover:opacity-100 transition text-gray-400">
        {copied ? '✓' : '⎘'}
      </span>
      {copied && <span className="absolute -top-5 left-0 text-[10px] text-green-600 bg-white border border-green-200 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">已复制</span>}
    </button>
  )
}

// ── 结果模块：图片 + 对应文案 ─────────────────────────────────────
function ResultModule({ index, title, sizeHint, image, copyFields, brand, onDownload }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* 模块头 */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-800">模块 {index} — {title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{sizeHint}</p>
        </div>
        {image && (
          <button
            type="button"
            onClick={onDownload}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载图片
          </button>
        )}
      </div>

      {/* 图片 + 文案左右布局 */}
      <div className="flex flex-col md:flex-row gap-0">
        {/* 图片 */}
        <div className="md:w-1/2 bg-gray-100 flex items-center justify-center min-h-[200px]">
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" />
          ) : (
            <p className="text-xs text-gray-400">图片生成中...</p>
          )}
        </div>

        {/* 文案 */}
        <div className="md:w-1/2 p-5 space-y-3 border-t md:border-t-0 md:border-l border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">对应文案（点击复制）</p>
          {copyFields.map((field, i) => (
            <div key={i}>
              <p className="text-[11px] text-gray-400 mb-0.5">{field.label}</p>
              <CopyableText
                text={field.value}
                className="text-sm text-gray-800 leading-relaxed block w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────
export default function AmazonAPlus() {
  const { getToken, refreshUser = null } = useAuth()

  // Step 1 输入
  const [brand, setBrand]     = useState('')
  const [product, setProduct] = useState('')
  const [features, setFeatures] = useState(['', '', ''])
  const [story, setStory]     = useState('')
  const [language, setLanguage] = useState('English')
  const [style, setStyle]     = useState('minimal')
  const [model, setModel]     = useState('Nano Banana 2')
  const [productImageFile, setProductImageFile] = useState(null)
  const [productImagePreview, setProductImagePreview] = useState(null)
  const fileRef = useRef()

  // Step 2 文案（可编辑）
  const [copy, setCopy] = useState(null)
  // copy shape: { heroTagline, heroSubtext, features:[{title,desc}], brandStoryTitle, brandStoryBody }

  // Step 4 结果
  const [heroImage, setHeroImage]       = useState(null)
  const [featureImages, setFeatureImages] = useState([null, null, null])
  const [lastPointsUsed, setLastPointsUsed] = useState(null)

  const [step, setStep]   = useState(1)
  const [busy, setBusy]   = useState(false)
  const [busyMsg, setBusyMsg] = useState('')
  const [error, setError] = useState('')

  const pointsEst = (POINTS_PER_IMAGE[model] || 3) * 4

  // ── 文件上传 ─────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setProductImageFile(file)
    setProductImagePreview(URL.createObjectURL(file))
  }

  const canAnalyze = brand.trim() && product.trim() && features.every((f) => f.trim())

  // ── Step 1 → Step 2：生成文案 ────────────────────────────────────
  const handleAnalyze = async () => {
    if (!canAnalyze) return
    setError('')
    setBusy(true)
    setBusyMsg('AI 正在分析产品信息并生成文案...')
    try {
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/amazon-aplus/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ brand, product, features, story, style, language }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '文案生成失败')
      setCopy(data.copy)
      setStep(2)
    } catch (err) {
      setError(err.message || '文案生成失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  // ── Step 2 → Step 3+4：生成图片 ──────────────────────────────────
  const handleGenerate = async () => {
    setError('')
    setBusy(true)
    setBusyMsg('正在生成 Hero 横幅 + 3 张特点图（约 30–60 秒）...')
    setStep(3)
    try {
      let productImageDataUrl = null
      if (productImageFile) productImageDataUrl = await fileToDataUrl(productImageFile)

      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/amazon-aplus/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ brand, product, features, copy, productImage: productImageDataUrl, style, model, language }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '图片生成失败')

      setHeroImage(data.heroImage || null)
      setFeatureImages(data.featureImages || [null, null, null])
      if (data.pointsUsed != null) setLastPointsUsed(data.pointsUsed)
      if (refreshUser) refreshUser()
      setStep(4)
    } catch (err) {
      setError(err.message || '图片生成失败，请稍后重试')
      setStep(2)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = () => {
    setStep(1); setCopy(null); setHeroImage(null)
    setFeatureImages([null, null, null]); setLastPointsUsed(null); setError('')
  }

  // ── 文案字段更新 helper ──────────────────────────────────────────
  const updateCopyField = (key, value) => setCopy((prev) => ({ ...prev, [key]: value }))
  const updateFeatureCopy = (i, key, value) => setCopy((prev) => {
    const feats = [...(prev.features || [])]
    feats[i] = { ...feats[i], [key]: value }
    return { ...prev, features: feats }
  })

  return (
    <div className="min-h-screen bg-gray-100/80">
      {/* 全屏 loading */}
      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-2xl min-w-[320px]">
            <svg className="h-12 w-12 animate-spin text-gray-700" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-semibold text-gray-800 text-center">{busyMsg}</p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-700 rounded-full animate-[slide_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">亚马逊 A+ 页面生成</h1>
          <p className="mt-1 text-sm text-gray-500">填写产品信息 → AI 生成文案供你确认 → 一键生成配套图片</p>
        </div>

        <StepBar currentStep={step} />

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 1：填写信息
        ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
              <h2 className="text-sm font-semibold text-gray-900">产品基本信息</h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">品牌名 <span className="text-red-500">*</span></label>
                  <input className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="例如：Anker" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">产品名称 <span className="text-red-500">*</span></label>
                  <input className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="例如：65W 氮化镓三口充电器" value={product} onChange={(e) => setProduct(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">核心卖点（3 条）<span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <input
                        className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        placeholder={['超快充电，65W 功率，1 小时充满 MacBook', '体积小巧，比信用卡大不了多少', '兼容所有设备，iPhone/Android/笔记本'][i]}
                        value={f}
                        onChange={(e) => { const next = [...features]; next[i] = e.target.value; setFeatures(next) }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">品牌故事（可选）</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  rows={3}
                  placeholder="品牌理念、创立背景或品牌承诺，AI 会用于撰写品牌故事模块"
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                />
              </div>

              {/* 产品参考图 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">产品参考图（可选，AI 生成图片时会参考）</label>
                {productImagePreview ? (
                  <div className="flex items-center gap-3">
                    <img src={productImagePreview} alt="product" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
                    <button type="button" onClick={() => { setProductImagePreview(null); setProductImageFile(null) }}
                      className="text-xs text-red-500 hover:text-red-700">移除</button>
                  </div>
                ) : (
                  <label className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white text-xs text-gray-400 hover:border-gray-400 transition">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    点击上传
                  </label>
                )}
              </div>
            </div>

            {/* 风格 + 语言 + 模型 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">页面风格与输出设置</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {STYLE_OPTIONS.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyle(s.id)}
                    className={`text-left rounded-xl px-4 py-3 border transition ${style === s.id ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                    <span className="text-sm font-medium block">{s.label}</span>
                    <span className={`text-xs ${style === s.id ? 'text-gray-300' : 'text-gray-400'}`}>{s.desc}</span>
                  </button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    文案语言 <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}（{l.hint}）
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">AI 将用所选语言撰写全部文案</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">生图模型（第 3 步使用）</label>
                  <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button type="button" disabled={!canAnalyze} onClick={handleAnalyze}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-3.5 text-sm font-medium text-white hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              生成 A+ 文案
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2：确认文案（可编辑）
        ══════════════════════════════════════════════════════ */}
        {step === 2 && copy && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-800 flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              以下是 AI 生成的文案，你可以直接修改任意字段，确认后再生成配套图片。
            </div>

            {/* Hero 文案 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">模块 1 — Hero 横幅文案</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">主标题</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-400 focus:bg-white focus:outline-none"
                  value={copy.heroTagline || ''} onChange={(e) => updateCopyField('heroTagline', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">副标题</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-gray-400 focus:bg-white focus:outline-none"
                  value={copy.heroSubtext || ''} onChange={(e) => updateCopyField('heroSubtext', e.target.value)} />
              </div>
            </div>

            {/* 三栏特点文案 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">模块 2 — 三栏特点文案</p>
              {(copy.features || []).map((feat, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400">特点 {i + 1}</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">标题</label>
                    <input className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-gray-400 focus:outline-none"
                      value={feat.title || ''} onChange={(e) => updateFeatureCopy(i, 'title', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">描述</label>
                    <textarea className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none resize-none"
                      rows={3} value={feat.desc || ''} onChange={(e) => updateFeatureCopy(i, 'desc', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>

            {/* 品牌故事文案 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">模块 3 — 品牌故事文案</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">标题</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-400 focus:bg-white focus:outline-none"
                  value={copy.brandStoryTitle || ''} onChange={(e) => updateCopyField('brandStoryTitle', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">正文</label>
                <textarea className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-gray-400 focus:bg-white focus:outline-none resize-none"
                  rows={5} value={copy.brandStoryBody || ''} onChange={(e) => updateCopyField('brandStoryBody', e.target.value)} />
              </div>
            </div>

            {/* 按钮行 */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                ← 返回修改信息
              </button>
              <div className="flex flex-col items-end gap-1">
                <button type="button" onClick={handleGenerate}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700 transition">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  确认文案，生成图片
                </button>
                <p className="text-[11px] text-gray-400">预计消耗 {pointsEst} 积分（4 张图）</p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3：生成中（loading 由全屏遮罩覆盖，此处显示占位）
        ══════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-16 flex flex-col items-center justify-center text-center">
            <svg className="h-12 w-12 animate-spin text-gray-300 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-500">正在生成图片...</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 4：查看结果
        ══════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-5">
            {/* 成功提示 */}
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              A+ 页面生成完成！
              {lastPointsUsed != null && <span>本次消耗 <strong>{lastPointsUsed}</strong> 积分，所有图片已自动保存至仓库。</span>}
            </div>

            {/* 模块 1：Hero 横幅 */}
            <ResultModule
              index={1} title="Hero 横幅" sizeHint="建议尺寸：1464 × 600 px（16:9）"
              image={heroImage}
              copyFields={[
                { label: '主标题', value: copy?.heroTagline || '' },
                { label: '副标题', value: copy?.heroSubtext || '' },
              ]}
              brand={brand}
              onDownload={() => heroImage && downloadDataUrl(heroImage, `aplus-hero-${brand}.jpg`)}
            />

            {/* 模块 2：三栏特点图（每张单独展示） */}
            {(copy?.features || []).map((feat, i) => (
              <ResultModule
                key={i}
                index={`2.${i + 1}`} title={`特点图 ${i + 1}`} sizeHint="建议尺寸：300 × 300 px（1:1）"
                image={featureImages?.[i] || null}
                copyFields={[
                  { label: '标题', value: feat.title || '' },
                  { label: '描述', value: feat.desc || '' },
                ]}
                brand={brand}
                onDownload={() => featureImages?.[i] && downloadDataUrl(featureImages[i], `aplus-feature-${i + 1}-${brand}.jpg`)}
              />
            ))}

            {/* 模块 3：品牌故事（纯文字） */}
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-800">模块 3 — 品牌故事</p>
                <p className="text-[11px] text-gray-400 mt-0.5">纯文字模块，点击文字即可复制，粘贴到卖家后台</p>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-[11px] text-gray-400 mb-1">标题</p>
                  <CopyableText text={copy?.brandStoryTitle || ''} className="text-sm font-semibold text-gray-800 block" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-1">正文</p>
                  <CopyableText text={copy?.brandStoryBody || ''} className="text-sm text-gray-700 leading-relaxed block" />
                </div>
              </div>
            </div>

            {/* 底部操作 */}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                修改文案，重新生成
              </button>
              <button type="button" onClick={handleReset}
                className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition">
                新建 A+ 项目
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
