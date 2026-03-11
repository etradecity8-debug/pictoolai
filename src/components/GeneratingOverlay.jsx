/**
 * 生成中遮罩：覆盖在内容上方，防止页面跳来跳去
 * @param {boolean} open - 是否显示
 * @param {string} message - 提示文字，如 "生成中..."
 * @param {string} progress - 可选，如 "3/8"
 */
export default function GeneratingOverlay({ open, message = '生成中...', progress }) {
  if (!open) return null
  const [current, total] = progress ? progress.split('/').map(Number) : [null, null]
  const pct = total && current != null ? Math.round((current / total) * 100) : null
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl">
      <div className="flex flex-col items-center gap-4 w-full max-w-xs px-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        <p className="text-sm font-medium text-gray-700">{message}</p>
        {progress && <p className="text-xs text-gray-500">{progress}</p>}
        {pct != null && (
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
