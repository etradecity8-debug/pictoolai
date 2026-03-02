export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
      <p className="mt-2 text-gray-500">欢迎使用 PicAITool</p>
      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        {['今日生成', '图库总数', '风格数'].map((label, i) => (
          <div key={label} className="p-4 rounded-xl bg-white border border-gray-200">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{i * 12}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
