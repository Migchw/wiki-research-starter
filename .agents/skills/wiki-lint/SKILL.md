---
name: wiki-lint
description: ตรวจ vault ด้วย scripts/wiki_lint.py (frontmatter schema, wikilink เสีย, pre-registration, graveyard, trial ซ้ำ) แล้วแก้เฉพาะปัญหาโครงสร้าง ใช้เมื่อผู้ใช้สั่ง /wiki-lint หรือ hook แจ้งว่า lint fail
---
<!-- สร้างจาก .claude/skills/wiki-lint/SKILL.md ด้วย scripts/sync_skills.py ห้ามแก้ไฟล์นี้ตรงๆ ให้แก้ต้นฉบับแล้วรันสคริปต์ใหม่ -->

# /wiki-lint

1. รัน `python scripts/wiki_lint.py` (deterministic ห้ามตรวจด้วยการอ่านเองแทน)
2. ถ้า PASS ให้บอกผู้ใช้สั้นๆ แล้วจบ
3. ถ้า FAIL ให้จัดกลุ่ม error ตามไฟล์ แล้วแก้เฉพาะสิ่งที่ไม่ใช่ข้อมูลวิจัย เช่น field ที่ขาด, enum สะกดผิด,
   wikilink ที่ชื่อไฟล์เปลี่ยน, frontmatter ที่ซ้อน object
4. **ห้ามแก้เพื่อให้ lint ผ่าน** ในกรณีต่อไปนี้ ให้รายงานผู้ใช้แทน:
   - ตัวเลข metric, `trial_no`, `code_ref` ของ experiment (ต้องมาจากสคริปต์)
   - `kill_criteria` หรือส่วน Pre-registration ของ hypothesis
   - การลบ experiment หรือ hypothesis (graveyard เป็นสถานะ ห้ามลบไฟล์)
5. รัน lint ซ้ำจนผ่าน แล้วสรุปว่าแก้อะไรไปบ้าง
