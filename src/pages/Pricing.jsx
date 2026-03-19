import { useState } from 'react'
import { POINTS_TABLE } from '../lib/pointsConfig'

function ContactModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-xl p-8 max-w-sm mx-4">
        <h3 className="text-xl font-bold text-gray-900">联系我们购买</h3>
        <p className="mt-3 text-gray-700">请通过微信联系我们完成购买：</p>
        <p className="mt-2 text-lg font-semibold text-gray-900">微信号：13826530864</p>
        <p className="mt-3 text-sm text-gray-500">付款后我们将在 1 个工作日内为您充值积分，并告知积分到账及有效期。</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 transition"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

const OPERATIONS = [
  { label: '通用电商生图（Nano Banana 1K）', points: 4, note: '每张' },
  { label: '通用电商生图（Nano Banana 2 标准 1K）', points: 6, note: '每张' },
  { label: '通用电商生图（Nano Banana 2 高清 2K）', points: 10, note: '每张' },
  { label: '通用电商生图（Nano Banana Pro 1K/2K）', points: 12, note: '每张' },
  { label: '通用电商生图（Nano Banana Pro 超清 4K）', points: 20, note: '每张' },
  { label: 'AI 美工（局部重绘/消除/换色/扩图等）', points: 4, note: '每次，实际按所选模型扣费' },
  { label: '侵权风险检测 · 深度查询', points: 20, note: '每次' },
  { label: '侵权风险检测 · 快速筛查', points: 0, note: '免费' },
  { label: '电商AI运营助手（Listing 分析/优化/关键词等）', points: 0, note: '免费' },
]

const PLAN = { price: 200, points: 1000, expireDays: 365 }

export default function Pricing() {
  const [contactModalOpen, setContactModalOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">简单透明的定价</h1>
        <p className="mt-3 text-gray-500 max-w-xl mx-auto text-sm">
          一次购买，按需消耗，有效期内不过期。
        </p>
      </div>

      {/* 套餐卡片 */}
      <div className="flex justify-center mb-12">
        <div className="w-full max-w-sm border-2 border-gray-900 rounded-2xl p-8 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-lg font-semibold text-gray-900">标准套餐</span>
            <span className="text-xs font-medium bg-gray-900 text-white px-2.5 py-0.5 rounded-full">
              唯一套餐
            </span>
          </div>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-5xl font-bold text-gray-900">¥200</span>
            <span className="text-gray-500 text-sm mb-1.5">/ 1000 积分</span>
          </div>
          <ul className="mt-6 space-y-2.5 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span><strong>1000 积分</strong>（1 积分 ≈ ¥0.20）</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>购买之日起 <strong>1 年</strong>有效</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>全功能通用（生图 / AI 美工 / 侵权检测）</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>AI 运营助手分析功能<strong>永久免费</strong>使用</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="mt-8 w-full py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-700 transition text-sm"
          >
            立即购买 — 联系我们
          </button>
          <p className="mt-3 text-center text-xs text-gray-400">微信联系后 1 个工作日内到账</p>
        </div>
      </div>

      {/* 积分用量参考 */}
      <section className="mb-12">
        <h2 className="text-base font-semibold text-gray-900 mb-1">积分用量参考</h2>
        <p className="text-xs text-gray-500 mb-4">1000 积分能做多少事？</p>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">操作类型</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">消耗积分</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">1000积分可做</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONS.map((op, i) => {
                const count = op.points > 0 ? Math.floor(PLAN.points / op.points) : null
                return (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-800">{op.label}</td>
                    <td className="py-3 px-4 text-right">
                      {op.points === 0 ? (
                        <span className="text-emerald-600 font-medium">免费</span>
                      ) : (
                        <span className="font-medium text-gray-900">{op.points} 积分<span className="text-gray-400 font-normal text-xs ml-1">{op.note}</span></span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {op.points === 0 ? (
                        <span className="text-emerald-600">不限次</span>
                      ) : (
                        <span>{count} 次</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 生图积分明细 */}
      <section className="mb-12">
        <h2 className="text-base font-semibold text-gray-900 mb-1">生图积分明细</h2>
        <p className="text-xs text-gray-500 mb-4">各模型 + 清晰度的确切扣费，方便精确估算。</p>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">模型</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">清晰度</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">积分/张</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">折合单价</th>
              </tr>
            </thead>
            <tbody>
              {POINTS_TABLE.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-gray-800">{row.model}</td>
                  <td className="py-3 px-4 text-gray-600">{row.clarity}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">{row.points}</td>
                  <td className="py-3 px-4 text-right text-gray-500">
                    ¥{(PLAN.price * row.points / PLAN.points).toFixed(2)}/张
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          折合单价 = ¥200 × 每张积分 ÷ 1000 积分
        </p>
      </section>

      {/* 常见问题 */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">常见问题</h2>
        <div className="space-y-4">
          {[
            { q: '积分什么时候过期？', a: '购买之日起 1 年内有效，到期后未使用积分自动清零，请在有效期内使用。' },
            { q: '能买多份吗？', a: '可以，每次购买均以购买当日为起点重新计算 1 年有效期，余额叠加。' },
            { q: '哪些功能免费？', a: '侵权快速筛查、电商 AI 运营助手（Listing 生成/优化/竞品/关键词/A+文案等分析功能）均不消耗积分，注册即可使用。' },
            { q: '如何购买？', a: '点击上方「立即购买」按钮，通过微信联系我们，付款后 1 个工作日内完成充值。' },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-medium text-gray-900 text-sm">{item.q}</p>
              <p className="mt-1 text-gray-600 text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <ContactModal open={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </div>
  )
}
