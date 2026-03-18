/**
 * 从仓库图片 URL 加载为 { file, dataUrl }，供「从仓库选图」或「仓库 → 用AI编辑」带入到 AI 美工页面使用。
 * @param {string} url - 相对路径如 /api/gallery/image/xxx 或绝对 URL（如 COS 签名地址）
 * @param {function} getToken - 获取当前用户 token，相对路径请求时带 Authorization
 * @returns {Promise<{ file: File, dataUrl: string }>}
 */
export function loadImageFromGalleryUrl(url, getToken) {
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
