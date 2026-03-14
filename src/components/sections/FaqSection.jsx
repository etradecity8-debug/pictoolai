const faqs = [
  {
    question: '用 PicToolAI 生成的图片，版权归谁？',
    answer:
      '完全归您所有。您对 PicToolAI 生成的每一张图片享有 100% 商用权利，可自由用于 Amazon、Shopify、独立站等任意电商平台，无需署名或额外授权。',
  },
  {
    question: 'AI 生图会改变产品的真实外观吗？',
    answer:
      '不会。PicToolAI 严格遵循产品真实还原原则：不篡改产品结构、颜色与 Logo，仅在保持商品原貌的前提下优化场景、光影与氛围，让展示更专业、更吸睛。',
  },
  {
    question: '零设计背景也能用吗？',
    answer:
      '可以。PicToolAI 专为电商卖家设计，只需一张清晰产品图和几句通俗描述，即可一键生成多场景组图、风格复刻、图片精修等，无需摄影或设计基础。',
  },
  {
    question: '生成图符合 Amazon、Shopify 等平台规范吗？',
    answer:
      '符合。产品预设与提示词均参考主流跨境电商平台展示规范，主图白底、场景图清晰、文字区域留足安全边距，更易通过平台审核并提升转化。',
  },
  {
    question: '相比美工或外包，PicToolAI 有什么优势？',
    answer:
      '省时间、省成本、可控性更高。一人即可完成组图、修图、Listing 配图及 A+ 详情页，无需反复沟通改稿，把精力集中在选品与运营上。',
  },
  {
    question: 'PicToolAI 适合谁用？',
    answer:
      '面向跨境电商卖家、独立站运营者、小型电商团队。即便没有专职美工，也能快速搭建专业级店铺视觉体系，用 AI 赋能商品生命力。',
  },
]

export default function FaqSection() {
  return (
    <section className="py-12 sm:py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">常见问题</h2>
          <p className="mt-1 text-gray-500 text-sm">了解 PicToolAI 如何助力您的电商业务</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {faqs.map((item, index) => (
            <div
              key={item.question}
              className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
            >
              <div className="shrink-0 w-10">
                <span className="text-xl sm:text-2xl font-bold text-gray-200 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 mb-2">{item.question}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
