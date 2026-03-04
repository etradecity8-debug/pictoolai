/**
 * 保存文件时优先使用「另存为」选择路径，避免浏览器默认下载栏出现 localhost 等字样。
 * 支持时用 File System Access API（showSaveFilePicker / showDirectoryPicker），
 * 不支持时回退为创建 <a download> 触发下载。
 */

/**
 * 单文件：弹出「另存为」让用户选择保存路径与文件名（不显示 localhost）
 * @param {Blob} blob
 * @param {string} suggestedName 建议文件名，如 '图片.png'
 * @returns {Promise<void>}
 */
export async function saveBlobWithPicker(blob, suggestedName) {
  if (typeof window !== 'undefined' && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedName || 'image.png',
        types: [{ description: 'PNG 图片', accept: { 'image/png': ['.png'] } }],
      })
      const w = await handle.createWritable()
      await w.write(blob)
      await w.close()
      return
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName || 'image.png'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 多文件：弹出「选择文件夹」让用户选择保存目录，将所有文件写入该目录
 * @param {{ blob: Blob, name: string }[]} files
 * @returns {Promise<void>}
 */
export async function saveBlobsToFolder(files) {
  if (typeof window !== 'undefined' && window.showDirectoryPicker && files.length > 0) {
    try {
      const dirHandle = await window.showDirectoryPicker()
      for (const { blob, name } of files) {
        const safeName = (name || 'image').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.png'
        const fileHandle = await dirHandle.getFileHandle(safeName, { create: true })
        const w = await fileHandle.createWritable()
        await w.write(blob)
        await w.close()
      }
      return
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  for (let i = 0; i < files.length; i++) {
    const { blob, name } = files[i]
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (name || '图片').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.png'
    a.click()
    URL.revokeObjectURL(url)
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 300))
  }
}
