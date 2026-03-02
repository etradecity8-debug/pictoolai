export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">设置</h1>
      <div className="mt-8 max-w-md space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">显示名称</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="您的昵称"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">邮箱</label>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="your@email.com"
          />
        </div>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          保存
        </button>
      </div>
    </div>
  )
}
