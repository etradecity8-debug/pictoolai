import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const sidebarLinks = [
  { to: '/dashboard', label: '工作台' },
  { to: '/dashboard/gallery', label: '图库' },
  { to: '/dashboard/settings', label: '设置' },
]

export default function DashboardLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const initial = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4">
        <Link to="/" className="text-lg font-semibold text-gray-900">
          <span className="text-primary">PicAITool</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-gray-500 truncate max-w-[120px]">{user?.email}</span>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
            {initial}
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)] py-4 px-3">
          <nav className="space-y-1">
            {sidebarLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  location.pathname === to
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
