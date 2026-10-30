# CLAUDE.md

กติกากลางอยู่ใน `AGENTS.md` อ่านก่อนทุกครั้ง

@AGENTS.md

## เฉพาะ Claude Code
- Skills อยู่ใน `.claude/skills/`: `/find-paper`, `/find-source`, `/ingest-paper`, `/ingest-source`, `/ask-wiki`, `/log-experiment`, `/wiki-lint`
  ถ้าแก้ skill หรือ `reviewer.md` ให้รัน `python scripts/sync_skills.py` เพื่ออัปเดต `.agents/skills/` (สำหรับ agent อื่น)
- Subagent `reviewer` (`.claude/agents/reviewer.md`) ต้องตรวจทุก experiment ก่อนเปลี่ยน `reviewer_verdict`
  และก่อน promote hypothesis เป็น factor
- Hook รัน `python scripts/wiki_lint.py` หลังเขียนไฟล์ใน vault ถ้า lint fail ให้แก้ก่อนทำงานต่อ
- ลำดับอ่านตอนเปิด session: `AGENTS.md` → `hypotheses/` ที่ status เป็น testing → experiment ล่าสุด
