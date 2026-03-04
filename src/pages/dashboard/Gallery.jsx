import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function Gallery() {
  const { getToken } = useAuth()
  const [items, setItems] = useState([])
  const [blobUrls, setBlobUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
      })
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [getToken])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 用 token 拉取每张图片为 blob，生成可显示的 URL
  useEffect(() => {
    const token = getToken()
    if (!token || items.length === 0) return
    const controller = new AbortController()
    blobUrlsRef.current = {}
    items.forEach((item) => {
      fetch(item.url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          blobUrlsRef.current[item.id] = url
          setBlobUrls((prev) => ({ ...prev, [item.id]: url }))
        })
        .catch(() => {})
    })
    return () => {
      controller.abort()
      Object.values(blobUrlsRef.current).forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = {}
    }
  }, [items, getToken])

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
        if (blobUrls[id]) {
          URL.revokeObjectURL(blobUrls[id])
          setBlobUrls((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      })
      .catch(() => setError('删除失败'))
  }

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">仓库</h1>
      <p className="mt-2 text-gray-500">您保存的图片保存在服务器，可在此下载或移除</p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16 text-center">
          <p className="text-gray-500">暂无已保存的图片</p>
          <p className="mt-1 text-sm text-gray-400">在全品类组图生成完成后，点击「保存到仓库」即可在此查看</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col"
            >
              {blobUrls[item.id] ? (
                <img
                  src={blobUrls[item.id]}
                  alt={item.title}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-200 flex items-center justify-center text-gray-400 text-sm">
                  加载中…
                </div>
              )}
              <div className="p-3 flex-1 flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700 truncate" title={item.title}>
                  {item.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {blobUrls[item.id] && (
                    <a
                      href={blobUrls[item.id]}
                      download={(item.title || '图片').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.png'}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      下载
                    </a>
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
      )}
    </div>
  )
}
