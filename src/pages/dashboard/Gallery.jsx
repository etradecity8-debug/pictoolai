import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { saveBlobWithPicker, saveBlobsToFolder } from '../../lib/saveFileWithPicker'
import ImageLightbox from '../../components/ImageLightbox'

/** 仓库「用AI编辑」可选功能（与 AI 美工侧栏一二级结构一致），选择后跳转并带入当前图片 */
const GALLERY_EDIT_GROUPS = [
  {
    label: '图片编辑',
    items: [
      { id: 'local-redraw', label: '局部重绘' },
      { id: 'local-erase', label: '局部消除' },
      { id: 'one-click-recolor', label: '一键换色' },
      { id: 'clothing-3d', label: '服装3D' },
      { id: 'clothing-flatlay', label: '服装平铺' },
      { id: 'body-shape', label: '调整身材' },
      { id: 'scene-generation', label: '生成场景' },
      { id: 'add-person-object', label: '添加人/物' },
    ],
  },
  {
    label: '质量提升',
    items: [
      { id: 'smart-expansion', label: '智能扩图' },
      { id: 'product-refinement', label: '提升质感' },
    ],
  },
  {
    label: '文字修改',
    items: [
      { id: 'text-replace', label: '文字替换' },
      { id: 'text-translate', label: '语言转换' },
      { id: 'text-remove', label: '文字去除' },
    ],
  },
  {
    label: '风格变迁',
    items: [
      { id: 'style-clone', label: '风格复刻' },
      { id: 'style-change', label: '风格改变' },
    ],
  },
  {
    label: '水印添加/去除',
    items: [
      { id: 'watermark-add', label: '添加水印' },
    ],
  },
  {
    label: '官方示例',
    items: [
      { id: 'add-remove', label: '添加/移除元素' },
      { id: 'inpainting', label: '局部重绘(语义)' },
      { id: 'style-transfer', label: '风格迁移' },
      { id: 'composition', label: '高级合成' },
      { id: 'hi-fidelity', label: '高保真细节保留' },
      { id: 'bring-to-life', label: '让草图变生动' },
      { id: 'character-360', label: '角色一致性360°' },
    ],
  },
]

/** 按 savedAt 时间戳得到日期键 YYYY-MM-DD */
function dateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 日期键转展示文案：今天、昨天、或 3月5日 / 2026年3月5日 */
function dateLabel(key) {
  const today = dateKey(Date.now())
  if (key === today) return '今天'
  const yesterday = dateKey(Date.now() - 864e5)
  if (key === yesterday) return '昨天'
  const [y, m, d] = key.split('-')
  const month = parseInt(m, 10)
  const day = parseInt(d, 10)
  const thisYear = new Date().getFullYear().toString()
  if (y === thisYear) return `${month}月${day}日`
  return `${y}年${month}月${day}日`
}

/** 将列表按日期分组，键为 YYYY-MM-DD，按日期倒序 */
function groupByDate(items) {
  const map = {}
  items.forEach((item) => {
    const key = dateKey(item.savedAt || 0)
    if (!map[key]) map[key] = []
    map[key].push(item)
  })
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, items: map[key] }))
}

