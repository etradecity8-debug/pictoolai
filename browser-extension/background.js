/**
 * 右键菜单、抓取与压缩图片、标记原页 img、打开 PicToolAI。
 * 本地开发：将 SITE_ORIGIN 改为 http://localhost:5173（与 Vite 端口一致）。
 */
const SITE_ORIGIN = 'https://pictoolai.studio'

/** [menuId, 子菜单标题, toolId]（AI 美工直接项） */
const CONTEXT_MENU_ENTRIES = [
  ['pictoolai-text-translate', '语言转换', 'text-translate'],
  ['pictoolai-text-replace', '文字替换', 'text-replace'],
  ['pictoolai-text-remove', '文字去除', 'text-remove'],
  ['pictoolai-one-click-recolor', '一键换色', 'one-click-recolor'],
  ['pictoolai-local-redraw', '局部重绘', 'local-redraw'],
  ['pictoolai-local-erase', '局部消除', 'local-erase'],
  ['pictoolai-smart-expansion', '智能扩图', 'smart-expansion'],
]

/**
 * 通用电商生图子菜单（嵌套在 pictoolai-detail-set-group 下）。
 * toolId 以 detail-set- 开头，DetailSet.jsx 根据后缀预设对应图片类型与张数。
 */
const DETAIL_SET_ENTRIES = [
  ['pictoolai-detail-set-main',         '白底主图',  'detail-set-main'],
  ['pictoolai-detail-set-closeup',       '特写图',    'detail-set-closeup'],
  ['pictoolai-detail-set-sellingpoint',  '卖点图',    'detail-set-sellingpoint'],
  ['pictoolai-detail-set-scene',         '场景图',    'detail-set-scene'],
  ['pictoolai-detail-set-interaction',   '交互图',    'detail-set-interaction'],
]

const MENU_TO_TOOL = {
  ...Object.fromEntries(CONTEXT_MENU_ENTRIES.map(([id, , tool]) => [id, tool])),
  ...Object.fromEntries(DETAIL_SET_ENTRIES.map(([id, , tool]) => [id, tool])),
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function compressDataUrl(dataUrl, maxSize, quality) {
  const blob = await (await fetch(dataUrl)).blob()
  const img = await createImageBitmap(blob)
  let w = img.width
  let h = img.height
  if (w > maxSize || h > maxSize) {
    if (w >= h) {
      h = Math.round((h * maxSize) / w)
      w = maxSize
    } else {
      w = Math.round((w * maxSize) / h)
      h = maxSize
    }
  }
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
  return blobToDataUrl(outBlob)
}

async function fetchImageAsDataUrl(srcUrl) {
  const res = await fetch(srcUrl, { credentials: 'omit', mode: 'cors', cache: 'no-store' })
  if (!res.ok) throw new Error('fetch failed')
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    const buf = await blob.slice(0, 12).arrayBuffer()
    const isPng = buf.byteLength >= 8 && new Uint8Array(buf)[0] === 0x89
    if (!isPng) throw new Error('not an image')
  }
  return blobToDataUrl(blob)
}

function markTargetImage(tabId, srcUrl, uuid) {
  const fn = (url, id) => {
    const norm = (u) => {
      try {
        return new URL(u, document.baseURI).href
      } catch {
        return u
      }
    }
    const target = norm(url)
    const list = document.querySelectorAll('img')
    for (const img of list) {
      try {
        if (norm(img.src) === target || norm(img.currentSrc || '') === target || img.src === url) {
          img.setAttribute('data-pictoolai-target', id)
          return true
        }
      } catch (_) {}
    }
    return false
  }
  return chrome.scripting.executeScript({ target: { tabId }, func: fn, args: [srcUrl, uuid] })
}

function installContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'pictoolai-root',
      title: 'PicToolAI',
      contexts: ['image'],
    })
    for (const [id, title] of CONTEXT_MENU_ENTRIES) {
      chrome.contextMenus.create({ id, parentId: 'pictoolai-root', title, contexts: ['image'] })
    }
    // 通用电商生图：嵌套子菜单
    chrome.contextMenus.create({
      id: 'pictoolai-detail-set-group',
      parentId: 'pictoolai-root',
      title: '通用电商生图',
      contexts: ['image'],
    })
    for (const [id, title] of DETAIL_SET_ENTRIES) {
      chrome.contextMenus.create({ id, parentId: 'pictoolai-detail-set-group', title, contexts: ['image'] })
    }
  })
}

chrome.runtime.onInstalled.addListener(installContextMenus)
/** 冷启动时 onInstalled 不会再次触发，补一次注册，避免首次右键时菜单尚未就绪 */
installContextMenus()

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const toolId = MENU_TO_TOOL[info.menuItemId]
  if (!toolId || !info.srcUrl || !tab?.id) {
    if (info.menuItemId === 'pictoolai-root') {
      console.warn('[PicToolAI] 请再点一级子菜单（语言转换 / 文字替换 等），仅点父级不会抓取图片')
    }
    return
  }

  const uuid = crypto.randomUUID()

  try {
    await markTargetImage(tab.id, info.srcUrl, uuid)
  } catch (e) {
    console.warn('[PicToolAI] mark image failed', e)
  }

  let rawDataUrl
  try {
    rawDataUrl = await fetchImageAsDataUrl(info.srcUrl)
  } catch (e) {
    console.error('[PicToolAI] fetch image failed', e)
    return
  }

  const compressTries = [
    [1024, 0.82],
    [768, 0.78],
    [512, 0.72],
  ]

  let lastErr
  let savedPayload = null
  for (const [maxSize, q] of compressTries) {
    try {
      const dataUrl = await compressDataUrl(rawDataUrl, maxSize, q)
      savedPayload = {
        toolId,
        dataUrl,
        targetTabId: tab.id,
        targetUuid: uuid,
        ts: Date.now(),
      }
      try {
        await chrome.storage.session.set({ pictoolai_pending: savedPayload })
      } catch {
        await chrome.storage.local.set({ pictoolai_pending: savedPayload })
      }
      lastErr = null
      break
    } catch (e) {
      lastErr = e
    }
  }

  if (lastErr || !savedPayload) {
    console.error('[PicToolAI] compress/storage failed', lastErr)
    return
  }

  const url = String(toolId).startsWith('detail-set')
    ? `${SITE_ORIGIN}/detail-set?ext=1`
    : `${SITE_ORIGIN}/ai-designer/${encodeURIComponent(toolId)}?ext=1`
  const created = await chrome.tabs.create({ url })
  if (created?.id != null) {
    setupPicToolTab(created.id, savedPayload)
  }
})

/**
 * 注入 bridge.js；在 MAIN 世界 postMessage + CustomEvent，与 React 同环境。
 */
function setupPicToolTab(tabId, payload) {
  const inject = () => {
    chrome.scripting
      .executeScript({ target: { tabId }, files: ['bridge.js'] })
      .catch((e) => console.warn('[PicToolAI] inject bridge.js', e?.message || e))
    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (p) => {
          const msg = {
            source: 'pictoolai-extension',
            type: 'PICTOOLAI_IMPORT',
            payload: p,
          }
          window.postMessage(msg, '*')
          try {
            window.dispatchEvent(new CustomEvent('pictoolai-extension-import', { detail: p }))
          } catch (_) {}
        },
        args: [payload],
      })
      .catch((e) => console.warn('[PicToolAI] MAIN world import', e?.message || e))
  }
  const onUpdated = (id, info) => {
    if (id !== tabId || info.status !== 'complete') return
    chrome.tabs.onUpdated.removeListener(onUpdated)
    inject()
    setTimeout(inject, 500)
  }
  chrome.tabs.onUpdated.addListener(onUpdated)
  chrome.tabs.get(tabId).then((t) => {
    if (t?.status === 'complete') {
      inject()
      setTimeout(inject, 500)
    }
  }).catch(() => {})
}
