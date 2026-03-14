import { Fragment, useState } from 'react'
import { POINTS_TABLE, SUBSCRIPTION_PLANS } from '../lib/pointsConfig'

/** 联系我们弹窗（付费未接入时引导用户通过微信联系） */
function ContactModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-xl p-8 max-w-sm mx-4">
        <h3 className="text-xl font-bold text-gray-900">联系我们</h3>
        <p className="mt-4 text-gray-700">请通过微信联系我们：</p>
        <p className="mt-2 text-lg font-medium text-gray-900">微信号：13826530864</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

const PLAN_COLORS = {
  entry: 'bg-pink-50',
  pro: 'bg-blue-50',
  enterprise: 'bg-green-50',
}

const PLAN_HIGHLIGHT = {
  entry: 'ring-2 ring-pink-400 ring-inset',
  pro: 'ring-2 ring-blue-400 ring-inset',
  enterprise: 'ring-2 ring-green-500 ring-inset',
}

export default function Pricing() {
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [contactModalOpen, setContactModalOpen] = useState(false)

  const handleSelectPlan = (planId) => {
    setSelectedPlanId((prev) => (prev === planId ? null : planId))
    setContactModalOpen(true)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 text-center">
        赋能您的电商视觉
      </h1>
      <p className="mt-3 text-gray-600 text-center max-w-xl mx-auto">
        灵活的积分系统。简单、可预测，并随您的业务规模扩展。
      </p>

      {/* 积分扣费规则表 */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          积分扣费规则
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          生成一张图片将按所选模型与清晰度扣除相应积分；单张成本 = 套餐总金额 ÷（积分总额 ÷ 单张耗费积分）。下表供您参考。
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white max-w-full -mx-1 px-1">
          <table className="w-full text-sm min-w-[680px]">
            <colgroup>
              <col style={{ minWidth: '7rem' }} />
              <col style={{ minWidth: '4.5rem' }} />
              <col style={{ minWidth: '5rem' }} />
              {SUBSCRIPTION_PLANS.map((plan) => (
                <col key={`${plan.id}-a`} style={{ minWidth: '5.5rem' }} />
              ))}
              {SUBSCRIPTION_PLANS.map((plan) => (
                <col key={`${plan.id}-b`} style={{ minWidth: '5.5rem' }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-left py-3 px-3 font-medium text-gray-700">
                  模型
                </th>
                <th className="text-left py-3 px-3 font-medium text-gray-700">
                  清晰度
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-700">
                  每张图扣积分
                </th>
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isHighlight = selectedPlanId === plan.id
                  const thClass = `text-right py-3 px-3 font-medium text-gray-700 ${PLAN_COLORS[plan.id] || ''} ${isHighlight ? PLAN_HIGHLIGHT[plan.id] || '' : ''}`
                  return (
                    <Fragment key={plan.id}>
                      <th className={thClass}>
                        <span className="inline-block text-right">{plan.name}单张成本</span>
                      </th>
                      <th className={thClass}>
                        <span className="inline-block text-right">{plan.name}预计出图数量</span>
                      </th>
                    </Fragment>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {POINTS_TABLE.map((row, i) => {
                const costPerImage = (plan) =>
                  (plan.price * row.points) / plan.points
                const imagesCount = (plan) =>
                  Math.floor(plan.points / row.points)
                return (
                  <tr
                    key={i}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
                  >
                    <td className="py-3 px-3 text-gray-900">
                      {row.model}
                      {row.model && row.model.includes('Banana') && ' 🍌'}
                    </td>
                    <td className="py-3 px-3 text-gray-700">{row.clarity}</td>
                    <td className="py-3 px-3 text-right font-medium text-gray-900">
                      {row.points}
                    </td>
                    {SUBSCRIPTION_PLANS.map((plan) => {
                      const isHighlight = selectedPlanId === plan.id
                      const tdClass = `py-3 px-3 text-right text-gray-700 ${PLAN_COLORS[plan.id] || ''} ${isHighlight ? PLAN_HIGHLIGHT[plan.id] || '' : ''}`
                      return (
                        <Fragment key={plan.id}>
                          <td className={tdClass}>
                            ${costPerImage(plan).toFixed(2)}
                          </td>
                          <td className={tdClass}>
                            {imagesCount(plan)} 张
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          单张成本 = 套餐总金额 ÷（积分总额 ÷ 单张耗费积分）；预计出图数量 = 套餐积分总数 ÷ 单张图所扣积分（向下取整）。
        </p>
      </section>

      {/* 订阅套餐（仅订阅，无购买积分） */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          订阅套餐
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id
              return (
              <div
                key={plan.id}
                className={`relative p-6 rounded-xl border bg-white ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-white text-xs font-medium">
                    最受欢迎
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {plan.name}
                  </span>
                  {plan.popular && (
                    <svg
                      className="w-5 h-5 text-amber-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  ${plan.price}
                  <span className="text-sm font-normal text-gray-500">
                    /{plan.unit}
                  </span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">√</span>
                    {plan.points} 积分
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">√</span>
                    不过期，随时使用
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">√</span>
                    订阅有效期内长期使用
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`mt-6 w-full py-2.5 rounded-lg font-medium transition ${
                    isSelected
                      ? 'bg-primary text-white hover:bg-primary-dark'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isSelected ? '已选择' : '立即选择'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <ContactModal open={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </div>
  )
}
