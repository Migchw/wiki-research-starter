// แปลง index.json เป็นกราฟเดียว แล้วจัด layout 4 แบบ (radial · lineage · timeline · force)
import type { Edge, Node } from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import type { Item } from '@/lib/desk'
import { KIND_COLOR } from '@/lib/desk'

export interface Atom { id: string; source: string; claim: number; label: string; text: string; type: AtomType; loc: string; concepts: string[] }
export type AtomType = 'fact' | 'company' | 'ours' | 'author' | 'forecast'
export interface GEdge { from: string; to: string; rel: Rel; reason: string }
export type Rel = 'supports' | 'differs' | 'contradicts' | 'explains' | 'questions' | 'updates' | 'leads-to'
export interface Graph { atoms: Atom[]; concepts: { id: string; name: string }[]; edges: GEdge[]; problems: string[] }

export type GKind = 'doc' | 'atom' | 'concept' | 'hypothesis' | 'experiment' | 'lane'
export interface GNode { id: string; kind: GKind; label: string; sub?: string; color: string; atom?: Atom; item?: Item; degree: number }
export type NodeData = { g: GNode; dim?: boolean; focus?: boolean; compact?: boolean }

export const ATOM_TYPE: Record<AtomType, string> = {
  fact: 'ข้อเท็จจริง', company: 'บริษัทพูด', ours: 'เราตีความ', author: 'ผู้เขียนตีความ', forecast: 'ประมาณการ',
}
export const REL: Record<Rel, { label: string; color: string; dash?: string }> = {
  supports: { label: 'เสริม', color: 'var(--s-done)' },
  differs: { label: 'ไม่ตรงกัน', color: 'var(--s-doing)', dash: '6 4' },
  contradicts: { label: 'ขัดกัน', color: 'var(--s-bad)', dash: '6 4' },
  questions: { label: 'ตั้งคำถาม', color: 'var(--s-bad)' },
  explains: { label: 'อธิบาย', color: 'var(--muted-foreground)' },
  updates: { label: 'เปลี่ยนจากเดิม', color: 'var(--t-source)' },
  'leads-to': { label: 'นำไปสู่', color: 'var(--t-hypothesis)' },
}

const shortDoc = (i: Item) => {
  if (i.kind === 'paper') {
    const names = (i.meta || '').split(',').map((n) => n.trim().split(' ').pop()).filter(Boolean)
    return `${names.length > 2 ? names[0] + ' et al.' : names.join(' & ')} ${i.date || ''}`.trim()
  }
  const t = (i.label || '').replace('shareholder-letter', 'Letter').replace('transcript', 'Earnings call')
  return `${t} ${i.source || ''}`.trim()
}

export interface World { nodes: Map<string, GNode>; edges: { id: string; from: string; to: string; rel: Rel | 'has' | 'about' | 'tested'; reason?: string }[] }

export function buildWorld(items: Item[], g: Graph): World {
  const nodes = new Map<string, GNode>()
  const edges: World['edges'] = []
  const docIds = new Set(g.atoms.map((a) => a.source))
  for (const i of items) {
    if (docIds.has(i.id)) nodes.set(i.id, { id: i.id, kind: 'doc', label: shortDoc(i), sub: i.kind === 'paper' ? 'paper' : i.meta, color: KIND_COLOR[i.kind], item: i, degree: 0 })
    if (i.kind === 'hypothesis') {
      nodes.set(i.id, { id: i.id, kind: 'hypothesis', label: `${i.id} ${i.title}`, color: KIND_COLOR.hypothesis, item: i, degree: 0 })
      for (const e of i.experiments || []) {
        const id = 'exp:' + e.id
        nodes.set(id, { id, kind: 'experiment', label: `${e.id} · ${e.lookback} · ${e.sample}`, sub: `Sharpe ${e.sharpe ?? '—'} · t ${e.t_stat ?? '—'}`, color: KIND_COLOR.hypothesis, item: i, degree: 0 })
        edges.push({ id: `${i.id}>${id}`, from: i.id, to: id, rel: 'tested' })
      }
    }
  }
  for (const c of g.concepts) nodes.set('c:' + c.id, { id: 'c:' + c.id, kind: 'concept', label: c.name, color: 'var(--muted-foreground)', degree: 0 })
  for (const a of g.atoms) {
    nodes.set(a.id, { id: a.id, kind: 'atom', label: a.label, sub: ATOM_TYPE[a.type], color: nodes.get(a.source)?.color || 'var(--foreground)', atom: a, degree: 0 })
    edges.push({ id: `${a.source}>${a.id}`, from: a.source, to: a.id, rel: 'has' })
    for (const c of a.concepts) edges.push({ id: `${a.id}>c:${c}`, from: a.id, to: 'c:' + c, rel: 'about' })
  }
  g.edges.forEach((e, n) => edges.push({ id: `e${n}`, from: e.from, to: e.to, rel: e.rel, reason: e.reason }))
  for (const e of edges) { const a = nodes.get(e.from), b = nodes.get(e.to); if (a) a.degree++; if (b) b.degree++ }
  return { nodes, edges: edges.filter((e) => nodes.has(e.from) && nodes.has(e.to)) }
}

