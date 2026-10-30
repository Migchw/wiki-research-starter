# AGENTS.md — กติกาของ Research Wiki

ไฟล์นี้ใช้ร่วมกันทุก agent (Claude Code, Antigravity CLI, Codex ฯลฯ) อ่านให้จบก่อนแก้ไฟล์ใดๆ

## ภารกิจ
vault นี้คือ **หน่วยความจำของกระบวนการวิจัย**: เก็บสิ่งที่อ่านจาก paper วิจัย เอกสารบริษัท (56-1 One Report, 10-K, 10-Q, MD&A)
และคลิปหรือ transcript ให้ย้อนตรวจได้ว่าทุกข้อสรุปมาจากเอกสารไหน หน้าไหน นาทีไหน
ชั้นของงาน quant (hypothesis, experiment, factor) บันทึกด้วยว่าลองอะไรไปแล้วกี่ครั้ง

## กติกาทอง
1. **`raw/` ห้ามแก้** และห้ามเก็บ full-text หรือ PDF ของ paper ที่มีลิขสิทธิ์ใน git (เก็บ metadata, DOI และโน้ตของเราเอง)
   ข้อความเต็มของ filing และ transcript ก็เก็บใน `raw/` เท่านั้น (gitignored)
2. **LLM ไม่ใช่เครื่องคิดเลข**: ตัวเลขผล backtest ต้องมาจากสคริปต์ใน `scripts/` เท่านั้น ห้ามเขียนตัวเลขเองหรือประมาณ
   ตัวเลขจากเอกสารต้องคัดตามที่พิมพ์พร้อมที่มา ถ้าจะคำนวณต่อ (อัตราส่วน การเติบโต) ให้สคริปต์คำนวณ
3. **Pre-register ก่อนทดสอบ**: hypothesis ต้องมี `signal`, `in_sample`, `out_of_sample`, `expected_sign`, `kill_criteria`
   และ `status: preregistered` ก่อนรัน experiment แรก ห้ามแก้ kill_criteria หลังเห็นผล
4. **ทุกการรันคือ 1 trial**: ทุก experiment ต้องมีไฟล์ใน `experiments/` แม้ผลจะแย่ ห้ามลบ experiment ที่ล้มเหลว
5. **Graveyard เป็นสถานะ**: hypothesis ที่ไม่รอดให้ตั้ง `status: rejected` พร้อม `rejected_reason` ห้ามลบไฟล์
6. **แยก fact / interpretation / open question** ใน source note ทุกชนิด และอ้างที่มาเสมอ: เลขหน้า (PDF)
   หัวข้อ เช่น `Item 7` (filing ที่เป็น HTML) หรือ `[mm:ss]` (คลิป) · คำพูดของผู้บริหารคือ `interpretation (บริษัท)` ไม่ใช่ fact
7. **ระวัง look-ahead จาก LLM**: ห้ามให้ LLM "ทำนาย" หรือให้คะแนนข้อมูลในอดีตแล้วนำไป backtest เพราะ training data
   รู้อนาคตของช่วงนั้นแล้ว
8. ตรวจความถูกต้องของ vault ด้วย `python scripts/wiki_lint.py` (deterministic) ไม่ใช้การกวาดตาของ AI
9. **ข้อมูลขัดกันให้บันทึกทั้งคู่**: เอกสารใหม่ที่ขัดกับของเดิม ให้เขียนทั้งสองฝั่งพร้อมที่มาในหน้าบริษัท ห้ามลบของเก่า

## โครงสร้าง
| โฟลเดอร์ | เก็บอะไร |
|---|---|
| `raw/` | metadata ของแหล่งข้อมูล ลิงก์ และโน้ตดิบของเรา |
| `articles/` | บทความอ่านเข้าใจสำหรับคนทั่วไป: อธิบาย paper หรือเอกสารบริษัททั้งชิ้น · รายงานงานวิจัยของเรา · คำตอบที่เก็บไว้จาก `/ask-wiki` (`type: article`) |
| `papers/` | source note 1 ไฟล์ต่อ 1 paper (`type: paper`) |
| `sources/` | source note 1 ไฟล์ต่อเอกสารบริษัทหรือคลิป 1 ชิ้น: 56-1 · 10-K · 10-Q · transcript (`type: source`) |
| `companies/` | หน้าบริษัท 1 ไฟล์ต่อ 1 บริษัท ชื่อไฟล์คือ ticker รวมสิ่งที่รู้จากหลาย source (`type: company`) |
| `concepts/` | แนวคิดที่ใช้ซ้ำได้ (`type: concept`) |
| `hypotheses/` | สมมติฐานที่ทดสอบได้ (`type: hypothesis`) · ชั้น quant |
| `experiments/` | ผล backtest 1 ไฟล์ต่อ 1 รัน (`type: experiment`) |
| `factors/` | factor ที่ผ่าน Reviewer gate แล้ว (`type: factor`) |
| `facts/` | ตัวเลขจาก filing ที่ผ่าน `scripts/validate_facts.py` แล้ว (JSON) · `facts/runs/` เก็บ candidate จาก LLM ทุกรอบ |
| `templates/` | template ของทุก type |
| `scripts/` | lint · แปลงเอกสารเป็นข้อความ · validate facts · backtest |

