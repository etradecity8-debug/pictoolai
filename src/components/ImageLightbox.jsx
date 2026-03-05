import { useEffect } from 'react'

/**
 * 全屏放大看图：点击遮罩或关闭按钮关闭，ESC 关闭
 */
export default function ImageLightbox({ open, src, alt = '', onClose }) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label="放大查看图片"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/90 p-2 text-gray-700 hover:bg-white"
        aria-label="关闭"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  )
}
