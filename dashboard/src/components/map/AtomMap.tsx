import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CalendarRange, Copy, FileText, Orbit, Share2, Workflow, X } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Item } from '@/lib/desk'
import { ATOM_TYPE, REL, buildWorld, lineage, radial, timeline, type Graph, type NodeData, type Rel, type World } from './graph'
import { nodeTypes } from './nodes'
import { ForceView, crossEdges } from './ForceView'

export type Layout = 'radial' | 'lineage' | 'timeline' | 'force'
const LAYOUTS: { id: Layout; label: string; hint: string; Icon: typeof Orbit }[] = [
  { id: 'radial', label: 'แก่นของเอกสาร', hint: 'เอกสารนี้บอกอะไร', Icon: Orbit },
  { id: 'lineage', label: 'ไล่ที่มา', hint: 'ทำไมเราถึงเชื่อเรื่องนี้', Icon: Workflow },
  { id: 'timeline', label: 'ตามเวลา', hint: 'อะไรเปลี่ยนไปบ้าง', Icon: CalendarRange },
  { id: 'force', label: 'ภาพรวม', hint: 'ทั้งหมดเชื่อมกันยังไง', Icon: Share2 },
]

interface Props {
  items: Item[]; graph: Graph
  layout: Layout; setLayout: (l: Layout) => void
  focus: string; setFocus: (id: string) => void
  onOpenItem: (id: string) => void; onCopy: (cmd: string) => void
}

