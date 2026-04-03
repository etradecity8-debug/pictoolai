import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  EXT_DOM_IMPORT_EVENT,
  EXT_MSG_SOURCE,
  EXT_MSG_IMPORT,
  EXT_WEB_SOURCE,
  EXT_IMPORT_ACK,
  EXT_REQUEST_IMPORT,
} from '../lib/extensionBridgeConstants'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import LocalRedraw from './ai-designer/LocalRedraw'
import LocalErase from './ai-designer/LocalErase'
import OneClickRecolor from './ai-designer/OneClickRecolor'
import SmartExpansion from './ai-designer/SmartExpansion'
import ProductRefinement from './ai-designer/ProductRefinement'
import Clothing3D from './ai-designer/Clothing3D'
import ClothingFlatlay from './ai-designer/ClothingFlatlay'
import BodyShape from './ai-designer/BodyShape'
import SceneGeneration from './ai-designer/SceneGeneration'
import StyleClone from './StyleClone'
import StyleChange from './ai-designer/StyleChange'
import ImageEdit from './ImageEdit'
import AddWatermark from './ai-designer/AddWatermark'
import AddPersonObject from './ai-designer/AddPersonObject'

const iconClass = 'w-4 h-4 shrink-0'

/** React Strict Mode 会双重挂载：首次 onMessage 已发 ACK 并清空扩展 storage，第二次挂载读不到图；用模块缓存保留本次导入 */
let extensionImportPayloadCache = null

/** 与路由 /ai-designer/:toolId 对齐，去掉尾部 /，避免与扩展 payload.toolId 不一致 */
function toolIdFromPathname(pathname) {
  const s = String(pathname || '')
    .replace(/^\/ai-designer\/?/i, '')
    .replace(/\/$/, '')
    .trim()
  return s || null
}

// 一级分类下为平级子项；修改图片类与 `IMAGE_EDIT_MODE_IDS` 一致
const IMAGE_EDIT_MODE_IDS = [
  'add-remove',
  'inpainting',
  'style-transfer',
  'composition',
  'hi-fidelity',
  'bring-to-life',
  'character-360',
  'text-replace',
  'text-translate',
  'watermark-remove',
]

const AVAILABLE_IDS = new Set([
  'local-redraw',
  'local-erase',
  'one-click-recolor',
  'clothing-3d',
  'clothing-flatlay',
  'body-shape',
  'scene-generation',
  'add-person-object',
  'smart-expansion',
  'product-refinement',
  'style-clone',
  'watermark-add',
  'style-change',
  'text-remove',
  ...IMAGE_EDIT_MODE_IDS,
])

const SIDEBAR_STRUCTURE = [
  {
    id: 'image-editing',
    label: '图片编辑',
    items: [
      { id: 'local-redraw', label: '局部重绘', icon: 'brush' },
      { id: 'local-erase', label: '局部消除', icon: 'eraser' },
      { id: 'one-click-recolor', label: '一键换色', icon: 'recolor' },
      { id: 'clothing-3d', label: '服装3D', badge: 'NEW', icon: 'tshirt' },
      { id: 'clothing-flatlay', label: '服装平铺', badge: 'NEW', icon: 'flatlay' },
      { id: 'body-shape', label: '调整身材', badge: 'NEW', icon: 'body' },
      { id: 'scene-generation', label: '生成场景', badge: 'NEW', icon: 'scene' },
      { id: 'add-person-object', label: '添加人/物', badge: 'NEW', icon: 'person-add' },
    ],
  },
  {
    id: 'quality-enhancement',
    label: '质量提升',
    items: [
      { id: 'smart-expansion', label: '智能扩图', icon: 'expand' },
      { id: 'product-refinement', label: '提升质感', icon: 'product' },
    ],
  },
  {
    id: 'text-modification',
    label: '文字修改',
    items: [
      { id: 'text-replace', label: '文字替换', icon: 'text-replace' },
      { id: 'text-translate', label: '语言转换', icon: 'text-translate' },
      { id: 'text-remove', label: '文字去除', icon: 'eraser' },
    ],
  },
  {
    id: 'style-clone',
    label: '风格变迁',
    items: [
      { id: 'style-clone', label: '风格复刻', icon: 'style-clone' },
      { id: 'style-change', label: '风格改变', icon: 'style-change' },
    ],
  },
  {
    id: 'watermark-tools',
    label: '水印',
    items: [
      { id: 'watermark-add', label: '添加水印', icon: 'watermark-add' },
      { id: 'watermark-remove', label: '去除水印', icon: 'watermark' },
    ],
  },
  {
    id: 'official-demos',
    label: '官方示例',
    items: [
      { id: 'add-remove', label: '添加 / 移除元素', icon: 'add-remove' },
      { id: 'inpainting', label: '局部重绘（语义遮盖）', icon: 'inpaint' },
      { id: 'style-transfer', label: '风格迁移', icon: 'style' },
      { id: 'composition', label: '高级合成：多图组合', icon: 'composition' },
      { id: 'hi-fidelity', label: '高保真细节保留', icon: 'hifi' },
      { id: 'bring-to-life', label: '让草图变生动', icon: 'sketch' },
      { id: 'character-360', label: '角色一致性：360° 全景', icon: 'character' },
    ],
  },
]

