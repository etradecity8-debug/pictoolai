const features = [
  {
    title: '操作零门槛',
    desc: '上传产品图与通俗描述，自动生成 15+ 张多场景图，无需复杂提示词',
    num: '01',
  },
  {
    title: '智能修图',
    desc: '图片精修，风格复刻，替换文字，提升质感……你想要的全都有',
    num: '02',
  },
  {
    title: '电商全流程适配',
    desc: '专为电商设计，符合真实电商需求，一人替代美工/翻译/运营团队',
    num: '03',
  },
]

export default function FeatureCards() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">为什么选择 PicToolAI</h2>
          <p className="mt-1 text-gray-500 text-sm">为电商视觉而生的 AI 工具</p>
        </div>

        <div className="space-y-0">
          {features.map(({ title, desc, num }, i) => (
            <div
              key={title}
              className={`flex flex-col sm:flex-row gap-3 sm:gap-6 py-5 sm:py-6 border-gray-100 ${
                i < features.length - 1 ? 'border-b' : ''
              }`}
            >
              <div className="shrink-0 sm:w-14">
                <span className="text-2xl sm:text-3xl font-bold text-gray-200 tabular-nums">
                  {num}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
