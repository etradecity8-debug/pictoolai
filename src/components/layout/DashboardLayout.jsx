import { Link, Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import { useAuth } from '../../context/AuthContext'

const sidebarLinks = [
  { to: '/dashboard/gallery', label: '仓库' },
  { to: '/dashboard/listings', label: 'Listing 历史' },
  { to: '/dashboard/points', label: '积分明细' },
]

export default function DashboardLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const balance = user?.pointsBalance ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)] py-4 px-3">
          {balance != null && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-gray-50 text-sm">
              <p className="text-gray-500">剩余积分</p>
              <p className="font-semibold text-gray-900">{balance}</p>
            </div>
          )}
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
