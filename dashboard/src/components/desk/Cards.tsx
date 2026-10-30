import { BookOpen, Copy, FileText, FlaskConical, Building2, Wrench, Newspaper } from 'lucide-react'
import type { Item, Kind } from '@/lib/desk'
import { KIND_COLOR, KIND_LABEL, STATUS_LABEL, dash, nextCommand, statusColor } from '@/lib/desk'

export const KIND_ICON: Record<Kind, typeof BookOpen> = {
  paper: BookOpen, source: FileText, company: Building2, article: Newspaper, hypothesis: FlaskConical, skill: Wrench,
}

export function KindLabel({ item }: { item: Item }) {
  const Icon = KIND_ICON[item.kind]
  const text = item.kind === 'skill' ? (item.label === 'AGENT' ? 'Agent' : 'สกิล') : item.kind === 'source' && item.label ? item.label : KIND_LABEL[item.kind]
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: KIND_COLOR[item.kind] }}>
      <Icon className="size-3.5" aria-hidden />{text}
    </span>
  )
}

export function Status({ item }: { item: Item }) {
  const s = item.status
  if (!s) return null
  const text = STATUS_LABEL[s] || s
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[12px] text-foreground">
      <span className="size-2 rounded-full" style={{ background: statusColor(s) }} aria-hidden />{text}
    </span>
  )
}

export function Progress({ item }: { item: Item }) {
  const list = item.checklist || []
  if (!list.length) return null
  const done = list.filter((c) => c.done).length
  return (
    <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
      <div className="flex gap-1" aria-hidden>
        {list.map((c, i) => <span key={i} className="h-1.5 w-5 rounded-full" style={{ background: c.done ? 'var(--s-done)' : 'var(--border)' }} />)}
      </div>
      <span>ขั้นต่อไป {done}/{list.length}</span>
    </div>
  )
}

function footer(item: Item) {
  if (item.kind === 'paper') return [item.date, item.source].filter(Boolean).join(' · ')
  if (item.kind === 'source') return [item.date, item.claims ? `ตรวจกับต้นฉบับแล้ว ${item.claims} ข้อ` : ''].filter(Boolean).join(' · ')
  if (item.kind === 'article') return [item.date, item.source].filter(Boolean).join(' · ')
  if (item.kind === 'hypothesis') return `ผลล่าสุด: ${dash(item.result || (item.experiments?.length ? `${item.experiments.length} trial` : ''))}`
  return ''
}

export function DeskCard({ item, i, onOpen, onCopy }: { item: Item; i: number; onOpen: () => void; onCopy: (cmd: string) => void }) {
  const cmd = item.kind === 'skill' ? nextCommand(item) : ''
  return (
    <article
      className="desk-card reveal relative flex min-w-0 flex-col rounded-2xl border bg-card p-6 text-card-foreground"
      style={{ ['--i' as string]: Math.min(i, 8) }}
    >
      <div className="flex items-center justify-between gap-3">
        <KindLabel item={item} />
        <Status item={item} />
      </div>
      <h3 className="clamp-3 mt-3 break-words text-[22px] font-semibold leading-[1.3]">
        <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none [&:focus-visible]:after:ring-2 [&:focus-visible]:after:ring-ring">
          {item.kind === 'hypothesis' ? <span className="font-mono text-[15px] text-muted-foreground">{item.id} </span> : null}{item.title}
        </button>
      </h3>
      <p className="clamp-3 mt-2 text-[15px] leading-[1.65] text-muted-foreground">{dash(item.summary)}</p>
      <Progress item={item} />
      <div className="mt-auto pt-4 text-[13px] text-muted-foreground">
        {item.kind !== 'skill' && item.meta ? <p className="clamp-3 mb-1">{item.kind === 'hypothesis' ? 'มาจาก ' : ''}{item.meta}</p> : null}
        <p>{footer(item)}</p>
      </div>
      {cmd ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCopy(cmd) }}
          className="relative z-10 mt-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="size-3.5" aria-hidden />คัดลอก {item.title}
        </button>
      ) : null}
    </article>
  )
}

export function DeskRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <li className="reveal">
      <button
        type="button"
        onClick={onOpen}
        className="grid min-h-14 w-full grid-cols-[7.5rem_1fr_auto] items-center gap-4 border-b px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[7.5rem_1fr_14rem_auto_6rem]"
      >
        <KindLabel item={item} />
        <span className="truncate text-[15px] font-medium">{item.kind === 'hypothesis' ? `${item.id} ` : ''}{item.title}</span>
        <span className="hidden truncate text-[13px] text-muted-foreground sm:block">{dash(item.meta)}</span>
        <span><Status item={item} /></span>
        <span className="hidden text-right font-mono text-[12px] text-muted-foreground sm:block">{dash(item.date)}</span>
      </button>
    </li>
  )
}
