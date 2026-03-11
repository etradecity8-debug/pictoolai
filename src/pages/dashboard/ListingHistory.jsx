import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { buildAmazonListingCsv, downloadAmazonListingCsv } from '../../lib/exportAmazonListingCsv'

/** 带认证加载的仓库图片，用于 Listing 详情中显示关联的主图 / A+ 图 */
function AuthGalleryImage({ id, token, alt, className }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const urlRef = useRef(null)
  useEffect(() => {
    if (!id || !token) return
    let cancelled = false
    fetch(`/api/gallery/image/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setBlobUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [id, token])
  if (!blobUrl) return <div className={className || 'w-24 h-24 rounded-lg bg-gray-100 animate-pulse'} />
  return <img src={blobUrl} alt={alt || ''} className={className || 'w-24 h-24 object-contain rounded-lg border border-gray-200 bg-white'} />
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

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这条 Listing 吗？')) return
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/ai-assistant/amazon/listings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '删除失败')
      if (detail?.id === id) setDetail(null)
      fetchList()
    } catch (e) {
      setError(e.message || '删除失败')
    }
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
              <div
                key={item.id}
                className={`group flex items-stretch gap-1 rounded-lg border text-sm transition ${
                  detail?.id === item.id
                    ? 'border-gray-800 bg-gray-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => openDetail(item.id)}
                  className={`flex-1 min-w-0 text-left px-3 py-2.5 ${detail?.id === item.id ? 'text-gray-900 font-medium' : 'text-gray-700'}`}
                >
                  <span className="block truncate">{item.name || item.titlePreview || '未命名'}</span>
                  <span className="text-xs text-gray-400 mt-0.5 block">{dateLabel(item.createdAt)}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                  title="删除"
                  className="shrink-0 px-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            {detailLoading && <p className="text-sm text-gray-500">加载中…</p>}
            {detail && !detailLoading && (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">{dateLabel(detail.createdAt)}</span>
                  <div className="flex items-center gap-2">
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
                    <button
                      type="button"
                      onClick={() => handleDelete(detail.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
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
                {(() => {
                  const pids = detail.productImageIds
                  const hasProduct = pids && ((pids.mainImageIds && pids.mainImageIds.length) || (pids.sceneImageIds && pids.sceneImageIds.length) || (pids.closeUpImageIds && pids.closeUpImageIds.length) || (pids.sellingPointImageIds && pids.sellingPointImageIds.length))
                  const hasLegacyMain = !hasProduct && detail.mainImageId
                  const hasAplus = detail.aplusImageIds && detail.aplusImageIds.length > 0
                  if (!hasProduct && !hasLegacyMain && !hasAplus) return null
                  return (
                    <div className="pt-2 border-t border-gray-200">
                      <label className="block text-xs font-medium text-gray-500 mb-2">关联图片</label>
                      <p className="text-xs text-gray-500 mb-2">保存时已关联的产品图与 A+ 图片（原图在「仓库」中可查看）。</p>
                      <div className="flex flex-wrap gap-4">
                        {pids?.mainImageIds?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">白底主图</p>
                            <div className="flex flex-wrap gap-2">
                              {pids.mainImageIds.map((gid, i) => (
                                <AuthGalleryImage key={gid} id={gid} token={getToken()} alt={`主图${i + 1}`} className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white" />
                              ))}
                            </div>
                          </div>
                        )}
                        {pids?.sceneImageIds?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">场景图</p>
                            <div className="flex flex-wrap gap-2">
                              {pids.sceneImageIds.map((gid, i) => (
                                <AuthGalleryImage key={gid} id={gid} token={getToken()} alt={`场景图${i + 1}`} className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white" />
                              ))}
                            </div>
                          </div>
                        )}
                        {pids?.closeUpImageIds?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">特写图</p>
                            <div className="flex flex-wrap gap-2">
                              {pids.closeUpImageIds.map((gid, i) => (
                                <AuthGalleryImage key={gid} id={gid} token={getToken()} alt={`特写图${i + 1}`} className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white" />
                              ))}
                            </div>
                          </div>
                        )}
                        {pids?.sellingPointImageIds?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">卖点图</p>
                            <div className="flex flex-wrap gap-2">
                              {pids.sellingPointImageIds.map((gid, i) => (
                                <AuthGalleryImage key={gid} id={gid} token={getToken()} alt={`卖点图${i + 1}`} className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white" />
                              ))}
                            </div>
                          </div>
                        )}
                        {hasLegacyMain && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">产品主图</p>
                            <AuthGalleryImage id={detail.mainImageId} token={getToken()} alt="主图" className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white" />
                          </div>
                        )}
                        {hasAplus && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">A+ 图片</p>
                            <div className="flex flex-wrap gap-2">
                              {detail.aplusImageIds.map((gid, i) => (
                                <AuthGalleryImage key={gid} id={gid} token={getToken()} alt={`A+ ${i + 1}`} className="w-24 h-24 object-contain rounded-lg border border-gray-200 bg-white" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
