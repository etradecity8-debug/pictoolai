import { useState } from 'react'

const faqs = [
  {
    question: '通过 PicToolAI 生成的图片，版权归谁所有？',
    answer:
      '归你所有。你拥有 PicToolAI 生成的所有图片的 100% 商用权利，可以自由地将这些图片用于任何平台的电商用途，无需额外署名或授权。',
  },
  {
    question: 'AI 生成图片时，会改变我产品的真实外观吗？',
    answer:
      '不会。我们非常重视产品的真实还原（Subject Integrity），算法不会随意改变产品的结构、颜色或 Logo，只会优化环境光影和场景，让商品在保持真实的前提下更好看。',
  },
  {
    question: '使用这款工具，我需要专业的摄影或设计技能吗？',
    answer:
      '不需要。PicToolAI 专为非设计背景的商家打造，只要有一张清晰的产品图和简单的文字描述，就可以快速生成多场景商品图。',
  },
  {
    question: '生成的图片是否符合 Amazon 或 Shopify 等平台的标准？',
    answer:
      '是的。我们在训练和预设中参考了主流跨境电商平台的展示规范，生成图片更易通过审核，并提升详情页和广告素材的转化表现。',
  },
  {
    question: '相比请美工或外包设计，PicToolAI 有什么优势？',
    answer:
      'PicToolAI 可以大幅降低设计成本和沟通成本，同时保持稳定的视觉质量输出，让你把更多时间花在选品和运营上。',
  },
  {
    question: 'PicToolAI 的目标用户群体是谁？',
    answer:
      'PicToolAI 面向小型电商团队和独立卖家，即使没有专职设计岗位，也能在短时间内搭建出专业水准的店铺视觉体系。',
  },
]

export default function FaqSection() {
  const [activeIndex, setActiveIndex] = useState(0)

  const toggle = (index) => {
    setActiveIndex((prev) => (prev === index ? -1 : index))
  }

  return (
    <section className="py-16 sm:py-24 bg-[#f5f5f5]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center">常见问题</h2>
        <p className="mt-3 text-sm text-gray-500 text-center">
          了解 PicToolAI 如何助力您的电商业务
        </p>

        <div className="mt-10 space-y-4">
          {faqs.map((item, index) => {
            const open = index === activeIndex
            return (
              <div
                key={item.question}
                className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold shrink-0">
                    Q
                  </div>
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {item.question}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-gray-400">
                    <svg
                      className={`w-5 h-5 transform transition-transform ${open ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {open && (
                  <div className="px-5 pb-5 pt-0 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                    {item.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

