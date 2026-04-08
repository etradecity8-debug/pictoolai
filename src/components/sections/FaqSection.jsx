const faqs = [
  {
    question: '用 PicToolAI 生成的图片，版权归谁？',
    answer:
      '版权归您本人。通过本网站生成的图片，您可全权用于商业用途（含 Amazon、速卖通、eBay、独立站及其他销售渠道），无需向平台或第三方另行取得授权，也无需标注来源。',
  },
  {
    question: 'AI 生图会改变产品的真实外观吗？',
    answer:
      '不会刻意改动商品外观。我们强调如实呈现 SKU：不随意改造型、配色与品牌标识；调整主要集中在背景、环境光与整体氛围，让商品在真实前提下更上镜、更易点击。',
  },
  {
    question: '零设计背景也能用吗？',
    answer:
      '可以。PicToolAI 面向非设计师卖家：准备一张清晰产品照和简短文字说明，即可批量产出多组常用电商图片，不依赖摄影棚或专业排版经验。',
  },
  {
    question: '生成图符合 Amazon、eBay、速卖通等平台规范吗？',
    answer:
      '整体按主流跨境站点的展示习惯来设计。预设与提示会兼顾主图白底、场景信息清晰、文案与标题安全区，降低因构图或裁切导致的审核风险，并有利于点击率与转化。（具体以各平台当期规则为准。）',
  },
  {
    question: '相比美工或外包，PicToolAI 有什么优势？',
    answer:
      '周期短、费用结构清晰、修改节奏自己掌控。同一人即可串起组图、修图与 Listing 配图，减少反复对齐需求与改稿轮次，把时间留给选品、投放与运营。',
  },
  {
    question: 'PicToolAI 适合谁用？',
    answer:
      '适合跨境卖家、独立站负责人、精简编制的小团队。即使没有专职视觉岗位，也能较快搭出一套统一、可迭代的店铺视觉，用 AI 放大单品的呈现力。',
  },
]

export default function FaqSection() {
  return (
    <section className="py-12 sm:py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">常见问题</h2>
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
