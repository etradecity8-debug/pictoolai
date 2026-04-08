const features = [
  {
    title: '零门槛生成组图',
    desc: '上传任意实拍产品图，自动生成符合电商规范的白底主图、卖点图、特写图、场景图与交互图等多张素材，无需编写复杂提示词。',
    num: '01',
  },
  {
    title: 'AI 美工一站覆盖',
    desc: '语言转换、文字替换与去除、一键换色、生成/更换场景、提升质感、风格复刻与变迁……电商常用修图能力集中在一处，减少多工具切换。',
    num: '02',
  },
  {
    title: '电商全流程适配',
    desc: '围绕真实电商工作场景设计，从视觉到文案一条链路打通，让个人或小团队也能覆盖美工、翻译与日常运营中的高频需求。',
    num: '03',
  },
  {
    title: '作品库管理',
    desc: '生成作品自动入库，支持检索与批量管理；在作品库中一键带图进入 AI 美工，流程连贯，减少反复下载与上传。',
    num: '04',
  },
  {
    title: 'Listing 生成与优化',
    desc: '覆盖亚马逊、eBay、速卖通等多平台，支持 Listing 生成与优化，帮助产出更易转化、更贴合平台习惯的文案。',
    num: '05',
  },
  {
    title: '浏览器快捷插件',
    desc: '在常用工作界面右键选择图片，直接带图进入 AI 美工或组图流程，省去保存、再找路径上传等步骤。',
    num: '06',
  },
]

export default function FeatureCards() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">为什么选择 PicToolAI</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {features.map(({ title, desc, num }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5 h-full"
            >
              <div className="shrink-0 w-10 sm:w-12">
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
