import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const assistantPlatforms = [
  { id: 'amazon',      name: '亚马逊',     available: true  },
  { id: 'ebay',        name: 'eBay',        available: false },
  { id: 'aliexpress',  name: '速卖通',     available: false },
  { id: 'shopify',     name: 'Shopify',     available: false },
  { id: 'tiktok',      name: 'TikTok Shop', available: false },
  { id: 'walmart',     name: '沃尔玛',     available: false },
  { id: 'etsy',        name: 'Etsy',        available: false },
  { id: 'temu',        name: 'TEMU',        available: false },
  { id: 'independent', name: '独立站',     available: false },
]

const iconClass = 'w-4 h-4 shrink-0'

// 工具类导航（居中显示）
const toolLinks = [
  {
    to: '/detail-set',
    label: '电商生图',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    to: '/image-edit',
    label: '修改图片',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    to: '/ai-designer',
    label: 'AI美工',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    to: '/amazon-aplus',
    label: 'A+ 页面',
    hidden: true, // 暂不开放，想清楚后再展示
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const assistantRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    if (to === '/ai-designer') return location.pathname === to || location.pathname.startsWith(to + '/')
    return location.pathname === to
  }

  // 点击下拉外部时关闭
  useEffect(() => {
    const handler = (e) => {
      if (assistantRef.current && !assistantRef.current.contains(e.target)) {
        setAssistantOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-[#f5f5f5]/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-4">

          {/* Logo：与导航栏同底、不溢出；限制高度在栏内 */}
          <Link to="/" className="flex items-center shrink-0 mr-2 rounded-lg bg-[#f5f5f5] py-1 pl-2 pr-2 -ml-1 h-full max-h-14" aria-label="首页">
            <img src="/logo.png" alt="PicToolAI" className="max-h-12 w-auto object-contain mix-blend-multiply" />
          </Link>

          {/* 工具导航（居中，flex-1） */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {toolLinks.filter((l) => !l.hidden).map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  isActive(to)
                    ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
                }`}
              >
                {icon}
                <span>{label}</span>
              </Link>
            ))}

            {/* AI 运营助手下拉 */}
            <div className="relative" ref={assistantRef}>
              <button
                onClick={() => setAssistantOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  location.pathname === '/ai-assistant'
                    ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>电商AI运营助手</span>
                <svg
                  className={`w-3 h-3 transition-transform ${assistantOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 下拉面板 */}
              {assistantOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                  <div className="px-3 pb-1.5 pt-0.5 mb-0.5 border-b border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">选择平台</span>
                  </div>
                  {assistantPlatforms.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!p.available) return
                        setAssistantOpen(false)
                        navigate(`/ai-assistant?platform=${p.id}`)
                      }}
                      disabled={!p.available}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition ${
                        p.available
                          ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <span>{p.name}</span>
                      {!p.available && (
                        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">即将</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* 右侧：订阅 + 语言 + 用户 */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* 订阅计划 */}
            <Link
              to="/pricing"
              className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                location.pathname === '/pricing'
                  ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1v8" />
              </svg>
              <span>订阅</span>
            </Link>

            {/* 竖线分隔 */}
            <div className="hidden lg:block w-px h-5 bg-gray-300 mx-1" />

            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:inline text-xs text-gray-500 hover:text-gray-900 max-w-[120px] truncate"
                >
                  {user.email}
                </Link>
                <Link
                  to="/dashboard"
                  className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
                >
                  工作台
                </Link>
                <button
                  type="button"
                  onClick={() => { logout(); navigate('/') }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition"
                >
                  免费注册
                </Link>
              </>
            )}

            {/* 汉堡菜单（移动端） */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-white/60"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="菜单"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* 移动端展开菜单 */}
        {menuOpen && (
          <nav className="lg:hidden py-3 border-t border-gray-200 space-y-0.5">
            {toolLinks.filter((l) => !l.hidden).map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  isActive(to) ? 'text-gray-900 bg-white font-medium' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {icon}
                <span>{label}</span>
              </Link>
            ))}
            {/* 电商AI运营助手（移动端） */}
            <Link
              to="/ai-assistant?platform=amazon"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                location.pathname === '/ai-assistant' ? 'text-gray-900 bg-white font-medium' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>电商AI运营助手</span>
            </Link>
            <Link
              to="/pricing"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-white/60 hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1v8" />
              </svg>
              <span>订阅计划</span>
            </Link>
            <div className="border-t border-gray-100 my-1" />
            {user ? (
              <>
                <Link to="/dashboard" className="flex px-3 py-2.5 text-sm text-gray-600 hover:bg-white/60 rounded-lg" onClick={() => setMenuOpen(false)}>工作台</Link>
                <button type="button" className="w-full text-left flex px-3 py-2.5 text-sm text-gray-600 hover:bg-white/60 rounded-lg" onClick={() => { setMenuOpen(false); logout(); navigate('/') }}>退出</button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex px-3 py-2.5 text-sm text-gray-600 hover:bg-white/60 rounded-lg" onClick={() => setMenuOpen(false)}>登录</Link>
                <Link to="/register" className="flex px-3 py-2.5 text-sm text-gray-600 hover:bg-white/60 rounded-lg" onClick={() => setMenuOpen(false)}>免费注册</Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
