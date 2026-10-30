// ภาพรวมแบบ graph view ของ Obsidian: จุดลอยตัว ดันกันเอง ลากได้ ปล่อยแล้วไหลกลับเข้าที่
// วาดด้วย SVG และอัปเดตตำแหน่งตรงๆ ทุก tick (ไม่ re-render React) เพื่อให้ลื่น
import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { drag } from 'd3-drag'
import 'd3-transition'
import { REL, type GNode, type Rel, type World } from './graph'

type N = SimulationNodeDatum & { id: string; g: GNode; r: number }
type L = SimulationLinkDatum<N> & { id: string; rel: string; cross: boolean }

const radius = (g: GNode) =>
  g.kind === 'doc' ? 10 : g.kind === 'hypothesis' ? 10 : g.kind === 'concept' ? 6 : g.kind === 'experiment' ? 4.5 : 3.6 + Math.min(g.degree, 5) * 0.55
const docOf = (w: World, id: string) => { const n = w.nodes.get(id); return n?.atom ? n.atom.source : id }

export function crossEdges(w: World) {
  return w.edges.filter((e) => e.rel in REL && docOf(w, e.from) !== docOf(w, e.to))
}

interface Props { world: World; selected: string | null; crossOnly: boolean; onSelect: (id: string | null) => void; onOpenDoc: (id: string) => void }

