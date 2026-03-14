import { Link } from 'react-router-dom'

export default function Contact() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">联系我们</h1>
      <p className="mt-6 text-lg text-gray-700">请通过微信联系我们：</p>
      <p className="mt-2 text-xl font-medium text-gray-900">微信号：XXXX</p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        返回主页
      </Link>
    </div>
  )
}
