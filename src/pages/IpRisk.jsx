import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useAuth } from '../context/AuthContext'

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
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

const QUICK_DIMS = [
  { icon: '🤖', label: 'AI 图像分析', tool: 'Google Gemini', cost: '免费', detail: '商标/Logo 识别、外观设计相似性、IP 角色/图案识别、平台合规风险' },
]
const DEEP_DIMS = [
  { icon: '🔍', label: '以图搜图 + 来源溯源', tool: 'Google Lens', cost: '深度查询共 20 积分', detail: '整网检索外观相似商品，并追踪图片最早出现的来源网站，判断外观侵权与图片版权溯源' },
  { icon: '📋', label: '专利检索', tool: 'Google Patents、专利汇', cost: '同上', detail: 'Google Patents 检索美国专利库；专利汇检索中国及全球专利库（已配置时）。覆盖外观/设计专利，辅助判断专利侵权风险' },
  { icon: '™️', label: '商标检索', tool: 'Google 搜索 (USPTO)', cost: '同上', detail: '检索美国商标局相关网页，判断商标/Logo 近似侵权风险' },
  { icon: '🎭', label: 'IP 角色版权检索', tool: 'Google 搜索', cost: '同上', detail: '若 AI 识别到疑似 IP 角色/图案，自动查询该 IP 的版权归属方与知识产权持有人' },
  { icon: '🤖', label: 'AI 综合分析', tool: 'Google Gemini', cost: '同上', detail: '综合上述所有检索结果，生成结构化风险报告（含专利综合风险分析）' },
]

