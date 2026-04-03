/** 将 data URL 转为与「本地上传」一致的 { file, dataUrl }（object URL） */
export async function dataUrlToImageSlot(dataUrl, filename = 'from-extension.jpg') {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
  const objectUrl = URL.createObjectURL(file)
  return { file, dataUrl: objectUrl }
}
