import { Link } from 'react-router-dom'

const footerLinks = {
  产品: [
    { to: '/product', label: '产品功能' },
    { to: '/pricing', label: '定价' },
  ],
  公司: [
    { to: '/about', label: '关于我们' },
    { to: '/contact', label: '联系我们' },
  ],
  支持: [
    { to: '/contact', label: '帮助中心' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="text-lg font-semibold text-gray-900">
              <span className="tracking-tight">PicAITool</span>
            </Link>
            <p className="mt-2 text-sm text-gray-500">
              专业 AI 电商设计与视觉风格克隆
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <ul className="mt-3 space-y-2">
                {links.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="text-sm text-gray-500 hover:text-gray-900">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} PicAITool. 仅供学习使用。
        </div>
      </div>
    </footer>
  )
}