export function AtomMap({ items, graph, layout, setLayout, focus, setFocus, onOpenItem, onCopy }: Props) {
  const world = useMemo(() => buildWorld(items, graph), [items, graph])
  const [base, setBase] = useState<{ nodes: Node<NodeData>[]; edges: Edge[]; key: string }>({ nodes: [], edges: [], key: '' })
  const [selected, setSelected] = useState<string | null>(null)
  const [crossOnly, setCrossOnly] = useState(false)
  const cross = useMemo(() => crossEdges(world), [world])
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const docs = useMemo(() => [...world.nodes.values()].filter((n) => n.kind === 'doc'), [world])
  const hyps = useMemo(() => [...world.nodes.values()].filter((n) => n.kind === 'hypothesis'), [world])

  useEffect(() => {
    let alive = true
    const key = layout + ':' + focus
    const done = (r: { nodes: Node<NodeData>[]; edges: Edge[] }) => { if (alive) setBase({ ...r, key }) }
    if (layout === 'radial') done(radial(world, world.nodes.get(focus)?.kind === 'doc' ? focus : docs[0]?.id))
    else if (layout === 'timeline') done(timeline(world))
    else if (layout === 'force') done({ nodes: [], edges: [] })
    else lineage(world, world.nodes.has(focus) ? focus : docs[0]?.id).then(done)
    return () => { alive = false }
  }, [world, layout, focus, docs])

  // เลือกแล้วจางทุกอย่างที่ไม่ได้เชื่อมกับสิ่งที่เลือก
  const near = useMemo(() => {
    if (!selected || !base.nodes.some((n) => n.id === selected)) return null
    const s = new Set([selected])
    for (const e of base.edges) { if (e.source === selected) s.add(e.target); if (e.target === selected) s.add(e.source) }
    return s
  }, [selected, base.edges])
  const nodes = useMemo(() => base.nodes.map((n) => ({
    ...n, selected: n.id === selected, data: { ...n.data, dim: near ? !near.has(n.id) : false },
    ariaLabel: `${n.data.g.kind === 'atom' ? n.data.g.sub : n.data.g.kind}: ${n.data.g.label}`,
  })), [base.nodes, near, selected])
  const edges = useMemo(() => base.edges.map((e) => ({ ...e, style: { ...e.style, opacity: near && !(near.has(e.source) && near.has(e.target)) ? 0.12 : 1 } })), [base.edges, near])

  const focusOptions = layout === 'lineage'
    ? [...hyps, ...docs, ...(world.nodes.get(focus)?.kind === 'atom' ? [world.nodes.get(focus)!] : [])]
    : docs

  return (
    <section aria-label="แผนที่ความรู้" className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={layout} onValueChange={(v) => v && setLayout(v as Layout)} variant="outline" aria-label="แบบการจัด">
          {LAYOUTS.map(({ id, label, Icon }) => (
            <ToggleGroupItem key={id} value={id} aria-label={label} className="gap-1.5 px-3 text-[13px]"><Icon className="size-4" aria-hidden />{label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        {layout === 'radial' || layout === 'lineage' ? (
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            ตั้งต้นที่
            <select value={focus} onChange={(e) => { setFocus(e.target.value); setSelected(null) }} className="h-9 max-w-[16rem] rounded-full border bg-card px-3 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {focusOptions.map((n) => <option key={n.id} value={n.id}>{n.kind === 'atom' ? `atom: ${n.label}` : n.label}</option>)}
            </select>
          </label>
        ) : null}
        <span className="text-[13px] text-muted-foreground">{LAYOUTS.find((l) => l.id === layout)!.hint}</span>
        {layout === 'force' ? (
          <button type="button" role="switch" aria-checked={crossOnly} onClick={() => setCrossOnly(!crossOnly)}
            className="ml-auto inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className={`relative h-4 w-7 rounded-full transition-colors ${crossOnly ? 'bg-primary' : 'bg-muted-foreground/30'}`} aria-hidden>
              <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform ${crossOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            <span className="pl-0.5">เฉพาะที่เชื่อมข้ามเอกสาร</span> <span className="font-mono tabular-nums text-muted-foreground">{cross.length}</span>
          </button>
        ) : <span className="ml-auto text-[13px] text-muted-foreground">เชื่อมข้ามเอกสาร <span className="font-mono tabular-nums">{cross.length}</span> เส้น</span>}
      </div>

      <div className="relative mt-4">
        <div className="h-[72vh] min-h-[480px] overflow-hidden rounded-[20px] border bg-card">
          {layout === 'force' ? (
            <ForceView world={world} selected={selected} crossOnly={crossOnly} onSelect={setSelected} onOpenDoc={(id) => { setLayout('radial'); setFocus(id) }} />
          ) : (
          <ReactFlow
            key={base.key}
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.1} maxZoom={2}
            nodesDraggable={false} nodesConnectable={false} edgesFocusable={false}
            onNodeClick={(_, n) => { if (n.type !== 'lane') setSelected(n.id) }}
            onNodeDoubleClick={(_, n) => { if (n.data.g.kind === 'doc') { setLayout('radial'); setFocus(n.id) } }}
            onPaneClick={() => setSelected(null)}
            colorMode={dark ? 'dark' : 'light'}
          >
            <Background gap={24} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          )}
        </div>
        <Panel world={world} id={selected} onSelect={(id) => {
          if (!base.nodes.some((n) => n.id === id)) { const n = world.nodes.get(id); if (n?.kind === 'atom') { setLayout('radial'); setFocus(n.atom!.source) } }
          setSelected(id)
        }} onClose={() => setSelected(null)} onTrace={(id) => { setLayout('lineage'); setFocus(id) }}
          onRadial={(id) => { setLayout('radial'); setFocus(id) }} onOpenItem={onOpenItem} onCopy={onCopy} />
      </div>
      <Legend />
    </section>
  )
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
      {(Object.keys(REL) as Rel[]).map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={REL[r].color} strokeWidth="2" strokeDasharray={REL[r].dash} /></svg>{REL[r].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border-[1.5px] border-foreground" aria-hidden />ข้อเท็จจริง</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border-[1.5px] border-dashed border-foreground" aria-hidden />การตีความ</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border-[1.5px] border-dotted border-foreground" aria-hidden />ประมาณการ</span>
    </div>
  )
}

interface PanelProps {
  world: World; id: string | null
  onSelect: (id: string) => void; onClose: () => void; onTrace: (id: string) => void; onRadial: (id: string) => void
  onOpenItem: (id: string) => void; onCopy: (cmd: string) => void
}
function Panel({ world, id, onSelect, onClose, onTrace, onRadial, onOpenItem, onCopy }: PanelProps) {
  const n = id ? world.nodes.get(id) : null
  if (!n) {
    return (
      <p className="pointer-events-none absolute left-4 top-4 max-w-[22rem] rounded-[14px] border border-border/60 bg-card/75 p-3 text-[13px] text-muted-foreground backdrop-blur-xl">
        กดจุดใดก็ได้เพื่ออ่าน · atom แต่ละจุดคือ claim หนึ่งแถวพร้อมที่มา · ดับเบิลคลิกเอกสารเพื่อดูแก่นของเอกสารนั้น
      </p>
    )
  }
  const rels = world.edges.filter((e) => (e.from === n.id || e.to === n.id) && e.rel in REL)
  const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const sameConcept = n.kind === 'concept' ? world.edges.filter((e) => e.to === n.id && e.rel === 'about').map((e) => world.nodes.get(e.from)!) : []
  const a = n.atom
  return (
    <aside className="mt-4 overflow-y-auto rounded-[18px] border border-border/70 bg-card/80 p-5 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.4)] backdrop-blur-xl lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:mt-0 lg:w-[360px]" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold" style={{ color: n.color }}>
          {a ? `${ATOM_TYPE[a.type]} · ${world.nodes.get(a.source)?.label} · claim ${a.claim}` : n.kind === 'doc' ? 'เอกสาร' : n.kind === 'concept' ? 'concept' : n.kind === 'hypothesis' ? 'Hypothesis' : 'Experiment'}
        </span>
        <button type="button" onClick={onClose} aria-label="ปิดรายละเอียด atom" className="rounded p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" /></button>
      </div>
      <h3 className="mt-1 text-[18px] font-semibold leading-snug">{n.label}</h3>
      {a ? (
        <>
          <p className="mt-3 text-[15px] leading-[1.65]">{a.text}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">ที่มา: {a.loc}</p>
          {a.concepts.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.concepts.map((c) => <button key={c} type="button" onClick={() => onSelect('c:' + c)} className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{world.nodes.get('c:' + c)?.label}</button>)}
            </div>
          ) : null}
        </>
      ) : n.kind === 'doc' ? <p className="mt-2 text-[14px] text-muted-foreground">{n.item?.title}</p>
        : n.sub ? <p className="mt-2 font-mono text-[13px] text-muted-foreground">{n.sub}</p> : null}

      {rels.length ? (
        <section className="mt-5 border-t pt-4" aria-label="ความสัมพันธ์">
          <h4 className="mb-2 text-[13px] font-semibold text-muted-foreground">เชื่อมกับ</h4>
          <ul className="space-y-3">
            {rels.map((e, i) => {
              const other = world.nodes.get(e.from === n.id ? e.to : e.from)!
              const r = REL[e.rel as Rel]
              return (
                <li key={i} className="text-[14px]">
                  <span className="mr-1.5 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ color: r.color, boxShadow: `inset 0 0 0 1.5px ${r.color}` }}>{e.from === n.id ? r.label + ' →' : '← ' + r.label}</span>
                  <button type="button" onClick={() => onSelect(other.id)} className="text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {other.label}{other.atom ? <span className="text-muted-foreground"> · {world.nodes.get(other.atom.source)?.label}</span> : null}
                  </button>
                  {e.reason ? <p className="mt-1 text-[13px] text-muted-foreground">{e.reason}</p> : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {sameConcept.length ? (
        <section className="mt-5 border-t pt-4" aria-label="atom ใน concept นี้">
          <h4 className="mb-2 text-[13px] font-semibold text-muted-foreground">{sameConcept.length} atom จาก {new Set(sameConcept.map((s) => s.atom!.source)).size} เอกสาร</h4>
          <ul className="space-y-1.5">
            {sameConcept.map((s) => (
              <li key={s.id}><button type="button" onClick={() => onSelect(s.id)} className="text-left text-[14px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{s.label} <span className="text-muted-foreground">· {world.nodes.get(s.atom!.source)?.label}</span></button></li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
        {a ? <button type="button" className={btn} onClick={() => onTrace(n.id)}><Workflow className="size-3.5" aria-hidden />ไล่ที่มา</button> : null}
        {a ? <button type="button" className={btn} onClick={() => onOpenItem(a.source)}><FileText className="size-3.5" aria-hidden />เปิดเอกสาร</button> : null}
        {n.kind === 'doc' ? <button type="button" className={btn} onClick={() => onRadial(n.id)}><Orbit className="size-3.5" aria-hidden />ดูแก่น</button> : null}
        {n.kind === 'doc' || n.kind === 'hypothesis' ? <button type="button" className={btn} onClick={() => onOpenItem(n.id)}><FileText className="size-3.5" aria-hidden />เปิดอ่าน</button> : null}
        {n.kind === 'hypothesis' ? <button type="button" className={btn} onClick={() => onTrace(n.id)}><Workflow className="size-3.5" aria-hidden />ไล่ที่มา</button> : null}
        {a ? <button type="button" className={btn} onClick={() => onCopy(`/ask-wiki "${a.label} มาจากไหน และเอกสารอื่นพูดต่างจากนี้ไหม"`)}><Copy className="size-3.5" aria-hidden />คัดลอกคำถาม</button> : null}
      </div>
    </aside>
  )
}
