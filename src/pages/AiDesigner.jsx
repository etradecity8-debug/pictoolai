import { useState, useEffect } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import LocalRedraw from './ai-designer/LocalRedraw'
import LocalErase from './ai-designer/LocalErase'
import OneClickRecolor from './ai-designer/OneClickRecolor'

const iconClass = 'w-4 h-4 shrink-0'

// 图片编辑、质量提升、图像修复、抠图工具 为同级一级分类；其下为平级子项
const SIDEBAR_STRUCTURE = [
  {
    id: 'image-editing',
    label: '图片编辑',
    items: [
      { id: 'smart-editing', label: '智能修图', icon: 'spark' },
      { id: 'local-redraw', label: '局部重绘', icon: 'brush' },
      { id: 'local-erase', label: '局部消除', icon: 'eraser' },
      { id: 'one-click-recolor', label: '一键换色', icon: 'recolor' },
      { id: 'image-crop', label: '图片裁剪', badge: 'NEW', icon: 'crop' },
    ],
  },
  {
    id: 'quality-enhancement',
    label: '质量提升',
    items: [
      { id: 'hd-zoom', label: '高清放大', icon: 'zoom' },
      { id: 'smart-expansion', label: '智能扩图', icon: 'expand' },
      { id: 'product-refinement', label: '商品精修', icon: 'product' },
    ],
  },
  {
    id: 'image-restoration',
    label: '图像修复',
    items: [
      { id: 'color-repair', label: '色差修复', icon: 'color' },
      { id: 'print-repair', label: '印花修复', icon: 'print' },
      { id: 'hand-repair', label: '手部修复', icon: 'hand' },
    ],
  },
  {
    id: 'cutout-tools',
    label: '抠图工具',
    items: [
      { id: 'fine-cutout', label: '精细抠图', icon: 'cutout' },
      { id: 'batch-cutout', label: '批量抠图', icon: 'batch' },
    ],
  },
]

function ItemIcon({ name }) {
  const path = name === 'spark'
    ? 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
    : name === 'brush'
    ? 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01'
    : name === 'eraser'
    ? 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4l6-6m2 5l3 3m-3 3l-6 6m0-6l6 6'
    : name === 'recolor'
    ? 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
    : name === 'crop'
    ? 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
    : name === 'zoom'
    ? 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3m-3 3V7m3 3h3'
    : name === 'expand'
    ? 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
    : name === 'product'
    ? 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
    : name === 'color'
    ? 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01'
    : name === 'print'
    ? 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
    : name === 'hand'
    ? 'M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11'
    : name === 'cutout'
    ? 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243 0z'
    : 'M4 6h16M4 10h16M4 14h16M4 18h16'
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

export default function AiDesigner() {
  const location = useLocation()
  const pathTool = location.pathname.replace(/^\/ai-designer\/?/, '') || null
  const [expanded, setExpanded] = useState(() => {
    const open = new Set()
    const tool = location.pathname.replace(/^\/ai-designer\/?/, '') || null
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
          {pathTool === 'local-redraw' ? (
            <LocalRedraw />
          ) : pathTool === 'local-erase' ? (
            <LocalErase />
          ) : pathTool === 'one-click-recolor' ? (
            <OneClickRecolor />
          ) : pathTool ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {SIDEBAR_STRUCTURE.flatMap((g) => g.items).find((it) => it.id === pathTool)?.label || pathTool}
              </h2>
              <p className="text-gray-500">功能开发中，敬请期待。</p>
            </div>
          ) : (
            <Navigate to="/ai-designer/smart-editing" replace />
          )}
        </main>
      </div>
      <Footer />
    </div>
  )
}
