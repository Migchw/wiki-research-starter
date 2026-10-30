import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { FlaskConical } from 'lucide-react'
import type { NodeData } from './graph'
import { SIZE } from './graph'

type P = NodeProps<Node<NodeData>>
const hidden = '!size-1 !min-w-0 !border-0 !bg-transparent'
const H = () => (<><Handle type="target" position={Position.Left} className={hidden} /><Handle type="source" position={Position.Right} className={hidden} /></>)
const box = (d: NodeData, selected?: boolean) =>
  `transition-opacity duration-200 ${d.dim ? 'opacity-25' : ''} ${selected || d.focus ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}`

export function DocNode({ data: d, selected }: P) {
  const [w, h] = SIZE.doc
  return (
    <div className={`flex flex-col justify-center rounded-xl border-2 bg-card px-3 ${box(d, selected)}`} style={{ width: w, height: h, borderColor: d.g.color }}>
      <H />
      <span className="truncate text-[14px] font-semibold">{d.g.label}</span>
      <span className="truncate text-[12px] text-muted-foreground">{d.g.sub}{d.g.item?.date ? ` · ${d.g.item.date}` : ''}</span>
    </div>
  )
}

// เส้นขอบบอกชนิด atom: ข้อเท็จจริงเส้นทึบ · การตีความเส้นประ · ประมาณการเส้นจุด
const BORDER: Record<string, string> = { fact: 'solid', company: 'dashed', ours: 'dashed', author: 'dashed', forecast: 'dotted' }
export function AtomNode({ data: d, selected }: P) {
  const [w] = SIZE.atom
  const a = d.g.atom!
  if (d.compact) {
    return (
      <div className={`flex h-10 items-center gap-1.5 rounded-lg border-[1.5px] bg-card px-2.5 ${box(d, selected)}`} style={{ width: w, borderStyle: BORDER[a.type], borderColor: 'var(--foreground)' }}>
        <H /><span className="truncate text-[13px]">{d.g.label}</span>
      </div>
    )
  }
  return (
    <div className={`rounded-xl border-[1.5px] bg-card px-3 py-2 ${box(d, selected)}`} style={{ width: w, minHeight: SIZE.atom[1], borderStyle: BORDER[a.type], borderColor: 'var(--foreground)' }}>
      <H />
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="size-1.5 rounded-full" style={{ background: d.g.color }} aria-hidden />{d.g.sub} · {a.claim}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug">{d.g.label}</span>
    </div>
  )
}

export function ConceptNode({ data: d, selected }: P) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-muted px-3 text-center text-[13px] ${box(d, selected)}`} style={{ width: SIZE.concept[0], height: SIZE.concept[1] }}>
      <H /><span className="truncate">{d.g.label}</span>
    </div>
  )
}

export function HypothesisNode({ data: d, selected }: P) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border-2 bg-card px-3 ${box(d, selected)}`} style={{ width: SIZE.hypothesis[0], height: SIZE.hypothesis[1], borderColor: d.g.color }}>
      <H />
      <FlaskConical className="size-4 shrink-0" style={{ color: d.g.color }} aria-hidden />
      <span className="line-clamp-2 text-[13px] font-medium leading-snug">{d.g.label}</span>
    </div>
  )
}

export function ExperimentNode({ data: d, selected }: P) {
  return (
    <div className={`flex flex-col justify-center rounded-lg border bg-card px-3 font-mono ${box(d, selected)}`} style={{ width: SIZE.experiment[0], height: SIZE.experiment[1] }}>
      <H />
      <span className="truncate text-[12px]">{d.g.label}</span>
      <span className="truncate text-[11px] text-muted-foreground">{d.g.sub}</span>
    </div>
  )
}

export function LaneNode({ data: d }: P) {
  return (
    <div className="w-[200px] border-l-4 pl-3" style={{ borderColor: 'var(--border)' }}>
      <span className="block text-[18px] font-semibold">{d.g.label}</span>
      <span className="text-[12px] text-muted-foreground">{d.g.sub}</span>
    </div>
  )
}

export const nodeTypes = { doc: DocNode, atom: AtomNode, concept: ConceptNode, hypothesis: HypothesisNode, experiment: ExperimentNode, lane: LaneNode }
