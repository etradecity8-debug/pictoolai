const features = [
  {
    title: '零门槛操作',
    desc: '上传产品图与通俗描述，自动生成 15+ 张多场景图，无需复杂提示词',
  },
  {
    title: '智能抠图与背景',
    desc: '精准抠图，自动替换办公室、户外等场景，匹配品类光影逻辑',
  },
  {
    title: '电商全流程适配',
    desc: '专为电商优化，符合真实展示需求，一人替代设计团队',
  },
]

export default function FeatureCards() {
  return (
    <section className="py-16 sm:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center">为什么选择 PicToolAI</h2>
        <p className="mt-3 text-gray-600 text-center">为电商视觉而生的 AI 工具</p>
        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {features.map(({ title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition"
            >
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-3 text-gray-600 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
