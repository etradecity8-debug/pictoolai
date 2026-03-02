import { useState } from 'react'

const tabs = [
  { id: 'all', label: '全品类组图', desc: '多品类商品一键生成组图，适配各平台与场景' },
  { id: 'style', label: '风格复刻', desc: '上传参考图，一键克隆视觉风格到你的商品图' },
  { id: 'apparel', label: '服装组图', desc: '服装专属场景与模特图，高效出图' },
  { id: 'retouch', label: '图片精修', desc: '智能抠图、调光、背景替换，专业级精修' },
]

const placeholderGrid = Array.from({ length: 6 }, (_, i) => i + 1)

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState('all')

  return (
    <section id="全品类组图" className="py-16 sm:py-24 bg-white scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center">产品能力展示</h2>
        <p className="mt-3 text-gray-600 text-center max-w-2xl mx-auto">
          全品类组图、风格复刻、服装组图、图片精修，一站式满足电商视觉需求
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-2 border-b border-gray-200 pb-4">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              id={tab.label}
              className={`${activeTab === tab.id ? 'block' : 'hidden'} scroll-mt-24`}
              role="tabpanel"
            >
              <p className="text-gray-600 text-center mb-6">{tab.desc}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {placeholderGrid.map((n) => (
                  <div
                    key={n}
                    className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm border border-gray-200"
                  >
                    {tab.label} 示例 {n}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
