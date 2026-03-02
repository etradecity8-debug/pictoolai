import { Link } from 'react-router-dom'

export default function Login() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center">登录</h1>
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
              placeholder="••••••••"
            />
          </div>
          <Link to="/forgot-password" className="block text-sm text-primary hover:underline">
            忘记密码？
          </Link>
          <button
            type="button"
            className="w-full rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark"
          >
            登录
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          还没有账号？ <Link to="/register" className="text-primary hover:underline">免费注册</Link>
        </p>
      </div>
    </div>
  )
}
