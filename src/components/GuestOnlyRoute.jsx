import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * 仅未登录时显示子内容；已登录时重定向到工作台，避免已登录用户还看到登录/注册页。
 */
export default function GuestOnlyRoute({ children, redirectTo = '/dashboard/gallery' }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中…</p>
      </div>
    )
  }
  if (user) {
    return <Navigate to={redirectTo} replace />
  }
  return children
}
