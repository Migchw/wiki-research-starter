# wiki-research-starter

โครงเปล่าของ LLM Wiki สำหรับอ่าน paper วิจัยและเอกสารบริษัท (56-1, 10-K, 10-Q, คลิป) ให้ AI agent อ่านครั้งเดียวแล้วเก็บเป็น wiki ที่ย้อนตรวจได้ ทุก claim มีเลขหน้า ตัวเลขผ่านการตรวจด้วยสคริปต์ และเปิดดูได้ทั้งใน Obsidian และ dashboard

Module 11 · Quant Bootcamp (QuantCU × QuantCorner) · ตัวอย่างที่ทำเต็มแล้วดูได้ที่ [alpha-research-wiki](https://github.com/Migchw/alpha-research-wiki)

## เริ่มใช้

```bash
git clone https://github.com/Migchw/wiki-research-starter my-research-wiki
cd my-research-wiki
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd dashboard && npm install && npm run dev            # เปิด URL ที่ขึ้นมา
```

แล้วเปิด `claude` ที่ root ของโฟลเดอร์ พิมพ์ `/` ต้องเห็น skill ทั้ง 7 ตัว

คู่มือว่าแต่ละ skill ทำอะไร รันแล้วได้อะไร และ dashboard ทำงานอย่างไร อยู่ใน [GUIDE.html](GUIDE.html) (เปิดในเบราว์เซอร์)

## มีอะไรให้แล้ว

| ชิ้น | ที่อยู่ |
|---|---|
| กติกาที่ agent ทุกตัวอ่าน | `AGENTS.md` · `CLAUDE.md` |
| skill 7 ตัว | `.claude/skills/` (find-paper, find-source, ingest-paper, ingest-source, ask-wiki, log-experiment, wiki-lint) |
| คิวเอกสาร | `reading-list.md` (paper) · `source-list.md` (เอกสารบริษัทและคลิป) |
| subagent ตรวจ experiment | `.claude/agents/reviewer.md` |
| hook lint ทุกครั้งที่เขียน .md | `.claude/settings.json` → `scripts/lint_hook.py` |
| skill สำหรับ agent อื่น | `.agents/skills/` (สร้างจาก `python scripts/sync_skills.py` ห้ามแก้ตรง) |
| แม่แบบโน้ต | `templates/` |
| สคริปต์ | `scripts/` (lint, แปลงเอกสาร, ตัดรูป, ตรวจตัวเลข, backtest, sync) |
| รายชื่อหุ้น SET100 | `scripts/set100.txt` |
| dashboard (Research Desk) | `dashboard/` |

โฟลเดอร์เนื้อหา (`papers/ sources/ companies/ concepts/ articles/ hypotheses/ experiments/ atoms/ facts/`) ว่างไว้ให้เติมเอง ส่วน `raw/` เก็บ PDF และเอกสารต้นฉบับในเครื่อง ไม่เข้า git

## License

MIT
