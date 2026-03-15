import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatExpiry(ts) {
  if (!ts) return <span className="text-gray-400">无限制</span>
  const diff = ts - Date.now()
  if (diff <= 0) return <span className="text-red-500 font-medium">已过期</span>
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  const color = days <= 3 ? 'text-orange-500' : days <= 7 ? 'text-yellow-600' : 'text-green-600'
  return (
    <span className={`font-medium ${color}`}>
      {formatDate(ts)}
      <span className="ml-1 text-xs">({days}天后)</span>
    </span>
  )
}

// ── 充值弹窗 ──────────────────────────────────────────────────────────────────

function GrantModal({ user, onClose, onSuccess, getToken }) {
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    const d = parseInt(days, 10)
    if (!amt || amt <= 0) return setError('请填写有效积分数量')
    if (!d || d <= 0) return setError('请填写有效天数')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ amount: amt, days: d }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '充值失败')
      onSuccess(user.email, data.balance, data.expiresAt)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">充值积分</h3>
        <p className="text-sm text-gray-500 mb-5 truncate">{user.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">充值积分数</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例如 100"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">有效天数</label>
            <div className="flex gap-2 mb-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(String(d))}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    days === String(d)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="或自定义天数"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '处理中…' : '确认充值'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 流水弹窗 ──────────────────────────────────────────────────────────────────

function TransactionsModal({ user, onClose, getToken }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/users/${encodeURIComponent(user.email)}/transactions`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [user.email, getToken])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">积分流水</h3>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {loading ? (
            <p className="text-center text-gray-400 py-8">加载中…</p>
          ) : items?.length === 0 ? (
            <p className="text-center text-gray-400 py-8">暂无记录</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left pb-2 font-medium">时间</th>
                  <th className="text-right pb-2 font-medium">变动</th>
                  <th className="text-left pb-2 pl-4 font-medium">描述</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-500 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                    <td className={`py-2 text-right font-medium ${item.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount}
                    </td>
                    <td className="py-2 pl-4 text-gray-700">{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 删除确认弹窗 ──────────────────────────────────────────────────────────────

function DeleteModal({ user, onClose, onSuccess, getToken }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '删除失败')
      onSuccess(user.email)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">删除用户</h3>
        <p className="text-sm text-gray-600 mb-1">确定要删除以下用户吗？此操作不可撤销。</p>
        <p className="text-sm font-medium text-gray-800 bg-gray-100 rounded-lg px-3 py-2 mb-5 truncate">{user.email}</p>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function Admin() {
  const { getToken, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [grantTarget, setGrantTarget] = useState(null)
  const [txTarget, setTxTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setUsers(data.users || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [getToken])

  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true })
      return
    }
    fetchUsers()
  }, [isAdmin, navigate, fetchUsers])

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))

  function handleGrantSuccess(email, balance, expiresAt) {
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, balance, expiresAt } : u))
    )
    setGrantTarget(null)
  }

  function handleDeleteSuccess(email) {
    setUsers((prev) => prev.filter((u) => u.email !== email))
    setDeleteTarget(null)
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
            <p className="text-sm text-gray-500 mt-1">共 {users.length} 个用户</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setCleanupResult(null)
                setCleanupLoading(true)
                try {
                  const res = await fetch('/api/admin/cleanup-orphan-gallery', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${getToken()}` },
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || '清理失败')
                  setCleanupResult(data.deleted === 0 ? '没有需要清理的孤儿仓库记录' : `已清理 ${data.deleted} 条孤儿仓库记录及文件`)
                } catch (e) {
                  setCleanupResult('清理失败：' + e.message)
                } finally {
                  setCleanupLoading(false)
                }
              }}
              disabled={cleanupLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              title="删除「用户已不存在」的仓库记录与本地图片（如先删用户再上线新逻辑时遗留的数据）"
            >
              {cleanupLoading ? '清理中…' : '清理孤儿仓库'}
            </button>
            <button
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
          </div>
        </div>
        {cleanupResult && (
          <div className="mb-4 text-sm text-gray-600 bg-gray-100 rounded-lg px-4 py-2">
            {cleanupResult}
          </div>
        )}

        {/* 搜索 */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="搜索邮箱…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* 表格 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center text-gray-400 py-16">加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-16">暂无用户</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">邮箱</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">角色</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">余额</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">已消耗</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">订阅到期</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">注册时间</th>
                    <th className="text-right px-6 py-3 font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((u) => (
                    <tr key={u.email} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-800">{u.email}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {u.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-semibold ${u.balance > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {u.balance}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">积分</span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-500">
                        {u.totalSpent}
                        <span className="text-gray-400 text-xs ml-1">积分</span>
                      </td>
                      <td className="px-4 py-4">{formatExpiry(u.expiresAt)}</td>
                      <td className="px-4 py-4 text-gray-500">{formatDate(u.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setGrantTarget(u)}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            充值
                          </button>
                          <button
                            onClick={() => setTxTarget(u)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            流水
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 说明 */}
        <p className="text-xs text-gray-400 mt-4 text-center">
          每次充值会重置积分有效期。到期后用户剩余积分自动清零。
        </p>
      </div>

      {/* 弹窗 */}
      {grantTarget && (
        <GrantModal
          user={grantTarget}
          onClose={() => setGrantTarget(null)}
          onSuccess={handleGrantSuccess}
          getToken={getToken}
        />
      )}
      {txTarget && (
        <TransactionsModal
          user={txTarget}
          onClose={() => setTxTarget(null)}
          getToken={getToken}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={handleDeleteSuccess}
          getToken={getToken}
        />
      )}
    </div>
  )
}
