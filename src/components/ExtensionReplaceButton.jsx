import { requestReplaceOnOriginalPage } from '../lib/extensionReplace'

export default function ExtensionReplaceButton({ imageDataUrl, extensionMeta, className = '' }) {
  if (!extensionMeta?.targetTabId || !extensionMeta?.targetUuid || !imageDataUrl) return null
  return (
    <button
      type="button"
      onClick={() => requestReplaceOnOriginalPage(imageDataUrl, extensionMeta)}
      className={
        className ||
        'flex items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100/80'
      }
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      替换原网页图片
    </button>
  )
}
