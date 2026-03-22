/**
 * 从仓库图片 ID 加载为 { file, dataUrl }。始终走后端 API，避免 COS 跨域问题。
 * @param {string} id - 仓库图片 id
 * @param {function} getToken - 获取当前用户 token
 * @returns {Promise<{ file: File, dataUrl: string }>}
 */
export function loadImageFromGalleryId(id, getToken) {
  if (!id) return Promise.reject(new Error('无效的图片ID'))
  const token = getToken && getToken()
  if (!token) return Promise.reject(new Error('请先登录'))
  return fetch(`/api/gallery/image/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    })
    .then((blob) => {
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
      return { file, dataUrl }
    })
}

/**
 * 从仓库图片 URL 加载为 { file, dataUrl }，供「仓库 → 用AI编辑」带入到 AI 美工页面使用。
 * 若有 id 优先用 loadImageFromGalleryId 走后端，避免 COS 跨域；否则回退到 fetch url。
 * @param {string} url - 相对路径如 /api/gallery/image/xxx 或绝对 URL（如 COS 签名地址）
 * @param {function} getToken - 获取当前用户 token
 * @param {string} [id] - 若提供，则用 loadImageFromGalleryId 走后端代理
 * @returns {Promise<{ file: File, dataUrl: string }>}
 */
export function loadImageFromGalleryUrl(url, getToken, id) {
  if (id) return loadImageFromGalleryId(id, getToken)
  if (!url || typeof url !== 'string') return Promise.reject(new Error('无效的图片地址'))
  const isAbsolute = url.startsWith('http')
  const token = getToken && getToken()
  const headers = token && !isAbsolute ? { Authorization: `Bearer ${token}` } : {}
  return fetch(url, { headers })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    })
    .then((blob) => {
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
      return { file, dataUrl }
    })
}
