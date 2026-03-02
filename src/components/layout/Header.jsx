import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const iconClass = 'w-5 h-5 shrink-0 text-gray-500'

const navLinks = [
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
    to: '/#全品类组图',
    label: '全品类组图',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    to: '/#风格复刻',
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
    to: '/#服装组图',
    label: '服装组图',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/#图片精修',
    label: '图片精修',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12l9.879-9.879" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2m0 14v2M3 12h2m14 0h2M5.636 5.636l1.414 1.414m9.9 9.9l1.414 1.414M5.636 18.364l1.414-1.414m9.9-9.9l1.414-1.414" />
      </svg>
    ),
  },
  {
    to: '/pricing',
    label: '定价策略',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1v8" />
      </svg>
    ),
  },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    if (to === '/pricing') return location.pathname === '/pricing'
    return location.pathname === '/' && location.hash?.includes(to.slice(2))
  }

  return (
    <header className="sticky top-0 z-50 bg-[#f5f5f5]/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center text-lg font-semibold text-gray-900 shrink-0">
            <span className="tracking-tight">PicAITool</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(to) ? 'text-gray-900 bg-white/80' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                }`}
              >
                {icon}
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              className="hidden sm:flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              aria-label="语言"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3a9 9 0 100 18 9 9 0 000-18zM3.75 12h16.5M12 3c2.5 2 4 5.5 4 9s-1.5 7-4 9c-2.5-2-4-5.5-4-9s1.5-7 4-9z"
                />
              </svg>
              <span>ZH</span>
            </button>
            <Link
              to="/login"
              className="rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
            >
              登录
            </Link>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-white/60"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="菜单"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden py-4 border-t border-gray-200 space-y-1">
            {navLinks.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-white/60 hover:text-gray-900"
                onClick={() => setMenuOpen(false)}
              >
                {icon}
                <span>{label}</span>
              </Link>
            ))}
            <div className="flex items-center gap-2 px-3 py-2.5 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3a9 9 0 100 18 9 9 0 000-18zM3.75 12h16.5M12 3c2.5 2 4 5.5 4 9s-1.5 7-4 9c-2.5-2-4-5.5-4-9s1.5-7 4-9z"
                />
              </svg>
              <span>ZH</span>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
