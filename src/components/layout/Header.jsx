import { useState, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { SITE_NAV_HIDDEN } from '../../lib/siteFeatures'

const iconClass = 'w-4 h-4 shrink-0'

/** 静态资源：与 `public/pictoolai-browser-extension.zip` 同步（更新扩展后请重新打包 zip） */
const BROWSER_EXTENSION_ZIP = '/pictoolai-browser-extension.zip'
const BROWSER_EXTENSION_ZIP_NAME = 'pictoolai-browser-extension.zip'

const toolLinksAll = [
  {
    to: '/detail-set',
    label: '通用电商生图',
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
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
    hidden: () => SITE_NAV_HIDDEN.amazonAplus,
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
]

function useToolLinks() {
  return useMemo(
    () => toolLinksAll.filter((l) => !(l.hidden?.() ?? false)).map(({ hidden, ...rest }) => rest),
    []
  )
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const toolLinks = useToolLinks()

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    if (to === '/ai-designer') return location.pathname === to || location.pathname.startsWith(to + '/')
    return location.pathname === to
  }


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

            {!SITE_NAV_HIDDEN.aiToolboxSupplier && (
            <Link
              to="/ai-toolbox"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                location.pathname.startsWith('/ai-toolbox')
                  ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>AI 电商工具箱</span>
            </Link>
            )}
            {/* AI 运营助手：点击进入，平台在侧边栏选择 */}
            <Link
              to="/ai-assistant"
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
            </Link>

            {!SITE_NAV_HIDDEN.ipRisk && (
            <Link
              to="/ip-risk"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                location.pathname === '/ip-risk'
                  ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>侵权风险检测</span>
            </Link>
            )}
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
            {/* 联系我们 */}
            <Link
              to="/contact"
              className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                location.pathname === '/contact'
                  ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
              }`}
            >
              <span>联系我们</span>
            </Link>
            <a
              href={BROWSER_EXTENSION_ZIP}
              download={BROWSER_EXTENSION_ZIP_NAME}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-900 hover:bg-white/70 whitespace-nowrap"
              title="Chrome / Edge 等：解压后在扩展程序页「加载已解压的扩展程序」"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>插件下载</span>
            </a>

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
            {!SITE_NAV_HIDDEN.aiToolboxSupplier && (
            <Link
              to="/ai-toolbox"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                location.pathname.startsWith('/ai-toolbox') ? 'text-gray-900 bg-white font-medium' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>AI 电商工具箱</span>
            </Link>
            )}
            {/* 电商AI运营助手（移动端） */}
            <Link
              to="/ai-assistant"
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
            {!SITE_NAV_HIDDEN.ipRisk && (
            <Link
              to="/ip-risk"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                location.pathname === '/ip-risk' ? 'text-gray-900 bg-white font-medium' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>侵权风险检测</span>
            </Link>
            )}
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
            <Link
              to="/contact"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                location.pathname === '/contact' ? 'text-gray-900 font-medium' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              <span>联系我们</span>
            </Link>
            <a
              href={BROWSER_EXTENSION_ZIP}
              download={BROWSER_EXTENSION_ZIP_NAME}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-white/60 hover:text-gray-900"
              title="Chrome / Edge 等：解压后在扩展程序页「加载已解压的扩展程序」"
              onClick={() => setMenuOpen(false)}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>插件下载</span>
            </a>
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
