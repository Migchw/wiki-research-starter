import { useEffect, useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// [[target|label]] → ลิงก์ภายใน · ![[ภาพ]] ซ่อน (ภาพอยู่ในเครื่องเท่านั้น)
const prep = (md: string) =>
  md
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\((?!https?:)[^)]+\)/g, '')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t: string, l?: string) => `[${l || t}](#${encodeURIComponent(t.trim())})`)

function Mermaid({ code }: { code: string }) {
  const id = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral', fontFamily: 'IBM Plex Sans Thai' })
      try { const r = await mermaid.render(id, code); if (alive) setSvg(r.svg) } catch { if (alive) setSvg('') }
    })
    return () => { alive = false }
  }, [code, id])
  if (!svg) return <pre><code>{code}</code></pre>
  return <div className="my-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}

export function Markdown({ text, known, onOpen }: { text: string; known: (id: string) => string | null; onOpen: (id: string) => void }) {
  return (
    <div className="prose-desk">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children }) => {
            if (href.startsWith('#')) {
              const target = known(decodeURIComponent(href.slice(1)))
              if (!target) return <span className="text-muted-foreground">{children}</span>
              return <a href={'#' + target} onClick={(e) => { e.preventDefault(); onOpen(target) }}>{children}</a>
            }
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>
          },
          code: ({ className, children }) => {
            if (className === 'language-mermaid') return <Mermaid code={String(children).trim()} />
            return <code className={className}>{children}</code>
          },
          img: () => null,
        }}
      >
        {prep(text)}
      </ReactMarkdown>
    </div>
  )
}
