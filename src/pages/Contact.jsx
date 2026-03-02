export default function Contact() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">联系我们</h1>
      <form className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">姓名</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="您的姓名"
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
        <div>
          <label className="block text-sm font-medium text-gray-700">留言</label>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="您的问题或建议"
          />
        </div>
        <button
          type="button"
          className="w-full rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark"
        >
          提交
        </button>
      </form>
    </div>
  )
}
