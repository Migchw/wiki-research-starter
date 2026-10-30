import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, List, Network, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Toaster } from '@/components/ui/sonner'
import { DeskCard, DeskRow } from '@/components/desk/Cards'
import { DetailSheet } from '@/components/desk/DetailSheet'
import { AtomMap, type Layout } from '@/components/map/AtomMap'
import type { Filter, Group, Index } from '@/lib/desk'
import { FILTERS, GROUP_LABEL, filterOf, slugOf } from '@/lib/desk'

type Sort = 'recent' | 'title' | 'status'
type View = 'grid' | 'list' | 'map'

const EMPTY: Record<Filter, string> = {
  all: 'vault ยังว่าง เริ่มจาก prompt 1–3 แล้ว ingest เอกสารชิ้นแรก',
  paper: 'ยังไม่มี paper · สร้าง /ingest-paper ด้วย prompt 4 แล้ว ingest ด้วย prompt 5',
  source: 'ยังไม่มีเอกสารบริษัท · สร้าง /ingest-source ด้วย prompt 6',
  article: 'ยังไม่มีบทความ · prompt 6 และ S2 ทำให้ ingest เขียนบทความด้วย',
  hypothesis: 'ยังไม่มี hypothesis ในสถานะนี้ · prompt S3 เก็บไอเดียจากการอ่านเป็น checklist',
  skill: 'ยังไม่มีสกิล · สกิลอยู่ใน .claude/skills/ สร้างด้วย prompt 4, 6, 8 และ S1',
}
const ORDER: Record<string, number> = { testing: 0, preregistered: 1, idea: 2, draft: 3, ingested: 4, promoted: 5, rejected: 6 }
const readView = (): View => { try { const v = localStorage.getItem('desk-view'); return v === 'list' || v === 'map' ? v : 'grid' } catch { return 'grid' } }

