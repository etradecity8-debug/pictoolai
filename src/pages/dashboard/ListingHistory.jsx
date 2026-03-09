import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { buildAmazonListingCsv, downloadAmazonListingCsv } from '../../lib/exportAmazonListingCsv'

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

function dateLabel(ts) {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return '今天'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

export default function ListingHistory() {
  const { getToken } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchList = useCallback(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      setError('请先登录')
      return
    }
    setLoading(true)
    setError('')
    fetch('/api/ai-assistant/amazon/listings', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('获取失败'))))
      .then((data) => setList(data.list || []))
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [getToken])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openDetail = (id) => {
    const token = getToken()
    if (!token) return
    setDetailLoading(true)
    setDetail(null)
    fetch(`/api/ai-assistant/amazon/listings/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('获取失败'))))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {}).catch(() => {})
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-bold text-gray-900">Listing 历史</h1>
      <p className="text-sm text-gray-500 mt-0.5">从「AI 运营助手 → 亚马逊 → 生成 Listing」保存的记录可在此查看与复制</p>

      {loading && <p className="text-sm text-gray-500 mt-4">加载中…</p>}
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      {!loading && !error && list.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">暂无保存的 Listing，去生成并保存一条吧。</p>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="mt-6 flex gap-6">
          <div className="w-72 shrink-0 space-y-1 max-h-[70vh] overflow-y-auto">
            {list.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetail(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                  detail?.id === item.id
                    ? 'border-gray-800 bg-gray-100 text-gray-900 font-medium'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="block truncate">{item.name || item.titlePreview || '未命名'}</span>
                <span className="text-xs text-gray-400 mt-0.5 block">{dateLabel(item.createdAt)}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            {detailLoading && <p className="text-sm text-gray-500">加载中…</p>}
            {detail && !detailLoading && (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">{dateLabel(detail.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = buildAmazonListingCsv({
                        title: detail.title,
                        searchTerms: detail.searchTerms,
                        bullets: detail.bullets || [],
                        description: detail.description,
                      })
                      downloadAmazonListingCsv(csv, `listing-${detail.id}-export.csv`)
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    导出 CSV
                  </button>
                </div>
                <CopyBlock label="标题" text={detail.title} onCopy={copyToClipboard} markdown />
                <CopyBlock label="后台关键词" text={detail.searchTerms} onCopy={copyToClipboard} />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">五点描述</label>
                  {(detail.bullets || []).map((b, i) => (
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
                <CopyBlock label="产品描述" text={detail.description} onCopy={copyToClipboard} markdown />
                {detail.aplusCopy && (
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-500 mb-1">A+ 文案</label>
                    <p className="text-sm text-gray-700"><strong>Hero:</strong> {detail.aplusCopy.heroTagline}</p>
                    <p className="text-sm text-gray-600">{detail.aplusCopy.heroSubtext}</p>
                    {(detail.aplusCopy.features || []).map((f, i) => (
                      <p key={i} className="text-sm">{f.title}: {f.desc}</p>
                    ))}
                    <p className="text-sm"><strong>{detail.aplusCopy.brandStoryTitle}</strong> {detail.aplusCopy.brandStoryBody}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
