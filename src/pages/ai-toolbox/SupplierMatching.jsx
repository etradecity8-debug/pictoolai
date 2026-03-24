import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { downloadCsv } from '../../lib/exportListingCsv'

function escapeCsvField(v) {
  if (v == null) return ''
  const s = String(v).trim()
  if (s.includes('"') || s.includes('\n') || s.includes(',')) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

const HEAD_OPTIONS = [
  { id: 'air', label: '空运', rate: 40 },
  { id: 'sea_fast', label: '海运快船', rate: 12 },
  { id: 'sea_slow', label: '海运慢船', rate: 8 },
  { id: 'custom', label: '自定义', rate: null },
]

export default function SupplierMatching() {
  const { user, getToken } = useAuth()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [parseError, setParseError] = useState('')
  const [parseLoading, setParseLoading] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(7.2)
  const [rateLoading, setRateLoading] = useState(true)
  const [useManualRate, setUseManualRate] = useState(false)
  const [manualRate, setManualRate] = useState('7.2')
  const [headPreset, setHeadPreset] = useState('air')
  const [headCustom, setHeadCustom] = useState('')
  const [domesticPerItem, setDomesticPerItem] = useState('0')
  const [commissionOverride, setCommissionOverride] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [taskStatus, setTaskStatus] = useState(null)
  const [results, setResults] = useState([])
  const [dajiConfigured, setDajiConfigured] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState({}) // rowIndex -> 0|1|2
  const [historyItems, setHistoryItems] = useState([])
  const [viewingReport, setViewingReport] = useState(null)
  const [diagnoseResult, setDiagnoseResult] = useState(null)
  const [diagnoseLoading, setDiagnoseLoading] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    fetch('/api/supplier-matching/exchange-rate')
      .then((r) => r.json())
      .then((d) => setExchangeRate(d.rate || 7.2))
      .catch(() => setExchangeRate(7.2))
      .finally(() => setRateLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/supplier-matching/daji-status')
      .then((r) => r.json())
      .then((d) => setDajiConfigured(d.configured || false))
  }, [])

  useEffect(() => {
    if (!getToken()) return
    fetch('/api/supplier-matching/reports', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((d) => setHistoryItems(d.items || []))
  }, [getToken(), savedId])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setParseError('')
    setRows([])
    setTaskId(null)
    setResults([])
    setParseLoading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const buf = reader.result
      const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''))
      fetch('/api/supplier-matching/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ fileBase64: base64 }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error)
          setRows(d.rows || [])
        })
        .catch((err) => setParseError(err.message || '解析失败'))
        .finally(() => setParseLoading(false))
    }
    reader.readAsArrayBuffer(f)
  }

  const headRate = headPreset === 'custom' ? (parseFloat(headCustom) || 40) : (HEAD_OPTIONS.find((o) => o.id === headPreset)?.rate ?? 40)
  const effectiveRate = useManualRate ? parseFloat(manualRate) || 7.2 : exchangeRate

  const handleStart = async () => {
    if (!file || !rows.length || !getToken()) return
    setParseError('')
    try {
      const buf = await file.arrayBuffer()
      const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''))
      const res = await fetch('/api/supplier-matching/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          fileBase64: base64,
          settings: {
            useManualRate,
            manualRate: useManualRate ? manualRate : undefined,
            headPreset: headPreset === 'custom' ? 'air' : headPreset,
            headCustom: headPreset === 'custom' ? headCustom : undefined,
            domesticPerItem: parseFloat(domesticPerItem) || 0,
            commissionOverride: commissionOverride ? parseFloat(commissionOverride) : null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '启动失败')
      setTaskId(data.taskId)
      setTaskStatus({ status: 'running', current: 0, total: data.total, results: [] })
      setResults([])
    } catch (e) {
      setParseError(e.message || '启动失败')
    }
  }

  useEffect(() => {
    if (!taskId || taskId === 'viewing' || !getToken()) return
    const poll = () => {
      fetch(`/api/supplier-matching/task/${taskId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return
          setTaskStatus(d)
          setResults(d.results || [])
          if (d.status !== 'done') pollRef.current = setTimeout(poll, 1500)
        })
    }
    poll()
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [taskId, getToken])

  const handleSave = async () => {
    if (!getToken() || !results.length) return
    setSaveLoading(true)
    try {
      const res = await fetch('/api/supplier-matching/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          name: saveName || '智能选品报告',
          settings: { exchangeRate: effectiveRate, headRate, domesticPerItem },
          resultData: results,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setSavedId(data.id)
    } catch (e) {
      setParseError(e.message || '保存失败')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDiagnose = async () => {
    if (!rows?.[0]?.mainImage || !getToken()) return
    setDiagnoseLoading(true)
    setDiagnoseResult(null)
    try {
      const res = await fetch('/api/supplier-matching/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ imageUrl: rows[0].mainImage }),
      })
      const data = await res.json()
      setDiagnoseResult(data)
    } catch (e) {
      setDiagnoseResult({ error: e.message || '诊断请求失败' })
    } finally {
      setDiagnoseLoading(false)
    }
  }

  const handleExport = () => {
    const headers = ['行号', '亚马逊商品', '售价$', '1688推荐', '采购价¥', 'FBA$', '头程¥', '佣金¥', '毛利¥', '毛利率', '1688链接']
    const lines = results.map((r) => {
      const sel = r.selectedIndex ?? 0
      const m = r.matches?.[sel] || r.matches?.[0]
      const p = r.profit
      return [
        r.rowIndex,
        r.title?.slice(0, 50),
        r.price,
        m?.title?.slice(0, 40) || (r.found ? '' : '未找到'),
        m?.price ?? '',
        p?.fbaUsd ?? '',
        p?.headCost ?? '',
        p?.commissionCny ?? '',
        p?.profitCny ?? '',
        p?.margin ? p.margin + '%' : '',
        m?.link ?? '',
      ].map(escapeCsvField)
    })
    const csv = [headers.join(','), ...lines.map((l) => l.join(','))].join('\n')
    downloadCsv(csv, `智能选品报告_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const recalcProfit = (r, selIdx) => {
    if (!r.found || !r.matches?.length) return null
    const m = r.matches[selIdx] || r.matches[0]
    const rate = effectiveRate
    const fba = r.profit?.fbaUsd ?? r.fba ?? (r.weightKg ? r.weightKg * 4.5 : 5)
    const headCost = (r.weightKg ?? 0.5) * headRate
    const domestic = parseFloat(domesticPerItem) || 0
    const commissionRate = r.profit?.commissionRate ?? 15
    const revenueCny = r.price * rate
    const costCny = m.price + domestic + headCost
    const commissionCny = r.price * rate * (commissionRate / 100)
    const fbaCny = fba * rate
    const profitCny = revenueCny - costCny - commissionCny - fbaCny
    const margin = revenueCny > 0 ? ((profitCny / revenueCny) * 100).toFixed(1) : '0'
    return { profitCny, margin, purchasePrice: m.price }
  }

  const sortedResults = [...results].sort((a, b) => {
    const pa = a.profit?.profitCny ?? 0
    const pb = b.profit?.profitCny ?? 0
    return pb - pa
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">智能选品</h1>
      <p className="text-sm text-gray-500 mb-6">上传卖家精灵 Excel，以图搜图匹配 1688 供应商并核算利润（1 积分/条，匹配成功才扣。须有商品主图）</p>

      {historyItems.length > 0 && !taskId && !viewingReport && (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">历史报告 ({historyItems.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {historyItems.slice(0, 10).map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() =>
                    fetch(`/api/supplier-matching/reports/${h.id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
                      .then((r) => r.json())
                      .then((d) => setViewingReport(d))
                  }
                  className="text-blue-600 hover:underline"
                >
                  {h.name} · {h.rowsCount} 条 · {new Date(h.createdAt).toLocaleDateString()}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {viewingReport && (
        <div className="mb-6 p-4 bg-white rounded-xl border">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">{viewingReport.name}</span>
            <button type="button" onClick={() => setViewingReport(null)} className="text-sm text-gray-500 hover:text-gray-700">关闭</button>
          </div>
          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50"><th className="border p-1 text-left">商品</th><th className="border p-1">匹配</th><th className="border p-1">毛利¥</th></tr></thead>
              <tbody>
                {(viewingReport.resultData || []).map((r) => (
                  <tr key={r.rowIndex}><td className="border p-1 max-w-[180px] truncate">{r.title}</td><td className="border p-1">{(r.matches?.[0]?.title || (r.found ? '' : '未找到'))?.slice(0, 25)}</td><td className="border p-1">{r.profit?.profitCny ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => { setResults(viewingReport.resultData || []); setTaskStatus({ status: 'done', results: viewingReport.resultData }); setTaskId('viewing'); setViewingReport(null); }} className="mt-2 text-sm text-blue-600 hover:underline">用此报告继续编辑 / 导出</button>
        </div>
      )}

      {!dajiConfigured && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          1688 搜索服务暂未配置，智能选品功能不可用。请联系管理员。
        </div>
      )}

      {!taskId && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">上传卖家精灵 Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
            {parseLoading && <p className="mt-1 text-sm text-gray-500">解析中…</p>}
            {parseError && <p className="mt-1 text-sm text-red-600">{parseError}</p>}
          </div>

          {rows.length > 0 && (
            <>
              <div className="text-sm text-gray-600">已解析 {rows.length} 条，请确认参数后开始分析</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">汇率</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input type="radio" checked={!useManualRate} onChange={() => setUseManualRate(false)} />
                      实时
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input type="radio" checked={useManualRate} onChange={() => setUseManualRate(true)} />
                      手动
                    </label>
                    {useManualRate ? (
                      <input
                        type="text"
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                        className="w-20 border rounded px-2 py-1 text-sm"
                        placeholder="7.2"
                      />
                    ) : (
                      <span className="text-gray-500">{rateLoading ? '…' : exchangeRate}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">头程运费 ¥/kg</label>
                  <div className="flex gap-2">
                    {HEAD_OPTIONS.filter((o) => o.id !== 'custom').map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setHeadPreset(o.id)}
                        className={`px-3 py-1 rounded text-sm ${headPreset === o.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                      >
                        {o.label} ¥{o.rate}
                      </button>
                    ))}
                    <input
                      type="text"
                      value={headPreset === 'custom' ? headCustom : ''}
                      onChange={(e) => {
                        setHeadPreset('custom')
                        setHeadCustom(e.target.value)
                      }}
                      placeholder="自定义"
                      className="w-20 border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">国内运费 元/件</label>
                  <input
                    type="text"
                    value={domesticPerItem}
                    onChange={(e) => setDomesticPerItem(e.target.value)}
                    className="w-24 border rounded px-2 py-1 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">佣金% 覆盖（可选，缺省按类目）</label>
                  <input
                    type="text"
                    value={commissionOverride}
                    onChange={(e) => setCommissionOverride(e.target.value)}
                    className="w-24 border rounded px-2 py-1 text-sm"
                    placeholder="15"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!dajiConfigured || !user}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  开始分析（预计 {rows.length * 5} 秒）
                </button>
                <button
                  type="button"
                  onClick={handleDiagnose}
                  disabled={!dajiConfigured || !user || diagnoseLoading}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  title="用第一条主图测试：拉图→上传→图搜 各步是否成功"
                >
                  {diagnoseLoading ? '诊断中…' : '诊断第一条'}
                </button>
              </div>
              {diagnoseResult && (
                <pre className="mt-2 p-4 bg-gray-50 rounded-lg text-xs overflow-auto max-h-48 border">
                  {JSON.stringify(diagnoseResult, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      {taskId && taskStatus && (
        <div className="space-y-6">
          {taskStatus.status === 'running' && (
            <div className="p-4 bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">分析进度</span>
                <span className="text-sm text-gray-500">
                  {taskStatus.current} / {taskStatus.total}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 transition-all duration-300"
                  style={{ width: `${taskStatus.total ? (taskStatus.current / taskStatus.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {taskStatus.status === 'done' && results.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  导出 CSV
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="报告名称"
                    className="w-40 border rounded px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saveLoading ? '保存中…' : '保存报告'}
                  </button>
                  {savedId && <span className="text-sm text-green-600">已保存</span>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2 text-left">商品</th>
                      <th className="border p-2">售价$</th>
                      <th className="border p-2">1688 匹配</th>
                      <th className="border p-2">采购¥</th>
                      <th className="border p-2">毛利¥</th>
                      <th className="border p-2">毛利率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r) => {
                      const idx = selectedIndex[r.rowIndex] ?? 0
                      const m = r.matches?.[idx]
                      const profit = r.found ? (idx !== (r.selectedIndex ?? 0) ? recalcProfit(r, idx) : r.profit) : null
                      return (
                        <tr key={r.rowIndex} className="hover:bg-gray-50">
                          <td className="border p-2 max-w-[200px] truncate" title={r.title}>
                            {r.title}
                          </td>
                          <td className="border p-2">{r.price}</td>
                          <td className="border p-2">
                            {r.found && r.matches?.length ? (
                              <div>
                                <select
                                  value={idx}
                                  onChange={(e) => setSelectedIndex((s) => ({ ...s, [r.rowIndex]: parseInt(e.target.value, 10) }))}
                                  className="text-xs border rounded px-1 py-0.5"
                                >
                                  {r.matches.map((mm, i) => (
                                    <option key={i} value={i}>
                                      {i === 0 ? '🏅 ' : ''}
                                      {mm.title?.slice(0, 30)}… ¥{mm.price}
                                    </option>
                                  ))}
                                </select>
                                {m?.link && (
                                  <a href={m.link} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                                    链接
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400" title={r.error}>
                                ❌ {r.error || '未找到'}
                              </span>
                            )}
                          </td>
                          <td className="border p-2">{m?.price ?? '—'}</td>
                          <td className="border p-2">{profit?.profitCny ?? '—'}</td>
                          <td className="border p-2">{profit?.margin ? profit.margin + '%' : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
