import { Link } from 'react-router-dom'

export default function HeroSection() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 py-10 sm:py-12 lg:py-14 text-center">
          {/* 装饰网格 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/20 to-transparent opacity-50" />

          <div className="relative px-6 sm:px-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight sm:whitespace-nowrap">
              智绘电商新生态，重塑商品视觉力
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              依托 <span className="font-bold text-[#4285F4]">Google Gemini Nano Banana</span> 旗舰级影像引擎，深度重构电商视觉工作流，以极致 AI 算力赋能产品生命力
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 hover:bg-slate-100 transition"
              >
                开始
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center rounded-xl border border-slate-500/60 px-6 py-3.5 text-base font-medium text-white hover:bg-white/5 transition"
              >
                联系我们
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
