export default function Gallery() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">图库</h1>
      <p className="mt-2 text-gray-500">您生成的图片将显示在这里</p>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-sm"
          >
            占位图 {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}