// ขนาดโดยประมาณ ใช้จัดตำแหน่ง (React Flow วางจากมุมซ้ายบน)
export const SIZE: Record<GKind, [number, number]> = {
  doc: [210, 60], atom: [210, 66], concept: [170, 36], hypothesis: [230, 70], experiment: [170, 52], lane: [180, 40],
}
const at = (g: GNode, cx: number, cy: number, extra: Partial<NodeData> = {}): Node<NodeData> => ({
  id: g.id, type: g.kind, position: { x: cx - SIZE[g.kind][0] / 2, y: cy - SIZE[g.kind][1] / 2 }, data: { g, ...extra },
})
// marker ของ SVG ใช้ var() ไม่ได้ ต้องแปลงเป็นสีจริงก่อน
const resolve = (v: string) => { const m = v.match(/var\((--[\w-]+)\)/); return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888' : v }
const flowEdges = (w: World, keep: Set<string>, opts: { structural?: boolean } = {}): Edge[] =>
  w.edges.filter((e) => keep.has(e.from) && keep.has(e.to) && (opts.structural !== false || !['has', 'about', 'tested'].includes(e.rel)))
    .map((e) => {
      const typed = e.rel in REL ? REL[e.rel as Rel] : null
      return {
        id: e.id, source: e.from, target: e.to, data: { rel: e.rel, reason: e.reason },
        style: typed ? { stroke: typed.color, strokeWidth: 2, strokeDasharray: typed.dash } : { stroke: 'var(--border)', strokeWidth: 1.2, strokeDasharray: e.rel === 'about' ? '3 4' : undefined },
        markerEnd: typed ? { type: 'arrowclosed' as const, color: resolve(typed.color), width: 16, height: 16 } : undefined,
        zIndex: typed ? 2 : 0,
      } as Edge
    })

const neighbors = (w: World, id: string, typedOnly = false) =>
  w.edges.filter((e) => (e.from === id || e.to === id) && (!typedOnly || e.rel in REL)).map((e) => (e.from === id ? e.to : e.from))

// จอกว้างกว่าสูง จึงยืดวงเป็นวงรี
const SX = 1.35, SY = 0.78
// 1 · Radial: เอกสารอยู่กลาง atoms วงใน · concept เอกสารอื่น และ hypothesis วงนอก
export function radial(w: World, docId: string) {
  const doc = w.nodes.get(docId)
  if (!doc) return { nodes: [], edges: [] }
  const atoms = w.edges.filter((e) => e.from === docId && e.rel === 'has').map((e) => w.nodes.get(e.to)!)
  const r1 = Math.max(300, (atoms.length * 236) / (2 * Math.PI))
  const angle = new Map<string, number>()
  const out: Node<NodeData>[] = [at(doc, 0, 0, { focus: true })]
  atoms.forEach((a, i) => {
    const t = -Math.PI / 2 + (i / atoms.length) * 2 * Math.PI
    angle.set(a.id, t)
    out.push(at(a, Math.cos(t) * r1 * SX, Math.sin(t) * r1 * SY))
  })
  const ring2 = new Map<string, number[]>()
  for (const a of atoms) for (const n of neighbors(w, a.id)) {
    if (n === docId || angle.has(n)) continue
    ring2.set(n, [...(ring2.get(n) || []), angle.get(a.id)!])
  }
  // มุมของวงนอก = ค่าเฉลี่ยมุมของ atom ที่เชื่อม แล้วดันออกไม่ให้ทับกัน
  let list = [...ring2].map(([id, ts]) => ({ id, t: Math.atan2(ts.reduce((s, t) => s + Math.sin(t), 0), ts.reduce((s, t) => s + Math.cos(t), 0)) }))
  list = list.sort((a, b) => a.t - b.t)
  const r2 = Math.max(r1 + 270, (list.length * 215) / (2 * Math.PI))
  const gap = 215 / r2
  for (let k = 0; k < 4; k++) for (let i = 1; i < list.length; i++) if (list[i].t - list[i - 1].t < gap) list[i].t = list[i - 1].t + gap
  const over = list.length ? list[list.length - 1].t - (list[0].t + 2 * Math.PI - gap) : 0
  if (over > 0) list.forEach((x, i) => { x.t -= (over * i) / list.length })
  for (const x of list) out.push(at(w.nodes.get(x.id)!, Math.cos(x.t) * r2 * SX, Math.sin(x.t) * r2 * SY))
  const keep = new Set(out.map((n) => n.id))
  return { nodes: out, edges: flowEdges(w, keep) }
}

// 2 · Lineage: ไล่ซ้ายไปขวา เอกสาร → atom → concept → hypothesis → experiment (ELK layered)
const elk = new ELK()
export async function lineage(w: World, focus: string) {
  const keep = new Set<string>([focus])
  const f = w.nodes.get(focus)
  if (f?.kind === 'doc') {
    for (const e of w.edges) if (e.from === focus && e.rel === 'has') keep.add(e.to)
    for (const id of [...keep]) for (const n of neighbors(w, id)) keep.add(n)
  } else if (f?.kind === 'hypothesis') {
    for (const e of w.edges) if (e.from === focus && e.rel === 'tested') keep.add(e.to)
    const lead = w.edges.filter((e) => e.to === focus && e.rel === 'leads-to').map((e) => e.from)
    lead.forEach((a) => keep.add(a))
    for (const a of lead) for (const n of neighbors(w, a, true)) keep.add(n)
  } else if (f?.kind === 'atom') {
    // ไล่ต้นทาง/ปลายทางของ atom ตามเส้นที่มีความหมาย 2 ชั้น
    let front = [focus]
    for (let d = 0; d < 2; d++) { const next: string[] = []; for (const id of front) for (const n of neighbors(w, id, true)) if (!keep.has(n)) { keep.add(n); next.push(n) } front = next }
  }
  for (const id of [...keep]) { const n = w.nodes.get(id); if (n?.kind === 'atom') keep.add(n.atom!.source); if (n?.kind === 'atom') n.atom!.concepts.forEach((c) => keep.add('c:' + c)) }
  const edges = flowEdges(w, keep)
  const res = await elk.layout({
    id: 'root',
    layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.spacing.nodeNodeBetweenLayers': '90', 'elk.spacing.nodeNode': '22', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF' },
    children: [...keep].map((id) => { const g = w.nodes.get(id)!; return { id, width: SIZE[g.kind][0], height: SIZE[g.kind][1] } }),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })
  const nodes = (res.children || []).map((c) => { const g = w.nodes.get(c.id)!; return { id: c.id, type: g.kind, position: { x: c.x || 0, y: c.y || 0 }, data: { g, focus: c.id === focus } } as Node<NodeData> })
  return { nodes, edges }
}