export function ForceView({ world, selected, crossOnly, onSelect, onOpenDoc }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const sim = useRef<Simulation<N, L> | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [k, setK] = useState(1)

  const { nodes, links } = useMemo(() => {
    const nodes: N[] = [...world.nodes.values()].map((g) => ({ id: g.id, g, r: radius(g) }))
    const links: L[] = world.edges.map((e) => ({ id: e.id, source: e.from, target: e.to, rel: e.rel, cross: e.rel in REL && docOf(world, e.from) !== docOf(world, e.to) }))
    return { nodes, links }
  }, [world])

  // เพื่อนบ้านของจุดที่ชี้หรือเลือก
  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of world.edges) {
      if (!m.has(l.from)) m.set(l.from, new Set()); if (!m.has(l.to)) m.set(l.to, new Set())
      m.get(l.from)!.add(l.to); m.get(l.to)!.add(l.from)
    }
    return m
  }, [world])
  const crossSet = useMemo(() => {
    const s = new Set<string>()
    for (const e of crossEdges(world)) { s.add(e.from); s.add(e.to); s.add(docOf(world, e.from)); s.add(docOf(world, e.to)) }
    return s
  }, [world])

  useEffect(() => {
    const svg = select(svgRef.current!)
    const root = svg.select<SVGGElement>('g.root')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    const s = forceSimulation<N, L>(nodes)
      .force('link', forceLink<N, L>(links).id((d) => d.id)
        .distance((l) => (l.rel === 'has' ? 30 : l.rel === 'about' ? 70 : l.rel === 'tested' ? 26 : 80))
        .strength((l) => (l.rel === 'about' ? 0.25 : l.rel === 'has' ? 0.9 : 0.5)))
      .force('charge', forceManyBody<N>().strength((d) => (d.g.kind === 'atom' ? -38 : -150)).distanceMax(420))
      .force('collide', forceCollide<N>((d) => d.r + 5).iterations(2))
      .force('x', forceX<N>(0).strength(0.045))
      .force('y', forceY<N>(0).strength(0.06))
      .alphaDecay(0.022).velocityDecay(0.32)
    sim.current = s

    const line = root.selectAll<SVGLineElement, L>('line').data(links)
    const node = root.selectAll<SVGGElement, N>('g.node').data(nodes)
    const label = root.selectAll<SVGTextElement, N>('text.fv-label').data(nodes)

    const draw = () => {
      line.attr('x1', (d) => (d.source as N).x!).attr('y1', (d) => (d.source as N).y!)
        .attr('x2', (d) => (d.target as N).x!).attr('y2', (d) => (d.target as N).y!)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
      label.attr('x', (d) => d.x!).attr('y', (d) => d.y! + d.r + 13)
    }
    s.on('tick', draw)

    // ลาก: ระหว่างลากทั้งกราฟขยับตาม ปล่อยแล้วจุดไหลกลับเข้าที่เอง
    node.call(drag<SVGGElement, N>()
      .on('start', (ev, d) => { if (!ev.active) s.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
      .on('end', (ev, d) => { if (!ev.active) s.alphaTarget(0); d.fx = null; d.fy = null }))

    const z: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4])
      .on('zoom', (ev) => { root.attr('transform', ev.transform.toString()); setK(ev.transform.k) })
    svg.call(z).on('dblclick.zoom', null)

    // เริ่ม: คำนวณล่วงหน้านิดหน่อย แล้วให้ที่เหลือไหลให้เห็น · จบแล้วซูมให้พอดีจอ
    s.tick(reduce ? 400 : 60); draw()
    const fit = (ms: number) => {
      const { width, height } = svgRef.current!.getBoundingClientRect()
      const xs = nodes.map((n) => n.x!), ys = nodes.map((n) => n.y!)
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      const sc = Math.min(2, 0.88 / Math.max((x1 - x0) / width, (y1 - y0) / height))
      const t = zoomIdentity.translate(width / 2, height / 2).scale(sc).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
      if (ms) svg.transition().duration(ms).call(z.transform, t); else svg.call(z.transform, t)
    }
    fit(0)
    if (reduce) s.stop(); else { s.alpha(0.6).restart(); const id = setTimeout(() => fit(900), 1400); return () => { clearTimeout(id); s.stop() } }
    return () => { s.stop() }
  }, [nodes, links])

  const lit = hover || selected
  const isOn = (id: string) => (crossOnly ? crossSet.has(id) : true) && (!lit || id === lit || !!adj.get(lit)?.has(id))
  const labelShown = (g: GNode) => g.id === lit || g.kind === 'doc' || g.kind === 'hypothesis'
    || (g.kind === 'concept' && (k > 0.85 || (!!lit && !!adj.get(lit)?.has(g.id))))
    || (g.kind === 'atom' && k > 1.8 && (!lit || !!adj.get(lit)?.has(g.id)))

  return (
    <svg ref={svgRef} className="force-view size-full touch-none select-none" role="group" aria-label="ภาพรวมความรู้: ลากจุดเพื่อขยับ ซูมด้วยล้อเมาส์">
      <defs>
        <radialGradient id="fv-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="var(--fv-bg-0)" /><stop offset="100%" stopColor="var(--fv-bg-1)" />
        </radialGradient>
        <filter id="fv-soft" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.2" floodOpacity="0.18" /></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#fv-bg)" onClick={() => onSelect(null)} />
      <g className="root">
        {links.map((l) => {
          const typed = l.rel in REL ? REL[l.rel as Rel] : null
          const a = typeof l.source === 'object' ? (l.source as N).id : (l.source as string)
          const b = typeof l.target === 'object' ? (l.target as N).id : (l.target as string)
          const on = (crossOnly ? l.cross : true) && (!lit || a === lit || b === lit)
          return (
            <line key={l.id} className="fv-edge" stroke={typed ? typed.color : 'var(--foreground)'}
              strokeWidth={typed ? (l.cross ? 1.8 : 1.3) : 0.7} strokeDasharray={typed?.dash}
              strokeOpacity={on ? (typed ? 0.85 : 0.16) : 0.04} />
          )
        })}
        {nodes.map((n) => {
          const g = n.g, on = isOn(n.id), sel = n.id === selected
          const fill = g.kind === 'concept' ? 'var(--card)' : g.kind === 'atom' ? 'var(--fv-atom)' : g.color
          return (
            <g key={n.id} className="node fv-node" style={{ opacity: on ? 1 : 0.12 }}
              tabIndex={0} role="button" aria-label={`${g.kind === 'atom' ? g.sub : g.kind}: ${g.label}`} aria-pressed={sel}
              onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
              onClick={(e) => { e.stopPropagation(); onSelect(n.id) }}
              onDoubleClick={() => { if (g.kind === 'doc') onOpenDoc(n.id) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id) } }}>
              {sel || n.id === hover ? <circle r={n.r + 6} fill={g.kind === 'atom' ? 'var(--fv-atom)' : g.color} opacity={0.16} className="fv-halo" /> : null}
              <circle r={n.r} fill={fill} stroke={g.kind === 'concept' ? 'var(--muted-foreground)' : 'var(--card)'} strokeWidth={g.kind === 'concept' ? 1.6 : g.kind === 'atom' ? 0.8 : 2}
                filter={g.kind === 'doc' || g.kind === 'hypothesis' ? 'url(#fv-soft)' : undefined} />
            </g>
          )
        })}
        {/* ป้ายอยู่ชั้นบนสุด ไม่ให้จุดอื่นทับ */}
        {nodes.map((n) => {
          const g = n.g, big = g.kind === 'doc' || g.kind === 'hypothesis'
          return (
            <text key={n.id} textAnchor="middle" className="fv-label" aria-hidden
              style={{ opacity: labelShown(g) && isOn(n.id) ? 1 : 0, fontSize: big ? 12.5 : 11, fontWeight: big ? 600 : 450 }}>
              {g.label.length > 34 ? g.label.slice(0, 33) + '…' : g.label}
            </text>
          )
        })}
      </g>
    </svg>
  )
}
