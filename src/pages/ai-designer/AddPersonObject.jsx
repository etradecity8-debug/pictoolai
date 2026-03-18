import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ImageLightbox from '../../components/ImageLightbox'
import GalleryThumb from '../../components/GalleryThumb'
import OutputSettings from '../../components/OutputSettings'
import { saveBlobWithPicker } from '../../lib/saveFileWithPicker'
import { getEstimatedPointsForDimensions } from '../../lib/pointsEstimate'
import GeneratingOverlay from '../../components/GeneratingOverlay'
import { loadImageFromGalleryUrl } from '../../lib/loadGalleryImage'

function fileToCompressedDataUrl(file, maxSize = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxSize || h > maxSize) {
        if (w >= h) { h = Math.round((h * maxSize) / w); w = maxSize }
        else { w = Math.round((w * maxSize) / h); h = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

const PERSON_TYPES = [
  { value: 'man', label: '男人' },
  { value: 'woman', label: '女人' },
  { value: 'boy', label: '男孩' },
  { value: 'girl', label: '女孩' },
  { value: 'western-child', label: '欧美小孩' },
  { value: 'asian-child', label: '亚洲小孩' },
  { value: 'elderly', label: '老人' },
  { value: 'young-woman', label: '年轻女性' },
  { value: 'young-man', label: '年轻男性' },
]

const POSITIONS = [
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
  { value: 'center', label: '居中' },
  { value: 'foreground', label: '前景' },
  { value: 'background', label: '背景' },
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
]

const PERSON_TYPE_TO_EN = {
  man: 'adult man',
  woman: 'adult woman',
  boy: 'boy',
  girl: 'girl',
  'western-child': 'Western child',
  'asian-child': 'Asian child',
  elderly: 'elderly person',
  'young-woman': 'young woman',
  'young-man': 'young man',
}

const POSITION_TO_EN = {
  left: 'left side',
  right: 'right side',
  center: 'center',
  foreground: 'foreground',
  background: 'background',
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right',
}

const MAX_PEOPLE = 3
const MAX_OBJECTS = 3

const defaultPerson = () => ({ type: 'woman', position: 'center', customPosition: '' })
const defaultObject = () => ({ mode: 'text', text: '', image: null, position: 'center', customPosition: '' })

export default function AddPersonObject({ initialImageFromGallery }) {
  const { getToken, refreshUser } = useAuth()
  const [baseImage, setBaseImage] = useState(null)
  const [people, setPeople] = useState([]) // 可为空，仅添加物品时不必添加人物
  const [objects, setObjects] = useState([]) // [{ mode, text, image, position, customPosition }]
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: null })
  const [galleryPicker, setGalleryPicker] = useState({ open: false, forBase: false, objectIndex: null })
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 })
  const [model, setModel] = useState('Nano Banana 2')
  const [aspectRatio, setAspectRatio] = useState('1:1 正方形')
  const [clarity, setClarity] = useState('1K 标准')

  useEffect(() => {
    if (!baseImage?.dataUrl) {
      setImageDims({ w: 0, h: 0 })
      return
    }
    const img = new Image()
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setImageDims({ w: 0, h: 0 })
    img.src = baseImage.dataUrl
  }, [baseImage?.dataUrl])

  useEffect(() => {
    if (!initialImageFromGallery?.url || !getToken) return
    loadImageFromGalleryUrl(initialImageFromGallery.url, getToken)
      .then(({ file, dataUrl }) => {
        setBaseImage({ file, dataUrl })
        setResult(null)
        setError('')
      })
      .catch(() => {})
  }, [initialImageFromGallery?.url])

  const estimatedPoints = getEstimatedPointsForDimensions(imageDims.w, imageDims.h)

  const openGallery = (forBase, objectIndex = null) => {
    setGalleryPicker({ open: true, forBase: !!forBase, objectIndex })
    if (galleryItems.length > 0) return
    setGalleryLoading(true)
    getToken() &&
      fetch('/api/gallery', { headers: { Authorization: `Bearer ${getToken()}` } })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => setGalleryItems(data.items || []))
        .finally(() => setGalleryLoading(false))
  }

  const pickFromGallery = async (item) => {
    const wasForBase = galleryPicker.forBase === true
    const objIdx = galleryPicker.objectIndex
    setGalleryPicker((prev) => ({ ...prev, open: false }))
    try {
      const token = getToken()
      const isAbsolute = typeof item.url === 'string' && item.url.startsWith('http')
      const headers = token && !isAbsolute ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(item.url, { headers })
      const blob = await res.blob()
      const file = new File([blob], 'gallery.jpg', { type: blob.type || 'image/jpeg' })
      const dataUrl = URL.createObjectURL(file)
      if (wasForBase) {
        setBaseImage({ file, dataUrl })
      } else if (typeof objIdx === 'number') {
        setObjects((prev) => prev.map((o, i) => (i === objIdx ? { ...o, mode: 'image', image: { file, dataUrl }, text: '' } : o)))
      }
      setResult(null)
      setError('')
    } catch (_) {}
  }

  const addPerson = () => {
    if (people.length >= MAX_PEOPLE) return
    setPeople((prev) => [...prev, defaultPerson()])
  }

  const removePerson = (index) => {
    setPeople((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePerson = (index, field, value) => {
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const addObject = () => {
    if (objects.length >= MAX_OBJECTS) return
    setObjects((prev) => [...prev, defaultObject()])
  }

  const removeObject = (index) => {
    setObjects((prev) => prev.filter((_, i) => i !== index))
  }

  const updateObject = (index, field, value) => {
    setObjects((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  }

  const getPositionDesc = (position, customPosition) => {
    const custom = (customPosition || '').trim()
    if (custom) return custom
    return POSITION_TO_EN[position] || position
  }

  const buildPrompt = () => {
    const parts = []
    if (people.length > 0) {
      const personPhrases = people.map((p) => {
        const typeEn = PERSON_TYPE_TO_EN[p.type] || p.type
        const posDesc = getPositionDesc(p.position, p.customPosition)
        return `a ${typeEn} at ${posDesc}`
      })
      parts.push('Add these people naturally (matching lighting, perspective, and natural human scale): ' + personPhrases.join('; ') + '.')
    }
    const imageObjects = objects.filter((o) => o.mode === 'image' && o.image)
    const textObjects = objects.filter((o) => o.mode === 'text' && (o.text || '').trim())
    textObjects.forEach((o) => {
      const posDesc = getPositionDesc(o.position, o.customPosition)
      parts.push(`Add this object at ${posDesc}: "${(o.text || '').trim()}".`)
    })
    imageObjects.forEach((o, idx) => {
      const posDesc = getPositionDesc(o.position, o.customPosition)
      const imageNum = 2 + idx
      parts.push(`Place the product from image ${imageNum} at ${posDesc}.`)
    })
    if (parts.length === 0) return ''
    const hasImageObjects = imageObjects.length > 0
    let prefix = 'This is the base photo. '
    if (hasImageObjects) {
      prefix = 'The first image is the background scene. '
      imageObjects.forEach((_, idx) => {
        prefix += `Image ${2 + idx} is a product to add. `
      })
    }
    const scaleRule =
      ' CRITICAL - Real-world scale: All added objects (e.g. perfume bottle, vase, book) must be at their REAL size relative to the scene. A perfume bottle on a table must be small and hand-sized, not oversized or giant. People must be naturally proportioned. Match existing furniture and objects for scale.'
    return (
      prefix +
      parts.join(' ') +
      ' Output a single photorealistic image. Keep the original scene; only add the requested people/objects. Match lighting and perspective.' +
      scaleRule +
      ' Do not add any text or logos.'
    )
  }

  const handleGenerate = async () => {
    if (!baseImage) {
      setError('请先上传底图')
      return
    }
    const hasPeople = people.length > 0
    const imageObjects = objects.filter((o) => o.mode === 'image' && o.image)
    const textObjects = objects.filter((o) => o.mode === 'text' && (o.text || '').trim())
    const hasAnyObject = imageObjects.length > 0 || textObjects.length > 0
    if (!hasPeople && !hasAnyObject) {
      setError('请至少添加一位人物或一件物品')
      return
    }
    const invalidText = objects.find((o) => o.mode === 'text' && !(o.text || '').trim())
    if (invalidText) {
      setError('请填写要添加的物品描述，或删除该物品')
      return
    }
    const invalidImage = objects.find((o) => o.mode === 'image' && !o.image)
    if (invalidImage) {
      setError('请上传要添加的产品图，或删除该物品')
      return
    }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const baseCompressed = await fileToCompressedDataUrl(baseImage.file)
      const useComposition = imageObjects.length > 0
      const mode = useComposition ? 'composition' : 'add-remove'
      let images = [baseCompressed]
      if (useComposition) {
        for (const o of imageObjects) {
          images.push(await fileToCompressedDataUrl(o.image.file))
        }
      }
      const prompt = buildPrompt()
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/image-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode,
          prompt,
          images,
          model,
          aspectRatio,
          clarity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '生成失败')
      setResult(data.image)
      if (refreshUser) refreshUser()
    } catch (e) {
      setError(e.message || '生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveResult = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      await saveBlobWithPicker(blob, '添加人物_结果.png')
    } catch (e) {
      setError('保存失败')
    }
  }

  return (
    <div className="relative space-y-4 min-h-[240px]">
      <GeneratingOverlay open={generating} message="正在添加人/物..." />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">添加人/物</h1>
        <p className="mt-1.5 text-base text-gray-600">
          在照片上指定添加人物或物品，并选择放置位置
        </p>
      </div>

      {/* 示例对比 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">底图</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-56 h-40">
            <img src="/demo-add-person-object-before.png" alt="底图" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex items-center text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">添加人/物后</p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm w-56 h-40">
            <img src="/demo-add-person-object-after.png" alt="添加后" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* 底图 */}
      <div className="flex flex-wrap gap-2 justify-center">
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          上传底图
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file?.type.startsWith('image/')) return
              setBaseImage({ file, dataUrl: URL.createObjectURL(file) })
              setResult(null)
              setError('')
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => openGallery(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
        >
          从仓库选择
        </button>
      </div>

      {baseImage && (
        <div className="flex justify-center">
          <div className="relative">
            <img
              src={baseImage.dataUrl}
              alt="底图"
              className="max-h-60 rounded-xl border border-gray-200 shadow-sm cursor-pointer"
              onClick={() => setLightbox({ open: true, src: baseImage.dataUrl })}
            />
            <button
              type="button"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
              onClick={() => {
                setBaseImage(null)
                setResult(null)
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {baseImage && (
        <div className="max-w-xl mx-auto space-y-5 bg-white rounded-2xl border border-gray-200 p-5">
          {/* 添加人物 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">添加人物</label>
              {people.length < MAX_PEOPLE && (
                <button
                  type="button"
                  onClick={addPerson}
                  className="text-sm text-primary hover:underline"
                >
                  + 添加一位
                </button>
              )}
            </div>
            <div className="space-y-3">
              {people.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <select
                    value={p.type}
                    onChange={(e) => updatePerson(i, 'type', e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    {PERSON_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">放在</span>
                  <select
                    value={p.position}
                    onChange={(e) => updatePerson(i, 'position', e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    {POSITIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={p.customPosition || ''}
                    onChange={(e) => updatePerson(i, 'customPosition', e.target.value)}
                    placeholder="或输入具体位置，如：沙发上、桌旁"
                    className="flex-1 min-w-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  {people.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePerson(i)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 添加物品 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">添加物品</label>
              {objects.length < MAX_OBJECTS && (
                <button
                  type="button"
                  onClick={addObject}
                  className="text-sm text-primary hover:underline"
                >
                  + 添加一件
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-2">可填写具体位置（如：咖啡桌上、沙发上、小孩手里），物品会按真实比例融入场景。</p>
            <div className="space-y-3">
              {objects.map((obj, i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateObject(i, 'mode', 'text')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${obj.mode === 'text' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50'}`}
                    >
                      文字描述
                    </button>
                    <button
                      type="button"
                      onClick={() => updateObject(i, 'mode', 'image')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${obj.mode === 'image' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50'}`}
                    >
                      上传产品图
                    </button>
                    {objects.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removeObject(i)}
                        className="text-red-500 hover:text-red-700 text-sm ml-auto"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  {obj.mode === 'text' && (
                    <input
                      type="text"
                      value={obj.text || ''}
                      onChange={(e) => updateObject(i, 'text', e.target.value)}
                      placeholder="例：红色抱枕、白色花瓶、一瓶香水"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  )}
                  {obj.mode === 'image' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-200 transition">
                        <span>上传</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file?.type.startsWith('image/')) return
                            setObjects((prev) => prev.map((o, j) => (j === i ? { ...o, image: { file, dataUrl: URL.createObjectURL(file) } } : o)))
                            setResult(null)
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => openGallery(false, i)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                      >
                        从仓库选择
                      </button>
                      {obj.image && (
                        <>
                          <img src={obj.image.dataUrl} alt="产品" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                          <button type="button" onClick={() => updateObject(i, 'image', null)} className="text-red-500 hover:text-red-700 text-sm">移除</button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">位置：</span>
                    <select
                      value={obj.position || 'center'}
                      onChange={(e) => updateObject(i, 'position', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      {POSITIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={obj.customPosition || ''}
                      onChange={(e) => updateObject(i, 'customPosition', e.target.value)}
                      placeholder="如：咖啡桌上、沙发上、小孩手里"
                      className="flex-1 min-w-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <OutputSettings
            model={model}
            aspectRatio={aspectRatio}
            clarity={clarity}
            onModelChange={setModel}
            onAspectRatioChange={setAspectRatio}
            onClarityChange={setClarity}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {generating ? '生成中...' : '生成'}
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}

      {result && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <h3 className="text-lg font-bold text-gray-900">生成结果</h3>
          <img
            src={result}
            alt="结果"
            className="max-h-96 rounded-xl border border-gray-200 shadow-md cursor-pointer"
            onClick={() => setLightbox({ open: true, src: result })}
          />
          <button
            type="button"
            onClick={handleSaveResult}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            保存到本地
          </button>
        </div>
      )}

      {galleryPicker.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setGalleryPicker((prev) => ({ ...prev, open: false }))}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-[680px] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {galleryPicker.forBase ? '选择底图' : '选择产品图'}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-700 text-xl"
                onClick={() => setGalleryPicker((prev) => ({ ...prev, open: false }))}
              >
                ×
              </button>
            </div>
            {galleryLoading ? (
              <div className="text-center py-12 text-gray-400">加载中…</div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">仓库暂无图片</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {galleryItems.map((item) => (
                  <GalleryThumb
                    key={item.id}
                    url={item.url}
                    title={item.title}
                    token={getToken()}
                    onClick={() => pickFromGallery(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        onClose={() => setLightbox({ open: false, src: null })}
      />
    </div>
  )
}