function ItemIcon({ name }) {
  const path = name === 'add-remove'
    ? 'M12 4v16m8-8H4'
    : name === 'inpaint'
    ? 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    : name === 'style'
    ? 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
    : name === 'composition'
    ? 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z'
    : name === 'hifi'
    ? 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    : name === 'sketch'
    ? 'M13 10V3L4 14h7v7l9-11h-7z'
    : name === 'character'
    ? 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    : name === 'text-replace'
    ? 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    : name === 'text-translate'
    ? 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129'
    : name === 'watermark'
    ? 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4l6-6m2 5l3 3m-3 3l-6 6m0-6l6 6'
    : name === 'watermark-add'
    ? 'M12 4v16m8-8H4'
    : name === 'edit'
    ? 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    : name === 'brush'
    ? 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01'
    : name === 'eraser'
    ? 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4l6-6m2 5l3 3m-3 3l-6 6m0-6l6 6'
    : name === 'recolor'
    ? 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
    : name === 'tshirt'
    ? 'M6.5 3.5L2 7l3 2v10.5h14V9l3-2-4.5-3.5L15 5h-1a2 2 0 01-4 0H9L6.5 3.5z'
    : name === 'flatlay'
    ? 'M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm3 3h10M7 12h10M7 16h6'
    : name === 'body'
    ? 'M12 2a3 3 0 100 6 3 3 0 000-6zm-4 8a4 4 0 014-4h0a4 4 0 014 4v1a1 1 0 01-1 1h-2l-1 9h-2l-1-9H9a1 1 0 01-1-1v-1z'
    : name === 'person-add'
    ? 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
    : name === 'scene'
    ? 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10'
    : name === 'expand'
    ? 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
    : name === 'product'
    ? 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
    : name === 'style-clone'
    ? 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
    : name === 'style-change'
    ? 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
    : 'M4 6h16M4 10h16M4 14h16M4 18h16'
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

export default function AiDesigner() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { getToken } = useAuth()
  const pathTool = toolIdFromPathname(location.pathname)
  const extMode = searchParams.get('ext') === '1'
  const prepImportId = searchParams.get('import')
  const prepToolId = searchParams.get('tool') || pathTool || 'text-translate'
  const [extImport, setExtImport] = useState(null)
  const lastPrepImportId = useRef(null)
  const lastAppliedExtImportKey = useRef(null)

  useEffect(() => {
    if (!extMode) {
      extensionImportPayloadCache = null
      lastAppliedExtImportKey.current = null
      return
    }
    if (extensionImportPayloadCache) {
      lastAppliedExtImportKey.current = `${extensionImportPayloadCache.ts ?? 0}|${String(extensionImportPayloadCache.dataUrl).slice(0, 80)}`
      setExtImport(extensionImportPayloadCache)
    }
    function applyImportPayload(payload) {
      if (!payload?.dataUrl || !payload?.toolId) return
      const key = `${payload.ts ?? 0}|${String(payload.dataUrl).slice(0, 80)}`
      if (lastAppliedExtImportKey.current === key) return
      lastAppliedExtImportKey.current = key
      extensionImportPayloadCache = payload
      setExtImport(payload)
      window.postMessage({ source: EXT_WEB_SOURCE, type: EXT_IMPORT_ACK }, '*')
    }
    function onDomImport(ev) {
      applyImportPayload(ev.detail)
    }
    function onMsg(ev) {
      if (ev.data?.source !== EXT_MSG_SOURCE || ev.data?.type !== EXT_MSG_IMPORT) return
      applyImportPayload(ev.data.payload)
    }
    window.addEventListener(EXT_DOM_IMPORT_EVENT, onDomImport)
    window.addEventListener('message', onMsg)
    window.postMessage({ source: EXT_WEB_SOURCE, type: EXT_REQUEST_IMPORT }, '*')
    return () => {
      window.removeEventListener(EXT_DOM_IMPORT_EVENT, onDomImport)
      window.removeEventListener('message', onMsg)
    }
  }, [extMode])

  useEffect(() => {
    if (!prepImportId || !getToken) return
    if (lastPrepImportId.current === prepImportId) return
    lastPrepImportId.current = prepImportId
    let cancelled = false
    fetch(`/api/extension/prep-image/${encodeURIComponent(prepImportId)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !data?.image) return
        const ts = Date.now()
        const payload = {
          toolId: prepToolId,
          dataUrl: data.image,
          targetTabId: null,
          targetUuid: null,
          ts,
        }
        lastAppliedExtImportKey.current = `${ts}|${String(data.image).slice(0, 80)}`
        setExtImport(payload)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [prepImportId, prepToolId, getToken])

  const extensionForTool =
    extImport && pathTool && extImport.toolId === pathTool ? extImport : null
  const galleryImage =
    extensionForTool
      ? null
      : location.state?.fromGallery && location.state?.imageUrl
        ? { url: location.state.imageUrl, id: location.state.imageId, title: location.state.imageTitle }
        : null
  const extensionImagePayload = extensionForTool?.dataUrl
    ? { dataUrl: extensionForTool.dataUrl }
    : null
  const extensionMeta =
    extensionForTool?.targetTabId != null && extensionForTool?.targetUuid
      ? { targetTabId: extensionForTool.targetTabId, targetUuid: extensionForTool.targetUuid }
      : null
  const [expanded, setExpanded] = useState(() => {
    const open = new Set()
    const tool = toolIdFromPathname(location.pathname)
    SIDEBAR_STRUCTURE.forEach((group) => {
      const hasActive = group.items.some((it) => it.id === tool)
      if (hasActive) open.add(group.id)
    })
    if (open.size === 0) open.add(SIDEBAR_STRUCTURE[0].id)
    return open
  })

  useEffect(() => {
    if (pathTool) {
      const groupId = SIDEBAR_STRUCTURE.find((g) => g.items.some((it) => it.id === pathTool))?.id
      if (groupId) setExpanded((prev) => new Set([...prev, groupId]))
    }
  }, [pathTool])

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <aside className="w-60 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)] shrink-0">
          <div className="py-3 px-2">
            <nav className="space-y-0.5">
              {SIDEBAR_STRUCTURE.map((group) => {
                const isGroupOpen = expanded.has(group.id)
                const isGroupActive = group.items.some((it) => it.id === pathTool)
                return (
                  <div key={group.id} className="rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isGroupActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{group.label}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isGroupOpen && (
                      <div className="ml-4 mt-0.5 space-y-0.5 pl-2 border-l border-gray-100">
                        {group.items.map((item) => {
                          const to = `/ai-designer/${item.id}`
                          const isActive = pathTool === item.id
                          return (
                            <Link
                              key={item.id}
                              to={to}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                                isActive
                                  ? 'text-primary font-medium bg-primary/5'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              <ItemIcon name={item.icon} />
                              <span>{item.label}</span>
                              {item.badge && (
                                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-6">
          {IMAGE_EDIT_MODE_IDS.includes(pathTool) ? (
            <ImageEdit
              initialMode={pathTool}
              hideModeSelector
              initialImageFromGallery={galleryImage}
              initialExtensionImage={extensionImagePayload}
              extensionMeta={extensionMeta}
            />
          ) : pathTool === 'local-redraw' ? (
            <LocalRedraw
              initialImageFromGallery={galleryImage}
              initialExtensionImage={extensionImagePayload}
              extensionMeta={extensionMeta}
            />
          ) : pathTool === 'local-erase' ? (
            <LocalErase
              initialImageFromGallery={galleryImage}
              initialExtensionImage={extensionImagePayload}
              extensionMeta={extensionMeta}
            />
          ) : pathTool === 'text-remove' ? (
            <LocalErase
              variant="text-remove"
              initialImageFromGallery={galleryImage}
              initialExtensionImage={extensionImagePayload}
              extensionMeta={extensionMeta}
            />
          ) : pathTool === 'one-click-recolor' ? (
            <OneClickRecolor
              initialImageFromGallery={galleryImage}
              initialExtensionImage={extensionImagePayload}
              extensionMeta={extensionMeta}
            />
          ) : pathTool === 'clothing-3d' ? (
            <Clothing3D initialImageFromGallery={galleryImage} />
          ) : pathTool === 'clothing-flatlay' ? (
            <ClothingFlatlay initialImageFromGallery={galleryImage} />
          ) : pathTool === 'body-shape' ? (
            <BodyShape initialImageFromGallery={galleryImage} />
          ) : pathTool === 'scene-generation' ? (
            <SceneGeneration initialImageFromGallery={galleryImage} />
          ) : pathTool === 'add-person-object' ? (
            <AddPersonObject initialImageFromGallery={galleryImage} />
          ) : pathTool === 'smart-expansion' ? (
            <SmartExpansion
              initialImageFromGallery={galleryImage}
              initialExtensionImage={extensionImagePayload}
              extensionMeta={extensionMeta}
            />
          ) : pathTool === 'product-refinement' ? (
            <ProductRefinement initialImageFromGallery={galleryImage} />
          ) : pathTool === 'watermark-add' ? (
            <AddWatermark initialImageFromGallery={galleryImage} />
          ) : pathTool === 'style-change' ? (
            <StyleChange initialImageFromGallery={galleryImage} />
          ) : pathTool === 'style-clone' ? (
            <StyleClone initialImageFromGallery={galleryImage} />
          ) : pathTool && !AVAILABLE_IDS.has(pathTool) ? (
            <Navigate to="/ai-designer/local-redraw" replace />
          ) : pathTool ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {SIDEBAR_STRUCTURE.flatMap((g) => g.items).find((it) => it.id === pathTool)?.label || pathTool}
              </h2>
              <p className="text-gray-500">功能开发中，敬请期待。</p>
            </div>
          ) : (
            <Navigate to="/ai-designer/local-redraw" replace />
          )}
        </main>
      </div>
      <Footer />
    </div>
  )
}
