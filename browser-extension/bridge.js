/**
 * 仅在 PicToolAI 站点注入：从 session 读取待导入图片并 postMessage 给页面；
 * 转发「替换原网页」与「请求重发导入」到 background。
 * background 也会 executeScript 注入本文件；防重复注册监听与多次 flush。
 */
;(function () {
  try {
    if (typeof window !== 'undefined' && window.__PICTOOLAI_BRIDGE_LOADED__) return
    if (typeof window !== 'undefined') window.__PICTOOLAI_BRIDGE_LOADED__ = true
  } catch (_) {}
  const EXT = 'pictoolai-extension'
  const WEB = 'pictoolai-web'

  function postImport(payload) {
    window.postMessage(
      { source: EXT, type: 'PICTOOLAI_IMPORT', payload },
      '*'
    )
  }

  async function flushPending() {
    try {
      const s = await chrome.storage.session.get('pictoolai_pending')
      if (s.pictoolai_pending) {
        postImport(s.pictoolai_pending)
        return
      }
      const l = await chrome.storage.local.get('pictoolai_pending')
      if (l.pictoolai_pending) postImport(l.pictoolai_pending)
    } catch (_) {}
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return
    const d = ev.data
    if (!d || d.source !== WEB) return

    if (d.type === 'PICTOOLAI_IMPORT_ACK') {
      chrome.storage.session.remove('pictoolai_pending').catch(() => {})
      chrome.storage.local.remove('pictoolai_pending').catch(() => {})
      return
    }

    if (d.type === 'PICTOOLAI_REQUEST_IMPORT') {
      flushPending()
      return
    }

    if (d.type === 'PICTOOLAI_REPLACE_PAGE') {
      chrome.runtime
        .sendMessage({
          type: 'REPLACE_ORIGINAL_PAGE',
          imageDataUrl: d.imageDataUrl,
          targetTabId: d.targetTabId,
          targetUuid: d.targetUuid,
        })
        .catch(() => {})
    }
  })

  flushPending()
  ;[100, 400].forEach((ms) => setTimeout(() => flushPending(), ms))
})()
