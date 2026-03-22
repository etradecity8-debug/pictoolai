import { Link, Outlet, useLocation } from 'react-router-dom'

const tools = [
  { id: 'supplier-matching', to: '/ai-toolbox/supplier-matching', label: '智能选品', desc: '卖家精灵表格 → 1688 供应商匹配 → 利润核算' },
]

export default function AiToolbox() {
  const location = useLocation()
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            <aside className="w-56 shrink-0">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">AI 电商工具箱</h2>
              <nav className="space-y-0.5">
                {tools.map((t) => (
                  <Link
                    key={t.id}
                    to={t.to}
                    className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive(t.to)
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                    }`}
                  >
                    <div>{t.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5 font-normal">{t.desc}</div>
                  </Link>
                ))}
              </nav>
            </aside>
            <div className="flex-1 min-w-0">
              <Outlet />
            </div>
          </div>
        </div>
    </div>
  )
}
