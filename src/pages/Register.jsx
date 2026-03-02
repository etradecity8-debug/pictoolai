import { Link } from 'react-router-dom'

export default function Register() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center">免费注册</h1>
        <form className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">邮箱</label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">密码</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="至少 8 位"
            />
          </div>
          <button
            type="button"
            className="w-full rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark"
          >
            注册
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          已有账号？ <Link to="/login" className="text-primary hover:underline">登录</Link>
        </p>
      </div>
    </div>
  )
}
