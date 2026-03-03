import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('密码至少 6 位')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '注册失败')
        return
      }
      login(data.token, data.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? '无法连接服务器，请确认后端已启动（在 server 目录运行 npm start）' : '网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center">免费注册</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
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
              placeholder="至少 6 位"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? '注册中…' : '注册'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          已有账号？ <Link to="/login" className="text-primary hover:underline">登录</Link>
        </p>
      </div>
    </div>
  )
}
