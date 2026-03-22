import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard/gallery'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登录失败')
        return
      }
      login(data.token, data.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? '无法连接服务器，请确认后端已启动（在 server 目录运行 npm start）' : '网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center">登录</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                error.includes('冻结')
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="••••••••"
              required
            />
          </div>
          <Link to="/forgot-password" className="block text-sm text-primary hover:underline">
            忘记密码？
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          还没有账号？ <Link to="/register" className="text-primary hover:underline">免费注册</Link>
        </p>
      </div>
    </div>
  )
}
