import { useState, useEffect, useRef } from 'react'

/**
 * 作品库缩略图：用于「从作品库选择」弹窗等。
 * - 绝对 URL（COS 签名）：直接用 img src，不 fetch，加载快且与仓库页一致。
 * - 相对路径（/api/gallery/image/:id）：带 Token fetch 转 blob 再展示。
 */
export default function GalleryThumb({ url, title, token, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const blobUrlRef = useRef(null)
  const isAbsolute = typeof url === 'string' && url.startsWith('http')

  useEffect(() => {
    if (!url || isAbsolute) return
    let revoked = false
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(url, { headers })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        if (revoked) return
        const u = URL.createObjectURL(blob)
        blobUrlRef.current = u
        setBlobUrl(u)
      })
      .catch(() => {})
    return () => {
      revoked = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [url, token, isAbsolute])

  const imgSrc = isAbsolute ? url : blobUrl

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl border-2 border-transparent hover:border-gray-800 transition"
    >
      {imgSrc ? (
        <img src={imgSrc} alt={title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
      ) : (
        <div className="h-full w-full bg-gray-100 animate-pulse" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition">
        <p className="text-[10px] text-white truncate">{title}</p>
      </div>
    </button>
  )
}
