import { Copy, FileCode2, Orbit } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Markdown } from './Markdown'
import { KindLabel, Status } from './Cards'
import type { Item } from '@/lib/desk'
import { KIND_LABEL, STATUS_LABEL, dash, nextCommand } from '@/lib/desk'

interface Props {
  item: Item | null
  related: Item[]
  known: (id: string) => string | null
  onOpen: (id: string) => void
  onClose: () => void
  onCopy: (cmd: string) => void
  hasAtoms?: boolean
  onMap?: (id: string) => void
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="tick size-4 shrink-0" aria-hidden>
      <rect x="0.5" y="0.5" width="15" height="15" rx="4" fill="var(--s-done)" />
      <path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DetailSheet({ item, related, known, onOpen, onClose, onCopy, hasAtoms, onMap }: Props) {
  const cmd = item ? nextCommand(item) : ''
  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:!max-w-[560px]">
        {item ? (
          <>
            <SheetHeader className="gap-3 border-b p-6 pr-12">
              <div className="flex items-center gap-3"><KindLabel item={item} /><Status item={item} /></div>
              <SheetTitle className="text-[22px] leading-[1.3] font-semibold">
                {item.kind === 'hypothesis' ? `${item.id}: ` : ''}{item.title}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1.5 font-mono text-[12px]">
                <FileCode2 className="size-3.5" aria-hidden />{item.file}
              </SheetDescription>
              {cmd ? (
                <button
                  type="button"
                  onClick={() => onCopy(cmd)}
                  className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-left font-mono text-[13px] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Copy className="size-3.5 shrink-0" aria-hidden /><span className="truncate">คัดลอก {cmd}</span>
                </button>
              ) : null}
              {hasAtoms && onMap ? (
                <button type="button" onClick={() => onMap(item.id)} className="inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Orbit className="size-3.5" aria-hidden />ดูแก่นของเอกสารนี้ในแผนที่
                </button>
              ) : null}
            </SheetHeader>

            <div className="space-y-6 p-6">
              {item.kind === 'hypothesis' ? (
                <section aria-labelledby="h-next">
                  <h3 id="h-next" className="mb-2 text-[13px] font-semibold text-muted-foreground">ขั้นต่อไป</h3>
                  {item.checklist?.length ? (
                    <ul className="space-y-2">
                      {item.checklist.map((c, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[15px]">
                          {c.done ? <Tick /> : <span className="mt-0.5 size-4 shrink-0 rounded border-2" aria-hidden />}
                          <span className={c.done ? 'text-muted-foreground line-through' : ''}>{c.text}</span>
                          <span className="sr-only">{c.done ? '(เสร็จแล้ว)' : '(ยังไม่ทำ)'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-muted-foreground">ยังไม่มี checklist · รัน prompt S3 เพื่อเพิ่มหัวข้อ "ขั้นต่อไป" ใน hypothesis</p>
                  )}
                  <p className="mt-3 text-[14px]"><span className="text-muted-foreground">ผล: </span>{dash(item.result)}</p>
                  {item.experiments?.length ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <caption className="mb-1 text-left text-[13px] font-semibold text-muted-foreground">Experiment ({item.experiments.length} trial)</caption>
                        <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1.5 pr-3 font-medium">trial</th><th className="pr-3 font-medium">lookback</th><th className="pr-3 font-medium">sample</th><th className="pr-3 text-right font-medium">Sharpe</th><th className="pr-3 text-right font-medium">t-stat</th><th className="font-medium">reviewer</th></tr></thead>
                        <tbody className="font-mono tabular-nums">
                          {item.experiments.map((e) => (
                            <tr key={e.id} className="border-b">
                              <td className="whitespace-nowrap py-1.5 pr-3">{e.id}</td><td className="pr-3">{dash(e.lookback)}</td><td className="whitespace-nowrap pr-3">{dash(e.sample)}</td>
                              <td className="pr-3 text-right">{dash(e.sharpe)}</td><td className="pr-3 text-right">{dash(e.t_stat)}</td>
                              <td className="font-sans">{STATUS_LABEL[e.verdict] || dash(e.verdict)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {item.claims ? (
                <p className="rounded-xl bg-muted px-4 py-3 text-[14px]">
                  ตรวจกับต้นฉบับแล้ว {item.claims} ข้อ · ตาราง claim ไม่แสดงในหน้านี้ ดูได้ในไฟล์ {item.file}
                </p>
              ) : null}

              <Markdown text={item.body.replace(/^\s*# .+$/m, '')} known={known} onOpen={onOpen} />

              {related.length ? (
                <section aria-labelledby="h-rel" className="border-t pt-5">
                  <h3 id="h-rel" className="mb-2 text-[13px] font-semibold text-muted-foreground">เกี่ยวข้อง</h3>
                  <ul className="space-y-1">
                    {related.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => onOpen(r.id)} className="w-full rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="mr-2 text-[12px] text-muted-foreground">{KIND_LABEL[r.kind]}</span>{r.kind === 'hypothesis' ? `${r.id} ` : ''}{r.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
