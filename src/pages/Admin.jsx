import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** 列「最小宽度」拖拽调节；table-auto 下列可随长文本变宽，避免整表被挤变形 */
const DEFAULT_COL_WIDTHS = { email: 300, role: 88, balance: 88, consumed: 88, expires: 168, created: 132, notes: 280, actions: 360 }

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
  const [days, setDays] = useState('365')
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
              {[30, 180, 365].map((d) => (
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
                  {d === 365 ? '1年' : `${d}天`}
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

// ── 备注弹窗 ──────────────────────────────────────────────────────────────────

function NotesModal({ user, onClose, onSuccess, getToken }) {
  const [notes, setNotes] = useState(user.adminNotes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ adminNotes: notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      onSuccess(user.email, notes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">客户备注</h3>
        <p className="text-sm text-gray-500 mb-4 truncate">{user.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注（如：该客户是谁、来源等）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：朋友张三、从某某渠道来的试用客户"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
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
              {loading ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
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
  const [notesTarget, setNotesTarget] = useState(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortAsc, setSortAsc] = useState(false)
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('pictoolai_admin_col_widths')
      if (saved) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) }
    } catch (_) {}
    return { ...DEFAULT_COL_WIDTHS }
  })
  const [resizingCol, setResizingCol] = useState(null)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  const latestWidthsRef = useRef(colWidths)
  latestWidthsRef.current = colWidths

  useEffect(() => {
    if (!resizingCol) return
    const onMove = (e) => {
      const dx = e.clientX - resizeStartX.current
      const newW = Math.max(50, resizeStartW.current + dx)
      const next = { ...latestWidthsRef.current, [resizingCol]: newW }
      latestWidthsRef.current = next
      setColWidths(next)
    }
    const onUp = () => {
      setResizingCol(null)
      try { localStorage.setItem('pictoolai_admin_col_widths', JSON.stringify(latestWidthsRef.current)) } catch (_) {}
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingCol])

  const startResize = (col, e) => {
    e.preventDefault()
    setResizingCol(col)
    resizeStartX.current = e.clientX
    resizeStartW.current = colWidths[col]
  }

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

  const sorted = [...filtered].sort((a, b) => {
    let va, vb
    switch (sortBy) {
      case 'balance':
        va = a.balance ?? 0
        vb = b.balance ?? 0
        return sortAsc ? va - vb : vb - va
      case 'totalSpent':
        va = a.totalSpent ?? 0
        vb = b.totalSpent ?? 0
        return sortAsc ? va - vb : vb - va
      case 'expiresAt':
        va = a.expiresAt ?? 0
        vb = b.expiresAt ?? 0
        return sortAsc ? va - vb : vb - va
      case 'createdAt':
      default:
        va = a.createdAt ?? 0
        vb = b.createdAt ?? 0
        return sortAsc ? va - vb : vb - va
    }
  })

  function toggleSort(key) {
    setSortBy(key)
    setSortAsc((prev) => {
      if (sortBy === key) return !prev
      // 切换列时的默认：到期 asc=早的在前，其余 desc
      return key === 'expiresAt'
    })
  }

  const SortHeader = ({ field, label }) => (
    <span
      className="cursor-pointer select-none hover:text-gray-700"
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortBy === field && (
        <span className="ml-1 text-indigo-500">{sortAsc ? '↑' : '↓'}</span>
      )}
    </span>
  )

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

  function handleNotesSuccess(email, adminNotes) {
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, adminNotes } : u)))
    setNotesTarget(null)
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[min(100%,1920px)] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <table
                className="text-sm min-w-full w-max"
                style={{ minWidth: Object.values(colWidths).reduce((a, b) => a + b, 0) }}
              >
                <colgroup>
                  {(['email', 'role', 'balance', 'consumed', 'expires', 'created', 'notes', 'actions']).map((k) => (
                    <col key={k} style={{ minWidth: colWidths[k] }} />
                  ))}
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 align-middle">
                      <div className="flex items-center justify-between gap-1">
                        <span>邮箱</span>
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('email', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>角色</span>
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('role', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <SortHeader field="balance" label="余额" />
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('balance', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <SortHeader field="totalSpent" label="已消耗" />
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('consumed', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <SortHeader field="expiresAt" label="订阅到期" />
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('expires', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <SortHeader field="createdAt" label="注册时间" />
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('created', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 align-middle">
                      <div className="flex items-center justify-between gap-1">
                        <span>备注</span>
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('notes', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <span>操作</span>
                        <span
                          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 rounded self-stretch min-h-[16px] ml-0.5"
                          onMouseDown={(e) => startResize('actions', e)}
                          title="拖拽调节列宽"
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((u) => (
                    <tr key={u.email} className={`hover:bg-gray-50/50 transition-colors ${u.frozen ? 'bg-gray-100/60' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-800 align-top break-all max-w-xl">
                        {u.email}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                              u.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {u.role === 'admin' ? '管理员' : '普通用户'}
                          </span>
                          {u.frozen && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                              已冻结
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                        <span className={`font-semibold ${u.balance > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {u.balance}
                        </span>
                        <span className="text-gray-400 text-xs ml-0.5">积分</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 align-top whitespace-nowrap">
                        {u.totalSpent}
                        <span className="text-gray-400 text-xs ml-0.5">积分</span>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-gray-700">
                        {formatExpiry(u.expiresAt)}
                      </td>
                      <td className="px-3 py-2 text-gray-500 align-top whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-600 text-xs break-words max-w-xl min-w-[14rem]">
                        {u.adminNotes || '—'}
                      </td>
                      <td className="px-3 py-2 align-top overflow-visible whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {u.role !== 'admin' && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/admin/users/${encodeURIComponent(u.email)}/freeze`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                                    body: JSON.stringify({ frozen: !u.frozen }),
                                  })
                                  const data = await res.json()
                                  if (!res.ok) throw new Error(data.error || '操作失败')
                                  setUsers((prev) => prev.map((x) => (x.email === u.email ? { ...x, frozen: data.frozen } : x)))
                                } catch (e) {
                                  setError(e.message)
                                }
                              }}
                              className={`px-2 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                                u.frozen
                                  ? 'text-green-600 border-green-200 hover:bg-green-50'
                                  : 'text-amber-600 border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              {u.frozen ? '解冻' : '冻结'}
                            </button>
                          )}
                          <button
                            onClick={() => setNotesTarget(u)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors whitespace-nowrap"
                          >
                            编辑备注
                          </button>
                          <button
                            onClick={() => setGrantTarget(u)}
                            className="px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors whitespace-nowrap"
                          >
                            充值
                          </button>
                          <button
                            onClick={() => setTxTarget(u)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors whitespace-nowrap"
                          >
                            流水
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="px-2 py-1 text-xs font-medium text-red-500 border border-red-200 rounded hover:bg-red-50 transition-colors whitespace-nowrap"
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
        <p className="text-sm text-gray-500 mt-4 text-center max-w-xl mx-auto">
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
      {notesTarget && (
        <NotesModal
          user={notesTarget}
          onClose={() => setNotesTarget(null)}
          onSuccess={handleNotesSuccess}
          getToken={getToken}
        />
      )}
    </div>
  )
}
