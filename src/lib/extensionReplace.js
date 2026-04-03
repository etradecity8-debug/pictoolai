import { EXT_WEB_SOURCE, EXT_REPLACE_PAGE } from './extensionBridgeConstants'

/** 请求扩展在来源标签页替换被标记的 img（经 bridge → background → scripting） */
export function requestReplaceOnOriginalPage(imageDataUrl, extensionMeta) {
  if (!extensionMeta?.targetTabId || !extensionMeta?.targetUuid || !imageDataUrl) return
  window.postMessage(
    {
      source: EXT_WEB_SOURCE,
      type: EXT_REPLACE_PAGE,
      imageDataUrl,
      targetTabId: extensionMeta.targetTabId,
      targetUuid: extensionMeta.targetUuid,
    },
    '*'
  )
}
