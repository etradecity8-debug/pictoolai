export default function Pricing() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 text-center">定价</h1>
      <p className="mt-4 text-gray-600 text-center">选择适合您的方案</p>
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {['免费版', '专业版', '企业版'].map((plan, i) => (
          <div
            key={plan}
            className={`p-6 rounded-xl border ${
              i === 1 ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
            } bg-white`}
          >
            <h2 className="text-lg font-semibold text-gray-900">{plan}</h2>
            <p className="mt-2 text-2xl font-bold text-gray-900">¥0 / 月</p>
            <p className="mt-4 text-sm text-gray-500">功能说明占位</p>
            <button
              type="button"
              className={`mt-6 w-full py-2 rounded-lg font-medium transition ${
                i === 1
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              立即使用
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
