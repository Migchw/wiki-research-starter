// ชนิดข้อมูลจาก public/index.json (สร้างโดย scripts/build-index.mjs)
export type Kind = 'paper' | 'source' | 'article' | 'hypothesis' | 'company' | 'skill'
export type Group = 'idea' | 'doing' | 'done'

export interface Experiment {
  id: string; trial_no: number | null; sample: string; sharpe: number | null; t_stat: number | null
  verdict: string; lookback: string; date: string
}
export interface Item {
  id: string; kind: Kind; file: string; title: string; summary: string
  meta?: string; label?: string; date?: string; source?: string; status?: string
  claims?: number; group?: Group; checklist?: { done: boolean; text: string }[]
  result?: string; experiments?: Experiment[]; command?: string
  body: string; links: string[]
}
export interface Index { vault: string; built: string; items: Item[]; graph?: import('@/components/map/graph').Graph }

// ตัวกรองบนหน้า: บริษัทอยู่กลุ่มเดียวกับเอกสารบริษัท
export type Filter = 'all' | 'paper' | 'source' | 'article' | 'hypothesis' | 'skill'
export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'paper', label: 'Paper' },
  { id: 'source', label: 'เอกสารบริษัท' },
  { id: 'article', label: 'บทความ' },
  { id: 'hypothesis', label: 'Hypothesis' },
  { id: 'skill', label: 'สกิล' },
]
export const filterOf = (k: Kind): Filter => (k === 'company' ? 'source' : k)

export const KIND_LABEL: Record<Kind, string> = {
  paper: 'Paper', source: 'เอกสารบริษัท', article: 'บทความ', hypothesis: 'Hypothesis', company: 'บริษัท', skill: 'สกิล',
}
export const KIND_COLOR: Record<Kind, string> = {
  paper: 'var(--t-paper)', source: 'var(--t-source)', company: 'var(--t-source)',
  article: 'var(--t-article)', hypothesis: 'var(--t-hypothesis)', skill: 'var(--t-skill)',
}

export const STATUS_LABEL: Record<string, string> = {
  ingested: 'อ่านแล้ว', draft: 'ร่าง', reviewed: 'ตรวจแล้ว', idea: 'ไอเดีย', preregistered: 'ลงทะเบียนแล้ว',
  testing: 'กำลังทดสอบ', promoted: 'ผ่าน', rejected: 'ไม่ผ่าน', pending: 'รอตรวจ', pass: 'ผ่าน', fail: 'ไม่ผ่าน',
}
export const GROUP_LABEL: Record<Group, string> = { idea: 'ไอเดีย', doing: 'กำลังทำ', done: 'เสร็จ' }
export const statusColor = (s?: string) =>
  s === 'rejected' || s === 'fail' ? 'var(--s-bad)'
    : s === 'promoted' || s === 'pass' || s === 'ingested' || s === 'reviewed' ? 'var(--s-done)'
      : s === 'testing' || s === 'preregistered' || s === 'draft' || s === 'pending' ? 'var(--s-doing)'
        : 'var(--s-idea)'

// คำสั่งถัดไปที่คัดลอกไปวางใน agent ได้ (dashboard ไม่แก้ไฟล์เอง)
export const nextCommand = (i: Item): string => {
  if (i.command) return i.command
  if (i.kind === 'hypothesis') return i.group === 'idea' ? `ช่วยเขียน pre-registration ให้ ${i.id}` : `/log-experiment ${i.id}`
  if (i.kind === 'paper' || i.kind === 'source' || i.kind === 'article' || i.kind === 'company') return `/ask-wiki "${i.title.slice(0, 60)} บอกอะไรเราบ้าง"`
  return ''
}

export const slugOf = (i: Item) => i.file.split('/').pop()!.replace(/\.md$/, '')
export const dash = (v?: string | number | null) => (v === undefined || v === null || v === '' ? '—' : String(v))