export default function IpRisk() {
  const { user, getToken } = useAuth()
  const [images, setImages] = useState([])
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [targetMarket, setTargetMarket] = useState('')
  const [hints, setHints] = useState('')
  const [mode, setMode] = useState('quick')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    const newOnes = files.map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...newOnes].slice(0, 6))
  }
  const removeImage = (i) => {
    setImages((prev) => prev.filter((_, j) => j !== i))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || !getToken()) { setError('请先登录'); return }
    if (images.length === 0) { setError('请上传至少一张产品图'); return }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const dataUrls = await Promise.all(images.map((item) => fileToCompressedDataUrl(item.file)))
      const res = await fetch('/api/ai-assistant/ip-risk-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          images: dataUrls,
          productName: productName.trim() || undefined,
          category: category.trim() || undefined,
          targetMarket: targetMarket.trim() || undefined,
          hints: hints.trim() || undefined,
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '检测失败')
      setResult(data)
    } catch (err) {
      setError(err.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  const currentDims = mode === 'quick' ? QUICK_DIMS : DEEP_DIMS

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页头 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">侵权风险检测</h1>
          <p className="text-sm text-gray-500 mt-0.5">上传产品图与说明，AI 分析商标/专利/外观设计/IP 形象/图片版权风险，出具结构化分组报告（深度查询含 Google Patents + 专利汇 多库专利检索）</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          {/* 分析维度说明面板 */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">本次将从以下维度分析</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${mode === 'quick' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {mode === 'quick' ? '免费快筛' : '深度查询 · 20 积分'}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {currentDims.map((d, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0">{d.icon}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-gray-800">{d.label}</span>
                      <span className="text-xs text-gray-500">使用：{d.tool}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{d.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 多图上传 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">产品图片（1～6 张）</label>
              <div className="flex flex-wrap gap-3">
                {images.map((item, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length < 6 && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 cursor-pointer text-sm">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} multiple />
                    添加
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">产品名称（选填）</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="如：蓝牙耳机 TWS-X1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">品类（选填）</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="如：消费电子"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标市场（选填）</label>
              <input
                type="text"
                value={targetMarket}
                onChange={(e) => setTargetMarket(e.target.value)}
                placeholder="如：美国亚马逊、eBay"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">其他说明（选填）</label>
              <textarea
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                placeholder="如：自有品牌、是否有 Logo、担心与某品牌相似等"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* 模式选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">检测模式</label>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="radio" name="ipRiskMode" value="quick" checked={mode === 'quick'} onChange={() => setMode('quick')} className="mt-1 shrink-0" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium whitespace-nowrap">免费快筛</span>
                    <span className="text-xs text-gray-500">仅 AI 分析，不扣积分</span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="radio" name="ipRiskMode" value="deep" checked={mode === 'deep'} onChange={() => setMode('deep')} className="mt-1 shrink-0" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium whitespace-nowrap">深度查询</span>
                    <span className="text-xs text-gray-500">联网检索（Lens + 专利（美+中/全球）+ 商标 + IP 角色），消耗 20 积分</span>
                  </span>
                </label>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || images.length === 0}
              className="w-full py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed bg-gray-900 text-white hover:bg-gray-700"
            >
              {loading ? '分析中…' : '生成侵权风险报告'}
            </button>
          </form>

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">侵权风险报告</h3>
                {result.mode === 'deep' && (
                  <span className="text-xs text-amber-600">深度查询 · 已消耗 {result.pointsUsed ?? 10} 积分{result.newBalance != null ? ` · 剩余 ${result.newBalance}` : ''}</span>
                )}
              </div>

              {result.mode === 'deep' && result.searchSummary && result.searchSummary.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-800">本次深度查询使用的检索方式</h4>
                    <p className="text-xs text-gray-500 mt-0.5">以下为系统实际执行的检索及用途说明，便于您理解报告依据</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 font-medium text-gray-700 min-w-[140px]">检索方式（使用服务）</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-700">检索内容</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-700 min-w-[200px]">用途说明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.searchSummary.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-gray-800">{row.method}</span>
                              {row.service && <span className="text-gray-500 ml-1">（{row.service}）</span>}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">{row.content}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.purpose}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.mode === 'deep' && result.retrievalDetails && result.retrievalDetails.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-800">检索结果明细（按来源）</h4>
                    <p className="text-xs text-gray-500 mt-0.5">各查询实际返回的结果，便于区分来自 Google Patents（美国专利）与专利汇（中国+全球专利）等不同来源</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {result.retrievalDetails.map((item, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-800">{item.method}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{item.service}</span>
                          <span className="text-xs text-gray-500">检索词：{item.query}</span>
                        </div>
                        <ul className="text-xs text-gray-600 space-y-1 ml-0">
                          {item.results?.length ? (
                            item.results.map((r, j) => (
                              <li key={j} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                {r.link ? (
                                  <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate max-w-md">
                                    {r.title || '（无标题）'}
                                  </a>
                                ) : (
                                  <span>{r.title || '（无标题）'}</span>
                                )}
                                {r.id && <span className="text-gray-400">({r.id})</span>}
                                {r.applicant && <span className="text-gray-400">— {r.applicant}</span>}
                              </li>
                            ))
                          ) : (
                            <li className="text-gray-400">
                              {item.emptyReason ? `（${item.emptyReason}）` : '（无结果）'}
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.mode === 'quick' && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">本次分析依据：</span>
                  Google Gemini AI 图像理解（免费）· 分析维度：商标/Logo、外观设计、IP 角色/图案、平台合规。如需专利（Google Patents + 专利汇）、商标、图片来源溯源等联网检索，请选择「深度查询」（20 积分）。
                </div>
              )}

              {result.sections ? (
                <div className="grid gap-4">
                  {[
                    { key: 'trademarkRisk', title: '商标 / Logo 风险' },
                    { key: 'patentRisk', title: '专利综合风险' },
                    { key: 'designRisk', title: '外观设计风险' },
                    { key: 'ipImageRisk', title: 'IP 形象 / 版权风险' },
                    { key: 'copyrightSourceRisk', title: '图片版权溯源' },
                    { key: 'platformRisk', title: '平台合规风险' },
                    { key: 'overallLevel', title: '综合风险等级' },
                    { key: 'suggestions', title: '建议' },
                    { key: 'disclaimer', title: '免责声明' },
                  ].map(({ key, title }) => {
                    const content = result.sections[key]
                    if (!content) return null
                    const riskMatch = content.match(/^(高|中高|中|中低|低)([。、\s\-—]*)/)
                    const level = riskMatch ? riskMatch[1] : null
                    const restContent = riskMatch ? content.slice(riskMatch[0].length).trim() : content
                    const isHigh = level === '高'
                    return (
                      <div key={key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-800">
                            {title}
                            {level && (
                              <span className={`ml-2 font-medium ${isHigh ? 'text-red-600' : 'text-gray-600'}`}>
                                {isHigh && (
                                  <svg className="inline-block w-4 h-4 mr-0.5 -mt-0.5 align-middle text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {level}
                              </span>
                            )}
                          </h4>
                        </div>
                        <div className="p-4 prose prose-sm max-w-none text-gray-700">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{level ? (restContent || '—') : content}</ReactMarkdown>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="p-5 prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>{result.report || ''}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