// 3 · Timeline: แกนนอนคือวันที่ แต่ละแถวคือบริษัท (paper อยู่แถวงานวิจัย) atom เรียงใต้เอกสาร
export function timeline(w: World) {
  const docs = [...w.nodes.values()].filter((n) => n.kind === 'doc').sort((a, b) => (a.item!.date || '').localeCompare(b.item!.date || ''))
  const laneOf = (d: GNode) => (d.item!.kind === 'paper' ? 'งานวิจัย' : d.item!.meta || 'อื่นๆ')
  const lanes = [...new Set(docs.map(laneOf))].sort((a, b) => (a === 'งานวิจัย' ? 1 : b === 'งานวิจัย' ? -1 : a.localeCompare(b)))
  const atomsOf = (id: string) => w.edges.filter((e) => e.from === id && e.rel === 'has').map((e) => w.nodes.get(e.to)!)
  const out: Node<NodeData>[] = []
  let y = 0
  for (const lane of lanes) {
    const ds = docs.filter((d) => laneOf(d) === lane)
    const h = Math.max(...ds.map((d) => atomsOf(d.id).length)) * 50 + 130
    out.push({ id: 'lane:' + lane, type: 'lane', position: { x: -250, y }, data: { g: { id: 'lane:' + lane, kind: 'lane', label: lane, sub: `${ds.length} เอกสาร`, color: 'var(--muted-foreground)', degree: 0 } }, selectable: false })
    for (const d of ds) {
      const x = docs.indexOf(d) * 270
      out.push({ id: d.id, type: 'doc', position: { x, y }, data: { g: d } })
      atomsOf(d.id).forEach((a, i) => out.push({ id: a.id, type: 'atom', position: { x, y: y + 80 + i * 50 }, data: { g: a, compact: true } }))
    }
    y += h
  }
  const keep = new Set(out.map((n) => n.id))
  return { nodes: out, edges: flowEdges(w, keep, { structural: false }).map((e) => ({ ...e, type: 'default' })) }
}