export default function App() {
  const [data, setData] = useState<Index | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [group, setGroup] = useState<Group | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<View>(readView)
  const [openId, setOpenId] = useState<string | null>(() => decodeURIComponent(location.hash.slice(1)) || null)
  const search = useRef<HTMLInputElement>(null)
  const [layout, setLayout] = useState<Layout>('radial')
  const [mapFocus, setMapFocus] = useState('nflx-10q-2026q3')

  useEffect(() => {
    fetch('/index.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(setData).catch(() => setError('อ่าน index.json ไม่ได้ · รัน npm run index แล้วโหลดหน้าใหม่'))
  }, [])

  // URL hash = รายการที่เปิดอยู่ แชร์ลิงก์ได้ เช่น #H-001
  useEffect(() => {
    const onHash = () => setOpenId(decodeURIComponent(location.hash.slice(1)) || null)
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  const open = useCallback((id: string | null) => {
    history.replaceState(null, '', id ? '#' + encodeURIComponent(id) : location.pathname)
    setOpenId(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) { e.preventDefault(); search.current?.focus() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const items = useMemo(() => data?.items ?? [], [data])
  const byKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of items) { m.set(i.id.toLowerCase(), i.id); m.set(slugOf(i).toLowerCase(), i.id) }
    return m
  }, [items])
  const known = useCallback((k: string) => byKey.get(k.toLowerCase()) ?? null, [byKey])

  const counts = useMemo(() => {
    const c = { paper: 0, source: 0, article: 0, skill: 0, idea: 0, doing: 0, done: 0 }
    for (const i of items) {
      if (i.kind === 'paper' || i.kind === 'article' || i.kind === 'skill' || i.kind === 'source') c[i.kind]++
      if (i.kind === 'hypothesis') c[i.group || 'idea']++
    }
    return c
  }, [items])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = items.filter((i) =>
      (filter === 'all' || filterOf(i.kind) === filter) &&
      (!group || (i.kind === 'hypothesis' && i.group === group)) &&
      (!needle || [i.title, i.summary, i.meta, i.id, i.label].some((f) => f?.toLowerCase().includes(needle))))
    return list.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title, 'th')
        : sort === 'status' ? (ORDER[a.status || ''] ?? 9) - (ORDER[b.status || ''] ?? 9)
          : (b.date || '').localeCompare(a.date || ''))
  }, [items, q, filter, group, sort])

  const current = items.find((i) => i.id === openId) ?? null
  const related = useMemo(() => {
    if (!current) return []
    const mine = new Set(current.links.map((l) => known(l)).filter(Boolean))
    const self = [current.id, slugOf(current)].map((s) => s.toLowerCase())
    return items.filter((i) => i.id !== current.id &&
      (mine.has(i.id) || i.links.some((l) => self.includes(l.toLowerCase())))).slice(0, 12)
  }, [current, items, known])

  const copy = useCallback((cmd: string) => {
    const ok = () => toast('คัดลอกแล้ว วางใน agent ได้เลย', { description: cmd })
    const fail = () => toast('คัดลอกไม่ได้ · เลือกข้อความแล้วกด Ctrl+C', { description: cmd })
    if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(ok, fail); else fail()
  }, [])

  const setV = (v: string) => { if (!v) return; setView(v as View); try { localStorage.setItem('desk-view', v) } catch { /* ไม่มี storage ก็ใช้ค่าเดิม */ } }

  // พื้นของ chip ที่เลือกเลื่อนไปหา chip ใหม่ (Tabs sliding)
  const chipRow = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ x: 0, y: 0, w: 0 })
  useLayoutEffect(() => {
    const place = () => {
      const el = chipRow.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (el) setSlider({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth })
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [filter, data])

  const pickFilter = (f: Filter) => { setFilter(f); setGroup(null) }
  const pickGroup = (g: Group) => { setFilter('hypothesis'); setGroup(group === g ? null : g) }
  const total = counts.idea + counts.doing + counts.done

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#desk" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-card focus:px-3 focus:py-2">ข้ามไปที่รายการ</a>
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-4 pt-8 sm:px-8">
        <h1 className="reveal mr-auto text-[28px] font-semibold leading-tight">Research Desk</h1>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ สรุป ผู้เขียน บริษัท" aria-label="ค้นหา" className="h-10 rounded-full pl-9 pr-10 text-[15px]" />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border px-1.5 font-mono text-[12px] text-muted-foreground">/</kbd>
        </div>
        <ToggleGroup type="single" value={view} onValueChange={setV} variant="outline" aria-label="มุมมอง">
          <ToggleGroupItem value="grid" aria-label="การ์ด"><LayoutGrid key={view + 'g'} className="swap" /></ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="รายการ"><List key={view + 'l'} className="swap" /></ToggleGroupItem>
          <ToggleGroupItem value="map" aria-label="แผนที่ความรู้"><Network key={view + 'm'} className="swap" /></ToggleGroupItem>
        </ToggleGroup>
      </header>

      <main id="desk" className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
        {/* แถบความคืบหน้า: สิ่งที่อ่านแล้ว กับไอเดียที่ทำถึงไหน คลิกเพื่อกรอง */}
        <section aria-label="ความคืบหน้า" className="mt-8 grid gap-6 border-y py-6 md:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            {([['paper', counts.paper, 'paper'], ['source', counts.source, 'เอกสารบริษัท'], ['article', counts.article, 'บทความ'], ['skill', counts.skill, 'สกิล']] as const).map(([f, n, label], i) => (
              <button key={f} type="button" onClick={() => pickFilter(f)} className="group rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="pop block font-mono text-[34px] leading-none tabular-nums" style={{ ['--i' as string]: i }}>{n}</span>
                <span className="text-[13px] text-muted-foreground group-hover:text-foreground">{label}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between text-[13px] text-muted-foreground">
              <span>ไอเดียจากการอ่าน {total} ข้อ</span>
              {group ? <button type="button" className="underline underline-offset-2" onClick={() => setGroup(null)}>ดูทุกสถานะ</button> : null}
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              {(['idea', 'doing', 'done'] as const).map((g) => total ? <span key={g} style={{ width: `${(counts[g] / total) * 100}%`, background: `var(--s-${g})` }} /> : null)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['idea', 'doing', 'done'] as const).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => pickGroup(g)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] hover:bg-muted aria-pressed:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="size-2 rounded-full" style={{ background: `var(--s-${g})` }} aria-hidden />
                  {GROUP_LABEL[g]} <span className="font-mono tabular-nums">{counts[g]}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {view === 'map' && data?.graph ? (
          <AtomMap items={items} graph={data.graph} layout={layout} setLayout={setLayout} focus={mapFocus} setFocus={setMapFocus} onOpenItem={open} onCopy={copy} />
        ) : null}

        <div className={view === 'map' ? 'hidden' : 'mt-6 flex flex-wrap items-center gap-3'}>
          <div ref={chipRow} role="group" aria-label="กรองตามชนิด" className="relative flex flex-wrap gap-1">
            <span className="chip-slider absolute left-0 top-0 h-9 rounded-full bg-primary" style={{ transform: `translate(${slider.x}px, ${slider.y}px)`, width: slider.w }} aria-hidden />
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => pickFilter(f.id)}
                className="relative h-9 rounded-full px-4 text-[14px] transition-colors hover:bg-muted aria-pressed:text-primary-foreground aria-pressed:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {f.label}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-[13px] text-muted-foreground">
            เรียง
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-full border bg-card px-3 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="recent">ล่าสุด</option><option value="title">ชื่อ</option><option value="status">สถานะ</option>
            </select>
          </label>
        </div>

        <p className="sr-only" aria-live="polite">{data ? `แสดง ${shown.length} รายการ` : ''}</p>

        {view === 'map' ? null : error ? <p className="mt-10 rounded-2xl border p-6 text-[15px]">{error}</p>
          : !data ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="กำลังโหลด">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl border bg-card" />)}
            </div>
          ) : !shown.length ? (
            <div className="mt-10 rounded-2xl border border-dashed p-8 text-[15px]">
              <p className="font-medium">{q ? `ไม่พบ "${q}"` : EMPTY[filter]}</p>
              {q ? <button type="button" className="mt-2 text-[14px] text-primary underline underline-offset-2" onClick={() => setQ('')}>ล้างคำค้นหา</button> : null}
            </div>
          ) : view === 'grid' ? (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid">
              {shown.map((i, n) => <DeskCard key={i.id} item={i} i={n} onOpen={() => open(i.id)} onCopy={copy} />)}
            </div>
          ) : (
            <ul className="mt-6 border-t" data-testid="list">{shown.map((i) => <DeskRow key={i.id} item={i} onOpen={() => open(i.id)} />)}</ul>
          )}

        {data ? <p className="mt-12 break-all text-[12px] text-muted-foreground">อ่านจาก <span className="font-mono">{data.vault}</span> · หน้านี้อ่านอย่างเดียว การแก้ทุกอย่างทำผ่าน agent เพื่อให้ผ่าน lint และ hook</p> : null}
      </main>

      <DetailSheet item={current} related={related} known={known} onOpen={open} onClose={() => open(null)} onCopy={copy}
        hasAtoms={!!current && !!data?.graph?.atoms.some((a) => a.source === current.id)}
        onMap={(id) => { setV('map'); setLayout('radial'); setMapFocus(id); open(null) }} />
      <Toaster position="bottom-center" duration={2500} />
    </div>
  )
}
