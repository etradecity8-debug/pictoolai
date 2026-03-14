import { Link } from 'react-router-dom'

export default function CtaSection() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-8 sm:px-10 sm:py-10 text-center">
          {/* 装饰网格 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="relative">
            <h2 className="text-xl sm:text-2xl font-bold text-white">立即体验 AI 电商设计</h2>
            <p className="mt-2 text-slate-300 text-sm sm:text-base">
              免费注册，即刻生成多场景商品图与风格复刻
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition"
              >
                免费注册
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center rounded-xl border border-slate-500/60 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/5 transition"
              >
                查看定价
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
