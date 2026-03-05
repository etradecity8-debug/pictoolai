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
 * 多文件：弹出「选择文件夹」让用户选目录，将所有文件写入该目录。
 * 用户取消或浏览器拒绝（如「含有系统文件」）时抛出，由调用方提示；不做自动下载等后备。
 * @param {{ blob: Blob, name: string }[]} files
 * @returns {Promise<void>}
 */
export async function saveBlobsToFolder(files) {
  if (typeof window === 'undefined' || !window.showDirectoryPicker || files.length === 0) {
    throw new Error('当前环境不支持选择文件夹保存，请逐张点击「下载」')
  }
  const dirHandle = await window.showDirectoryPicker()
  for (const { blob, name } of files) {
    const safeName = (name || 'image').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.png'
    const fileHandle = await dirHandle.getFileHandle(safeName, { create: true })
    const w = await fileHandle.createWritable()
    await w.write(blob)
    await w.close()
  }
}
