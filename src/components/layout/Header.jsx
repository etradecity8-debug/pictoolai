import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const iconClass = 'w-4 h-4 shrink-0'

// 工具类导航（居中显示）
const toolLinks = [
  {
    to: '/',
    label: '万能画布',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    to: '/detail-set',
    label: '产品组图',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    to: '/style-clone',
    label: '风格复刻',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16l4-4 3 3 5-7" />
        <circle cx="17" cy="8" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/apparel-set',
    label: '服装组图',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname === to
  }

  return (
    <header className="sticky top-0 z-50 bg-[#f5f5f5]/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center text-base font-bold text-gray-900 shrink-0 tracking-tight mr-2">
            PicAITool
          </Link>

          {/* 工具导航（居中，flex-1） */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {toolLinks.map(({ to, label, icon }) => (
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
            {toolLinks.map(({ to, label, icon }) => (
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
