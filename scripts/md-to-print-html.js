/**
 * 将 docs/*.md 转为可打印的 HTML，输出到 docs/print/
 * 使用：node scripts/md-to-print-html.js
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'
import { marked } from 'marked'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const docsDir = join(__dirname, '..', 'docs')
const outDir = join(docsDir, 'print')

const printCss = `
  * { box-sizing: border-box; }
  body {
    font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #222;
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }
  h1 { font-size: 1.5em; margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
  h2 { font-size: 1.25em; margin-top: 1.2em; }
  h3 { font-size: 1.1em; margin-top: 1em; }
  h4, h5, h6 { font-size: 1em; margin-top: 0.8em; }
  p { margin: 0.5em 0; }
  ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.95em; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; }
  pre, code { background: #f6f6f6; font-family: Consolas, Monaco, monospace; font-size: 0.9em; }
  pre { padding: 12px; overflow-x: auto; border-radius: 4px; }
  code { padding: 2px 6px; border-radius: 3px; }
  pre code { padding: 0; background: none; }
  blockquote { margin: 0.5em 0; padding-left: 1em; border-left: 4px solid #ddd; color: #555; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  .meta { color: #666; font-size: 0.9em; margin-bottom: 1.5em; }
  @media print {
    body { padding: 12px; font-size: 11pt; }
    h1 { font-size: 14pt; }
    h2 { font-size: 12pt; }
    a { color: #000; }
  }
`

function mdToHtml(mdPath) {
  const name = basename(mdPath, '.md')
  const content = readFileSync(mdPath, 'utf8')
  const htmlBody = marked.parse(content, { gfm: true })
  const title = name.replace(/-/g, ' ')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${printCss}</style>
</head>
<body>
  <div class="meta">${name}.md → 打印版 · ${new Date().toLocaleDateString('zh-CN')}</div>
  ${htmlBody}
</body>
</html>`
}

try {
  mkdirSync(outDir, { recursive: true })
} catch (e) {
  if (e.code !== 'EEXIST') throw e
}

const files = readdirSync(docsDir).filter((f) => f.endsWith('.md'))
for (const f of files) {
  const mdPath = join(docsDir, f)
  const html = mdToHtml(mdPath)
  const outPath = join(outDir, basename(f, '.md') + '.html')
  writeFileSync(outPath, html, 'utf8')
  console.log('OK', f, '→', outPath)
}
console.log('完成：共', files.length, '个文件，输出目录 docs/print/')
