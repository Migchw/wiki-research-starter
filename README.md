# wiki-research-starter

Starter สำหรับสร้าง LLM Wiki ของงานวิจัย quant ให้ AI agent อ่าน paper และเอกสารบริษัท (56-1 One Report, 10-K, 10-Q, earnings call) แล้วเก็บเป็น wiki ที่ตรวจย้อนกลับได้

- ทุก claim อ้างเลขหน้า หัวข้อ หรือนาทีของต้นฉบับ
- ตัวเลขทุกตัวมาจาก script ไม่ได้มาจาก LLM
- hypothesis ต้อง pre-register ก่อนทดสอบ และ backtest ทุกครั้งนับเป็น 1 trial
- เปิดดูได้ทั้งใน Obsidian และใน dashboard (Research Desk)

ใช้ประกอบ Module 11 · Quant Bootcamp (QuantCU × QuantCorner)

## สิ่งที่ต้องมี

- Python และ Node.js
- [Claude Code](https://claude.com/claude-code) หรือ agent อื่นที่อ่าน Agent Skills ได้

## เริ่มต้นใช้งาน

```bash
git clone https://github.com/Migchw/wiki-research-starter my-research-wiki
cd my-research-wiki
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd dashboard && npm install && npm run dev            # เปิด URL ที่ terminal แสดง เช่น http://localhost:5173
```

จากนั้นเปิด `claude` ที่ root ของ repo แล้วพิมพ์ `/` ต้องเห็น skill ครบ 7 ตัว

คู่มือฉบับเต็มอยู่ใน [GUIDE.html](GUIDE.html) (เปิดในเบราว์เซอร์) มี checklist ทีละขั้น วิธีทำงานของแต่ละ skill การใช้ dashboard และวิธีแก้ปัญหาที่พบบ่อย

## Workflow

```
/find-paper, /find-source   หาเอกสาร ตรวจว่ามีจริง เก็บเข้าคิว
        ↓
/ingest-paper, /ingest-source   อ่านต้นฉบับ เขียน source note + article + atoms แล้วเสนอ idea
        ↓
/ask-wiki   ถามจาก vault ทุกคำตอบอ้างที่มา
        ↓
hypothesis (idea → preregistered) → /log-experiment → reviewer → promoted หรือ rejected
```

## Skills

| Skill | ทำอะไร |
|---|---|
| `/find-paper` | ตรวจ metadata ของ paper กับ Crossref และ OpenAlex หาฉบับที่อ่านได้ฟรี แล้วอัปเดต `reading-list.md` |
| `/find-source` | หาเอกสารบริษัทจาก ticker (หุ้นไทยใช้เว็บ IR ของบริษัท หุ้น US ใช้ SEC EDGAR) หรือคลิปจาก YouTube แล้วจดคิวใน `source-list.md` |
| `/ingest-paper` | อ่าน paper เขียน source note ใน `papers/` article ใน `articles/` และ atoms ใน `atoms/` |
| `/ingest-source` | อ่านเอกสารบริษัทหรือ transcript เขียน source note ใน `sources/` article และอัปเดตหน้าบริษัทใน `companies/` |
| `/ask-wiki` | ตอบคำถามจาก vault เท่านั้น ถ้า vault ไม่มีข้อมูลจะบอกว่าต้อง ingest อะไรเพิ่ม |
| `/log-experiment` | รัน test script ของ hypothesis เป็น trial ใหม่ ส่งให้ reviewer ตรวจ แล้วตัดสินตาม kill criteria |
| `/wiki-lint` | ตรวจ vault ด้วย `scripts/wiki_lint.py` และแก้ปัญหาโครงสร้าง |

Subagent `reviewer` (`.claude/agents/reviewer.md`) ตรวจ experiment ทุกชิ้นก่อนเชื่อผล ได้แก่ look-ahead bias, survivorship bias, จำนวน trial และ data snooping

## โครงสร้าง repo

| ที่อยู่ | คืออะไร |
|---|---|
| `AGENTS.md` · `CLAUDE.md` | Golden Rules และ schema ที่ agent ทุกตัวต้องอ่านก่อนทำงาน |
| `.claude/skills/` | skill ทั้ง 7 ตัว |
| `.claude/agents/reviewer.md` | subagent สำหรับตรวจ experiment |
| `.claude/settings.json` | hook ที่รัน lint ทุกครั้งที่ agent เขียนไฟล์ .md (`scripts/lint_hook.py`) |
| `reading-list.md` · `source-list.md` | คิวของ paper และเอกสารบริษัท |
| `templates/` | template ของโน้ตทุกชนิด |
| `scripts/` | script สำหรับ lint, แปลงเอกสารเป็นข้อความ, crop รูป, validate ตัวเลข, backtest และ sync skill |
| `scripts/set100.txt` | รายชื่อหุ้น SET100 |
| `dashboard/` | Research Desk (React + Vite) อ่าน vault อย่างเดียว |

โฟลเดอร์เนื้อหา `papers/` `sources/` `companies/` `concepts/` `articles/` `hypotheses/` `experiments/` `factors/` `atoms/` `facts/` เริ่มต้นว่างทั้งหมด ส่วน `raw/` เก็บ PDF และข้อความเต็มของต้นฉบับไว้ในเครื่อง ไม่ commit ขึ้น git

## Golden Rules

รายละเอียดเต็มอยู่ใน [AGENTS.md](AGENTS.md)

1. ห้ามแก้ไฟล์ใน `raw/` และห้าม commit PDF หรือข้อความเต็มที่มีลิขสิทธิ์
2. LLM ไม่ใช่เครื่องคิดเลข ตัวเลขผล backtest และการคำนวณทุกอย่างต้องมาจาก script
3. pre-register hypothesis ก่อนทดสอบ และห้ามแก้ kill criteria หลังเห็นผล
4. backtest ทุกครั้งคือ 1 trial ต้องมีไฟล์ใน `experiments/` แม้ผลจะแย่
5. hypothesis ที่ไม่ผ่านให้ตั้ง `status: rejected` ห้ามลบไฟล์
6. แยก fact, interpretation และ open question และอ้างที่มาทุกข้อ
7. ห้ามให้ LLM ทำนายหรือให้คะแนนข้อมูลในอดีตแล้วนำไป backtest (look-ahead)
8. ตรวจ vault ด้วย `scripts/wiki_lint.py` ไม่ใช้ AI อ่านตรวจเอง
9. ข้อมูลที่ขัดกันให้บันทึกทั้งสองฝั่งพร้อมที่มา

## ใช้กับ agent อื่น

skill ทุกตัวเป็น Markdown ธรรมดา agent อื่น เช่น Antigravity CLI หรือ Codex อ่านแล้วทำตามได้ สร้างสำเนาด้วย

```bash
python scripts/sync_skills.py
```

ได้ `.agents/skills/` ซึ่งเป็นไฟล์ที่ generate ขึ้นมา ห้ามแก้ตรง ถ้าจะแก้ให้แก้ที่ `.claude/skills/` แล้วรันคำสั่งนี้ใหม่

## License

MIT · เนื้อหาใน repo นี้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
