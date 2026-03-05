import { Link } from 'react-router-dom'

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
          专业 AI 电商设计
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          使用业绩最强 Nano Banana 香蕉🍌 模型，一键生成产品图片/风格复刻/服装组图/图片精修，让您的商品更有竞争力。
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            to="/register"
            className="rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary-dark transition"
          >
            开始
          </Link>
          <Link
            to="/product"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            了解产品
          </Link>
        </div>
      </div>
    </section>
  )
}
