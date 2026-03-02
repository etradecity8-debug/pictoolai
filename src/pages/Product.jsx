export default function Product() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">产品功能</h1>
      <p className="mt-4 text-gray-600">
        PicAITool 为电商卖家提供全品类组图、风格复刻、服装组图、图片精修等一站式 AI 视觉能力。
      </p>
      <div className="mt-12 grid sm:grid-cols-2 gap-6">
        {['全品类组图', '风格复刻', '服装组图', '图片精修'].map((name) => (
          <div key={name} className="p-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
            <p className="mt-2 text-sm text-gray-500">产品能力说明占位</p>
          </div>
        ))}
      </div>
    </div>
  )
}