export default function Gallery() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [items, setItems] = useState([])
  const [blobUrls, setBlobUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [lightbox, setLightbox] = useState({ open: false, src: null, alt: '' })
  const [editModalItem, setEditModalItem] = useState(null) // 点击「用AI编辑」时暂存的图片项
  const [loadErrors, setLoadErrors] = useState({}) // 某 id 拉图失败时为 true，用于显示「加载失败」与重试
  const blobUrlsRef = useRef({})

  const fetchList = useCallback(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      setError('请先登录')
      return
    }
    setLoading(true)
    setError('')
    fetch('/api/gallery', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('获取失败'))))
      .then((data) => {
        setItems(data.items || [])
        setSelectedIds(new Set())
      })
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [getToken])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 绝对 URL（COS 签名）直接用作展示，避免 fetch 跨域；相对路径用 token 拉取为 blob
  useEffect(() => {
    const token = getToken()
    if (!token || items.length === 0) return
    setLoadErrors((prev) => {
      const next = { ...prev }
      items.forEach((i) => delete next[i.id])
      return next
    })
    const controller = new AbortController()
    blobUrlsRef.current = {}
    const absoluteUpdates = {}
    items.forEach((item) => {
      const isAbsolute = typeof item.url === 'string' && item.url.startsWith('http')
      if (isAbsolute) {
        absoluteUpdates[item.id] = item.url
        return
      }
      fetch(item.url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.blob()
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          blobUrlsRef.current[item.id] = url
          setBlobUrls((prev) => ({ ...prev, [item.id]: url }))
        })
        .catch((e) => {
          console.error('[仓库] 拉图失败', item.id, item.url, e?.message || e)
          setLoadErrors((prev) => ({ ...prev, [item.id]: true }))
        })
    })
    if (Object.keys(absoluteUpdates).length) setBlobUrls((prev) => ({ ...prev, ...absoluteUpdates }))
    return () => {
      controller.abort()
      Object.values(blobUrlsRef.current).forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = {}
    }
  }, [items, getToken])

  const retryLoad = useCallback(
    (item) => {
      const token = getToken()
      if (!token || typeof item.url !== 'string' || item.url.startsWith('http')) return
      setLoadErrors((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      fetch(item.url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.blob()
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          blobUrlsRef.current[item.id] = url
          setBlobUrls((prev) => ({ ...prev, [item.id]: url }))
        })
        .catch((e) => {
          console.error('[仓库] 重试拉图失败', item.id, e?.message || e)
          setLoadErrors((prev) => ({ ...prev, [item.id]: true }))
        })
    },
    [getToken]
  )

  const removeFromGallery = (id) => {
    const token = getToken()
    if (!token) return
    fetch(`/api/gallery/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(() => {
        setItems((prev) => prev.filter((i) => i.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (blobUrls[id] && blobUrls[id].startsWith('blob:')) {
          URL.revokeObjectURL(blobUrls[id])
        }
        setBlobUrls((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      })
      .catch(() => setError('删除失败'))
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size >= items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  /** 批量删除选中的图片 */
  const batchDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const token = getToken()
    if (!token) return
    setError('')
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/gallery/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    )
    const deleted = ids.filter((_, i) => results[i].status === 'fulfilled' && results[i].value?.ok)
    if (deleted.length > 0) {
      setItems((prev) => prev.filter((i) => !deleted.includes(i.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        deleted.forEach((id) => next.delete(id))
        return next
      })
      deleted.forEach((id) => {
        if (blobUrls[id] && blobUrls[id].startsWith('blob:')) {
          URL.revokeObjectURL(blobUrls[id])
        }
      })
      setBlobUrls((prev) => {
        const next = { ...prev }
        deleted.forEach((id) => delete next[id])
        return next
      })
    }
    if (deleted.length < ids.length) setError('部分删除失败，请重试')
  }, [selectedIds, getToken, blobUrls])

  /** 批量保存：弹出「选择文件夹」，将选中图片写入客户所选目录（统一走后端接口，避免 COS 跨域） */
  const batchDownload = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const token = getToken()
    if (!token) return
    const files = []
    ids.forEach((id, index) => {
      const item = items.find((i) => i.id === id)
      if (!item || !blobUrls[id]) return
      const base = (item.title || '图片').replace(/[^\w\u4e00-\u9fa5-]/g, '_')
      files.push({ id, name: ids.length > 1 ? `${base}_${index + 1}` : base })
    })
    const blobs = await Promise.all(
      files.map(async (f) => {
        try {
          const res = await fetch(`/api/gallery/image/${f.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) return null
          const blob = await res.blob()
          return { blob, name: f.name }
        } catch (_) {
          return null
        }
      })
    )
    const valid = blobs.filter(Boolean)
    if (valid.length === 0) return
    setError('')
    try {
      await saveBlobsToFolder(valid)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || '保存失败。如遇「含有系统文件」提示，请另选一个文件夹（例如在文稿内新建空文件夹）')
    }
  }, [selectedIds, items, blobUrls, getToken])

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仓库</h1>
        <p className="mt-2 text-gray-500">您保存的图片将显示在这里</p>
        <div className="mt-8 flex items-center justify-center py-16">
          <p className="text-gray-500">加载中…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仓库</h1>
        <p className="mt-2 text-red-500">{error}</p>
        <button
          type="button"
          onClick={fetchList}
          className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          重试
        </button>
      </div>
    )
  }

  const groups = groupByDate(items)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">仓库</h1>
      <p className="mt-2 text-gray-500">您保存的图片保存在服务器，按日期分组；可多选后批量保存到客户所选文件夹</p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16 text-center">
          <p className="text-gray-500">暂无已保存的图片</p>
          <p className="mt-1 text-sm text-gray-400">生图成功后，图片将自动保存到仓库</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={items.length > 0 && selectedIds.size === items.length}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-gray-800 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">全选</span>
            </label>
            <button
              type="button"
              onClick={batchDownload}
              disabled={selectedIds.size === 0}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              保存选中到本地{selectedIds.size > 0 ? `（${selectedIds.size} 张）` : ''}
            </button>
            <button
              type="button"
              onClick={batchDeleteSelected}
              disabled={selectedIds.size === 0}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除选中{selectedIds.size > 0 ? `（${selectedIds.size} 张）` : ''}
            </button>
          </div>

          <div className="mt-6 space-y-8">
            {groups.map(({ key, items: dayItems }) => (
              <section key={key}>
                <h2 className="text-sm font-semibold text-gray-500 mb-3">{dateLabel(key)}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col"
                    >
                      <div className="relative">
                        <label className="absolute top-2 left-2 z-10 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-gray-300 text-gray-800 focus:ring-gray-500 w-4 h-4"
                          />
                        </label>
                        {blobUrls[item.id] ? (
                          <button
                            type="button"
                            className="block w-full aspect-square overflow-hidden bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset flex items-center justify-center"
                            onClick={() => setLightbox({ open: true, src: blobUrls[item.id], alt: item.title })}
                          >
                            <img
                              src={blobUrls[item.id]}
                              alt={item.title}
                              className="w-full h-full object-contain"
                            />
                          </button>
                        ) : loadErrors[item.id] ? (
                          <div className="w-full aspect-square bg-gray-200 flex flex-col items-center justify-center gap-2 text-gray-500 text-sm p-2">
                            <span>加载失败</span>
                            <button
                              type="button"
                              onClick={() => retryLoad(item)}
                              className="text-primary hover:underline"
                            >
                              点击重试
                            </button>
                          </div>
                        ) : (
                          <div className="w-full aspect-square bg-gray-200 flex items-center justify-center text-gray-400 text-sm">
                            加载中…
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col gap-2">
                        <p className="text-sm font-medium text-gray-700 truncate" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>模型：{item.model || '—'}</span>
                          <span>清晰度：{item.clarity || '—'}</span>
                          {item.pointsUsed != null && <span>{item.pointsUsed} 积分</span>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {blobUrls[item.id] && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditModalItem(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10"
                              >
                                用AI编辑
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const token = getToken()
                                    if (!token) return
                                    const res = await fetch(`/api/gallery/image/${item.id}`, {
                                      headers: { Authorization: `Bearer ${token}` },
                                    })
                                    if (!res.ok) return
                                    const blob = await res.blob()
                                    const name = (item.title || '图片').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.png'
                                    await saveBlobWithPicker(blob, name)
                                  } catch (_) {}
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                下载
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFromGallery(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 text-gray-500 px-2.5 py-1.5 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox((p) => ({ ...p, open: false }))}
      />

      {/* 用AI编辑：选择功能后跳转到对应 AI 美工页面并带入当前图片 */}
      {editModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditModalItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">用 AI 美工编辑</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                onClick={() => setEditModalItem(null)}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">选择要使用的功能，该图片将自动加载到对应编辑界面</p>
            <div className="overflow-y-auto flex-1 space-y-4">
              {GALLERY_EDIT_GROUPS.map((group) => (
                <div key={group.label}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 pl-0.5">
                    {group.label}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          navigate(`/ai-designer/${tool.id}`, {
                            state: {
                              fromGallery: true,
                              imageUrl: editModalItem.url,
                              imageId: editModalItem.id,
                              imageTitle: editModalItem.title || '图片',
                            },
                          })
                          setEditModalItem(null)
                        }}
                        className="text-left px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition"
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
