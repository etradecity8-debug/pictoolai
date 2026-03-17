import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function Points() {
  const { user, getToken, refreshUser } = useAuth()
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const fetchData = useCallback(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetch('/api/points/balance', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : { balance: 0 })),
      fetch('/api/points/transactions', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : { items: [] })),
    ])
      .then(([balanceRes, txRes]) => {
        setBalance(balanceRes.balance ?? 0)
        setTransactions(txRes.items || [])
        refreshUser()
      })
      .catch(() => {
        setBalance(0)
        setTransactions([])
      })
      .finally(() => setLoading(false))
  }, [getToken, refreshUser])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">积分明细</h1>
        <p className="mt-2 text-gray-500">加载中…</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">积分明细</h1>
      <p className="mt-2 text-gray-500">当前剩余积分与扣取记录</p>

      <div className="mt-6">
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 min-w-[180px] inline-block">
          <p className="text-sm text-gray-500">剩余积分</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{balance ?? 0}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">扣取明细</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-left py-3 px-4 font-medium text-gray-700">描述</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">积分</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">时间</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-4 text-gray-900">{tx.description || '—'}</td>
                    <td className={`py-3 px-4 text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString('zh-CN') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
