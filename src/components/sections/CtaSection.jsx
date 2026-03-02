import { Link } from 'react-router-dom'

export default function CtaSection() {
  return (
    <section className="py-16 sm:py-24 bg-primary">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-white">立即体验 AI 电商设计</h2>
        <p className="mt-4 text-white/90">
          免费注册，即刻生成多场景商品图与风格复刻
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/register"
            className="rounded-lg bg-white px-6 py-3 text-base font-medium text-primary hover:bg-gray-100 transition"
          >
            免费注册
          </Link>
          <Link
            to="/pricing"
            className="rounded-lg border-2 border-white px-6 py-3 text-base font-medium text-white hover:bg-white/10 transition"
          >
            查看定价
          </Link>
        </div>
      </div>
    </section>
  )
}