## บทความ (`articles/`) กับ source note (`papers/` · `sources/`)
- **บทความ** เล่าเป็นเรื่องให้คนทั่วไปเข้าใจ paper หรือเอกสารบริษัททั้งชิ้น หรืออธิบายงานวิจัยของเราตั้งแต่คำถามถึงวิธีทำ
  ส่วน **source note** คือตาราง claim สั้นพร้อมเลขหน้า ใช้ตรวจและอ้างอิงใน hypothesis (dashboard ไม่แสดงตาราง claim แต่ลิงก์ไปบทความแทน)
- ภาพจากเอกสาร (กราฟ แผนภาพ slide) เก็บใน `assets/<id>/` ซึ่งไม่ commit ฝังในบทความด้วย `![[assets/...]]` พร้อม caption
  ที่อ่านรู้เรื่องแม้ไม่มีภาพ · กราฟที่วาดเองจากตัวเลขในเอกสารใช้ ```` ```mermaid ```` ซึ่ง commit ได้
- ทุกข้อเท็จจริงจาก paper ในบทความต้องตรวจกับต้นฉบับและใส่เลขหน้า ถ้าอ่านได้แค่ abstract ให้ตั้ง `basis: abstract`
  และเขียนเฉพาะสิ่งที่ abstract รองรับ ห้ามเติมจากความจำของ LLM
- เขียนด้วยคำของเราเอง ห้ามคัดลอกย่อหน้าหรือตารางจาก paper ปิดท้ายด้วยเครดิตและ DOI
- **ห้ามพิมพ์ตัวเลขผล backtest ในบทความ** ใช้ code block ` ```ledger ` ตามด้วย id ของ hypothesis
  แล้ว dashboard จะแสดงตารางผลล่าสุดจาก experiment ให้เอง

## ขั้นตอนมาตรฐาน (ใช้ได้กับทุก agent)
ไฟล์ใน `.claude/skills/*/SKILL.md` เป็น Markdown ธรรมดา agent ตัวไหนก็อ่านแล้วทำตามได้ (Claude Code เรียกเป็น `/ชื่อ`)
สำเนาสำหรับ agent อื่น (เช่น Antigravity CLI) อยู่ที่ `.agents/skills/` สร้างด้วย `python scripts/sync_skills.py` ห้ามแก้ตรงๆ
- `find-paper` ตรวจว่า paper มีจริงและ metadata ถูก หาฉบับที่อ่านได้ฟรี และตรวจว่าไฟล์คือต้นฉบับ ไม่ใช่สรุปจาก AI
- `ingest-paper` อ่านต้นฉบับแล้วเขียน source note (claim table + เลขหน้า) และบทความอธิบาย
- `ingest-source` อ่านเอกสารบริษัทหรือ transcript แล้วเขียน source note ใน `sources/` บทความอธิบาย และอัปเดตหน้าบริษัทใน `companies/`
- `ask-wiki` ตอบคำถามจาก vault เท่านั้น ทุกประโยคมีลิงก์ source + ที่มา ถ้า vault ไม่มีคำตอบให้บอกว่าไม่มี
- `log-experiment` รัน backtest เป็น trial ใหม่ → Reviewer (`.claude/agents/reviewer.md`) → ตัดสินตาม kill criteria
- `wiki-lint` ตรวจ vault ด้วยสคริปต์

## Schema
frontmatter เป็น key ระดับบนสุดเท่านั้น (flat) ห้ามซ้อน object เพราะ Obsidian Properties/Bases ใช้ไม่ได้
ดู field ที่บังคับใน `templates/` และ `scripts/wiki_lint.py`

## Workflow
`paper (queued → ingested → reviewed)` + `article` (อธิบาย paper) → `hypothesis (idea → preregistered → testing → promoted | rejected)`
→ `experiment (reviewer_verdict: pending → pass | fail)` → `factor`

`source (queued → ingested → reviewed)` + `article` (อธิบายเอกสาร) → `company` (รวมหลาย source) → ถามด้วย `/ask-wiki` → คำตอบที่ดีเก็บไว้ใน `articles/`

## ภาษา
เขียนภาษาไทย คงศัพท์เทคนิคเป็นภาษาอังกฤษ ไฟล์ทั้งหมดใช้ชื่อ kebab-case ภาษาอังกฤษ

> เนื้อหาใน vault นี้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
