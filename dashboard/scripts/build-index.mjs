// อ่าน vault (อ่านอย่างเดียว) แล้วเขียน public/index.json ให้หน้าเว็บ
// ใช้: VAULT=<path> node scripts/build-index.mjs   (ค่าเริ่มต้นคือโฟลเดอร์ที่อยู่เหนือ dashboard/)
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const VAULT = path.resolve(process.env.VAULT || path.join(import.meta.dirname, '../..'))
const OUT = path.resolve('public/index.json')

// frontmatter บางไฟล์ไม่ใช่ YAML ที่ถูกต้อง (เช่น description มี ": ") ให้อ่านแบบ key: value ทีละบรรทัดแทน
const parse = (raw) => {
  try { return matter(raw) } catch {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (!m) return { data: {}, content: raw }
    const data = {}
    for (const l of m[1].split(/\r?\n/)) { const k = l.match(/^([\w-]+):\s*(.*)$/); if (k) data[k[1]] = k[2].replace(/^["']|["']$/g, '') }
    return { data, content: raw.slice(m[0].length) }
  }
}

const read = (dir) => {
  const d = path.join(VAULT, dir)
  if (!fs.existsSync(d)) return []
  return fs.readdirSync(d).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = fs.readFileSync(path.join(d, f), 'utf8')
    const { data, content } = parse(raw)
    return { file: `${dir}/${f}`, slug: f.replace(/\.md$/, ''), data, content }
  })
}

const str = (v) => (v === undefined || v === null || v === '' ? '' : Array.isArray(v) ? v.join(', ') : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))
const unlink = (s) => str(s).replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => b || a)
const h1 = (c) => (c.match(/^# (.+)$/m) || [])[1]?.trim()
const links = (c, data) => [...new Set([...(c + JSON.stringify(data)).matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim()))]

// เนื้อในหัวข้อ (## ชื่อ) จนถึงหัวข้อระดับเดียวกันถัดไป
const section = (c, re) => {
  const lines = c.split('\n')
  const i = lines.findIndex((l) => /^##\s/.test(l) && re.test(l))
  if (i < 0) return ''
  const j = lines.findIndex((l, k) => k > i && /^##\s/.test(l))
  return lines.slice(i + 1, j < 0 ? undefined : j).join('\n').trim()
}
const firstPara = (c) => c.replace(/^# .+$/m, '').split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|\||>|!\[|```|---)/.test(p)) || ''
const plain = (s) => unlink(s).replace(/^[-*]\s+/gm, '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim()
const tableRows = (s) => s.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*:?-{2,}/.test(l)).length - 1
// ตัด claim table ออกจากเนื้อที่แสดง แทนด้วยจำนวนข้อที่ตรวจแล้ว
const stripClaims = (c) => c.replace(/^## [^\n]*claim[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/gim, '')
const checklist = (s) => {
  const items = [...s.matchAll(/^\s*[-*] \[( |x|X)\] (.+)$/gm)].map((m) => ({ done: m[1] !== ' ', text: unlink(m[2]) }))
  return items
}
// เหตุผลจากคอร์ส ใช้เมื่อ SKILL.md ยังไม่มีหัวข้อ "ทำไมต้องมี"
const WHY = {
  'find-paper': 'LLM แต่งชื่อ ปี และ DOI ได้ ต้องตรวจกับฐานข้อมูลก่อนเสียเวลาอ่าน',
  'ingest-paper': 'อ่าน paper ยากครั้งเดียวแล้วเก็บไว้พร้อมเลขหน้า ไม่ต้องอ่านใหม่ทุก session',
  'find-source': 'พิมพ์แค่ชื่อหุ้นหรือลิงก์คลิป ก็ได้รายการเอกสารที่ควรอ่าน และคิวว่าชิ้นไหนยังไม่ได้อ่าน',
  'ingest-source': 'เอกสารบริษัทยาวเกิน context window อ่านเฉพาะส่วนสำคัญ แล้วเก็บเป็นความรู้ที่ตรวจได้',
  'ask-wiki': 'ตอบจากสิ่งที่อ่านแล้วพร้อมที่มา ถ้า vault ไม่มีข้อมูลต้องบอกว่าไม่มี',
  'wiki-lint': 'ให้ AI แก้ได้เฉพาะโครงสร้าง ห้ามแก้ตัวเลขเพื่อให้ lint ผ่าน',
  'log-experiment': 'รัน 1 ครั้ง = 1 trial กันการรันซ้ำจนเจอผลที่ชอบ ถ้ายังไม่มีสคริปต์ทดสอบจะออกแบบให้ก่อน trial แรก',
  reviewer: 'คนตรวจที่ไม่ได้เห็นงานมาก่อน มี context แยก จึงจับ bias ได้',
}
const GROUP = { idea: 'idea', preregistered: 'doing', testing: 'doing', promoted: 'done', rejected: 'done' }

const items = []

for (const n of read('papers')) {
  const claims = section(n.content, /claim/i)
  items.push({
    id: n.slug, kind: 'paper', file: n.file,
    title: unlink(n.data.title) || h1(n.content) || n.slug,
    summary: plain(section(n.content, /สรุป 3 บรรทัด/) || firstPara(n.content)),
    meta: unlink(n.data.authors), date: str(n.data.year), source: unlink(n.data.journal),
    status: str(n.data.status), claims: claims ? Math.max(0, tableRows(claims)) : 0,
    body: stripClaims(n.content), links: links(n.content, n.data),
  })
}
for (const n of read('sources')) {
  const claims = section(n.content, /claim/i)
  items.push({
    id: n.slug, kind: 'source', file: n.file,
    title: unlink(n.data.title) || h1(n.content) || n.slug,
    summary: plain(section(n.content, /สรุป 3 บรรทัด/) || firstPara(n.content)),
    meta: unlink(n.data.company), label: str(n.data.doc_type), date: str(n.data.published), source: str(n.data.period),
    status: str(n.data.status), claims: claims ? Math.max(0, tableRows(claims)) : 0,
    body: stripClaims(n.content), links: links(n.content, n.data),
  })
}
for (const n of read('articles')) {
  items.push({
    id: n.slug, kind: 'article', file: n.file,
    title: unlink(n.data.title) || h1(n.content) || n.slug,
    summary: plain(section(n.content, /สรุป/) || firstPara(n.content)),
    meta: unlink(n.data.about), date: str(n.data.created), source: n.data.read_min ? `อ่าน ${n.data.read_min} นาที` : '',
    status: str(n.data.status), body: n.content, links: links(n.content, n.data),
  })
}
const experiments = read('experiments').map((n) => ({
  id: str(n.data.id) || n.slug, hypothesis: unlink(n.data.hypothesis), trial_no: n.data.trial_no ?? null,
  sample: str(n.data.sample), sharpe: n.data.sharpe ?? null, t_stat: n.data.t_stat ?? null,
  verdict: str(n.data.reviewer_verdict), lookback: str(n.data.lookback), date: str(n.data.run_at).slice(0, 10),
}))
for (const n of read('hypotheses')) {
  const id = str(n.data.id) || n.slug
  const next = section(n.content, /ขั้นต่อไป/)
  const status = str(n.data.status) || 'idea'
  const exps = experiments.filter((e) => e.hypothesis === n.slug || e.hypothesis.startsWith(id))
  items.push({
    id, kind: 'hypothesis', file: n.file,
    title: (h1(n.content) || id).replace(new RegExp('^' + id + ':\\s*'), ''),
    summary: plain(str(n.data.next_step) || section(n.content, /ทำไม/) || firstPara(n.content)).slice(0, 280),
    meta: unlink(n.data.sources || n.data.source_papers), date: str(n.data.created),
    status, group: GROUP[status] || 'idea', checklist: checklist(next),
    result: unlink(n.data.result || n.data.rejected_reason), experiments: exps,
    body: n.content, links: links(n.content, n.data),
  })
}
for (const n of read('companies')) {
  items.push({
    id: str(n.data.ticker) || n.slug, kind: 'company', file: n.file,
    title: unlink(n.data.name) || n.slug, summary: plain(firstPara(n.content)).slice(0, 280),
    meta: unlink(n.data.sector), label: str(n.data.ticker), date: str(n.data.created), body: n.content, links: links(n.content, n.data),
  })
}

// skill และ agent อยู่ใน .claude/
const skillsDir = path.join(VAULT, '.claude/skills')
if (fs.existsSync(skillsDir)) {
  for (const d of fs.readdirSync(skillsDir)) {
    const f = path.join(skillsDir, d, 'SKILL.md')
    if (!fs.existsSync(f)) continue
    const { data, content } = parse(fs.readFileSync(f, 'utf8'))
    const name = str(data.name) || d
    const why = plain(section(content, /ทำไมต้องมี/))
    items.push({
      id: `skill-${name}`, kind: 'skill', file: `.claude/skills/${d}/SKILL.md`,
      title: `/${name}`, summary: why || WHY[name] || plain(str(data.description)), meta: plain(str(data.description)),
      command: `/${name}${data['argument-hint'] ? ' ' + str(data['argument-hint']) : ''}`, label: 'SKILL',
      body: content, links: [],
    })
  }
}
const agentsDir = path.join(VAULT, '.claude/agents')
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md'))) {
    const { data, content } = parse(fs.readFileSync(path.join(agentsDir, f), 'utf8'))
    const name = str(data.name) || f.replace(/\.md$/, '')
    items.push({
      id: `agent-${name}`, kind: 'skill', file: `.claude/agents/${f}`, label: 'AGENT',
      title: name, summary: WHY[name] || plain(str(data.description)), meta: plain(str(data.description)),
      command: `ใช้ ${name} ตรวจ <ไฟล์>`, body: content, links: [],
    })
  }
}

// ---------- แก่นของแต่ละเอกสาร (atoms) ----------
// atoms/<source>.json อ้างแถวใน claim table ด้วยเลข claim · ข้อความเต็มและที่มาอ่านจาก claim table เสมอ
// ถ้าอ้างแถวที่ไม่มี หรือเส้นชี้ไปหา atom ที่ไม่มี ให้หยุด (atom ต้องมีที่มาทุกตัว)
const ATOMS = path.resolve(process.env.ATOMS || path.join(VAULT, 'atoms'))
const claimRows = (content) => {
  const sec = section(content, /claim/i)
  const rows = {}
  for (const l of sec.split('\n')) {
    const c = l.split('|').map((x) => x.trim())
    if (c.length < 6 || !/^\d+$/.test(c[1])) continue
    rows[+c[1]] = { text: unlink(c[2]).replace(/\*\*/g, ''), kind: c[3], loc: unlink(c[4]) }
  }
  return rows
}
const atomType = (k) => /ประมาณการ|แผน/.test(k) ? 'forecast' : /^fact/.test(k) ? 'fact'
  : /เรา/.test(k) ? 'ours' : /ผู้เขียน/.test(k) ? 'author' : /บริษัท/.test(k) ? 'company' : 'fact'
const graph = { atoms: [], concepts: [], edges: [], problems: [] }
if (fs.existsSync(ATOMS)) {
  const names = fs.existsSync(path.join(ATOMS, '_concepts.json')) ? JSON.parse(fs.readFileSync(path.join(ATOMS, '_concepts.json'), 'utf8')) : {}
  const docs = Object.fromEntries([...read('papers'), ...read('sources')].map((n) => [n.slug, n]))
  const used = new Set()
  const raw = []
  for (const f of fs.readdirSync(ATOMS).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const a = JSON.parse(fs.readFileSync(path.join(ATOMS, f), 'utf8'))
    const doc = docs[a.source]
    if (!doc) { graph.problems.push(`${f}: ไม่มีเอกสาร ${a.source} ใน vault`); continue }
    const rows = claimRows(doc.content)
    for (const t of a.atoms) {
      const r = rows[t.claim]
      if (!r) { graph.problems.push(`${f}: claim ${t.claim} ไม่มีใน claim table ของ ${a.source}`); continue }
      for (const c of t.concepts || []) { used.add(c); if (!names[c]) graph.problems.push(`${f}: concept ${c} ไม่มีใน _concepts.json`) }
      graph.atoms.push({ id: `${a.source}#${t.claim}`, source: a.source, claim: t.claim, label: t.label, text: r.text, type: atomType(r.kind), loc: r.loc, concepts: t.concepts || [] })
    }
    for (const e of a.edges || []) {
      const norm = (x) => (typeof x === 'number' ? `${a.source}#${x}` : x)
      raw.push({ from: norm(e.from), to: norm(e.to), rel: e.rel, reason: e.reason, file: f })
    }
  }
  const ids = new Set([...graph.atoms.map((x) => x.id), ...items.map((i) => i.id)])
  for (const e of raw) {
    if (!ids.has(e.from) || !ids.has(e.to)) { graph.problems.push(`${e.file}: เส้น ${e.from} → ${e.to} ชี้ไปหาสิ่งที่ไม่มี`); continue }
    graph.edges.push({ from: e.from, to: e.to, rel: e.rel, reason: e.reason })
  }
  const vaultConcepts = new Set(items.filter((i) => i.kind === 'concept').map((i) => i.id))
  graph.concepts = [...used].filter((c) => names[c]).map((c) => ({ id: c, name: names[c], inVault: vaultConcepts.has(c) }))
  if (graph.problems.length) { console.error('atoms ไม่ผ่าน:\n- ' + graph.problems.join('\n- ')); process.exitCode = 1 }
  console.log('atoms', graph.atoms.length, 'edges', graph.edges.length, 'concepts', graph.concepts.length)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ vault: VAULT, built: new Date().toISOString(), items, graph }, null, 1))
const count = items.reduce((a, i) => ((a[i.kind] = (a[i.kind] || 0) + 1), a), {})
console.log('index.json', count)
