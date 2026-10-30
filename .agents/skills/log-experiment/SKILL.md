---
name: log-experiment
description: รัน backtest ของ hypothesis เป็น trial ใหม่ ส่งให้ Reviewer ตรวจ ลิงก์ experiment เข้า hypothesis แล้วตัดสิน promote / graveyard ตาม kill criteria ใช้เมื่อผู้ใช้สั่ง /log-experiment หรือขอ "รัน experiment", "log ผล backtest"
argument-hint: <H-xxx> <12-1|12-7> [in_sample|out_of_sample]
---
<!-- สร้างจาก .claude/skills/log-experiment/SKILL.md ด้วย scripts/sync_skills.py ห้ามแก้ไฟล์นี้ตรงๆ ให้แก้ต้นฉบับแล้วรันสคริปต์ใหม่ -->

# /log-experiment

Argument: argument ที่ผู้ใช้พิมพ์ต่อจากชื่อ skill (เช่น `H-001 12-7 in_sample` ถ้าไม่ระบุ sample ให้ใช้ `in_sample`)

ทำตามลำดับนี้ทุกครั้ง ห้ามข้ามขั้น และ **ห้ามเขียนหรือคำนวณตัวเลข metric เอง** (AGENTS.md กติกาข้อ 2)

## 1. ตรวจก่อนรัน
- อ่าน hypothesis ใน `hypotheses/` ที่ `id` ตรงกัน ต้องมี `status` เป็น `preregistered` หรือ `testing`
  ถ้าไม่ใช่ ให้หยุดและบอกผู้ใช้ว่าต้อง pre-register ก่อน
- เทียบ config ที่จะรันกับส่วน Pre-registration (lookback, ช่วง sample, quintile, 30 bps) ถ้าไม่ตรง ให้ถามผู้ใช้ก่อน
  เพราะเป็น data snooping
- บอกผู้ใช้ว่าตอนนี้ hypothesis นี้มีกี่ trial แล้ว และการรันนี้จะเป็น trial ที่เท่าไร

## 2. รัน backtest (1 ครั้ง = 1 trial)
```bash
python scripts/backtest_momentum.py --hypothesis <H-xxx> --lookback <lookback> --sample <sample>
```
- ถ้าได้ `REFUSED` ให้หยุดแล้วอธิบายเหตุผลจากข้อความ **ห้ามเติม `--force-oos` เอง** ถ้าผู้ใช้ยืนยันจะใช้
  ให้เตือนว่าจะถูกบันทึกเป็น `oos-before-review`
- จดชื่อไฟล์ `experiments/E-xxx.md` จากบรรทัด `WROTE`

## 3. Reviewer
ใช้ skill `reviewer` เป็นขั้นแยก (ตัดสินจากไฟล์เท่านั้น ไม่อิงบทสนทนาก่อนหน้า) ให้ตรวจ `experiments/E-xxx.md` ที่เพิ่งเขียน รอผล verdict และข้อห้าม promote

## 4. ลิงก์เข้า hypothesis
เพิ่มบรรทัดใต้ `## Experiments` ของ hypothesis (ห้ามแก้ส่วน Pre-registration):
`- [[E-xxx]]: <lookback> (<sample>) · trial <trial_no> · verdict <verdict>`

## 5. ตัดสิน (ใช้ตัวเลขจาก frontmatter ของ experiment เท่านั้น)
kill criteria ใช้กับ experiment ที่ config ตรงกับ `signal` ใน pre-registration เท่านั้น (H-001 = 12-7)
lookback อื่นเป็น **baseline** ใช้เปรียบเทียบได้ แต่ห้ามใช้ส่ง hypothesis เข้า graveyard หรือ promote

| สถานการณ์ | สิ่งที่ทำ |
|---|---|
| verdict `fail` | ไม่เปลี่ยน status ของ hypothesis · สรุปเหตุผลจาก Reviewer notes |
| `in_sample` + `pass` | ไม่เปลี่ยน status · บอกว่า out-of-sample ของ lookback นี้ปลดล็อกแล้ว |
| `out_of_sample` + `pass` + **ผิด** kill criteria | เสนอส่งเข้า graveyard: `status: rejected` และ `rejected_reason` อ้าง E-xxx กับค่าที่ผิดเกณฑ์ |
| `out_of_sample` + `pass` + ผ่าน kill criteria + Reviewer มีข้อห้าม promote | คง `testing` · บอกว่าต้องมี experiment แบบไหนก่อน |
| `out_of_sample` + `pass` + ผ่าน kill criteria + ไม่มีข้อห้าม promote | เสนอ promote: สร้าง `factors/F-xxx.md` จาก `templates/Factor.md` (`evidence` ลิงก์ทุก experiment ที่ใช้) และตั้ง `status: promoted` |

ก่อนเปลี่ยน status เป็น `rejected` หรือ `promoted` ให้แสดงการตัดสินพร้อมตัวเลขที่ใช้ แล้ว **ถามผู้ใช้ยืนยันก่อนเสมอ**
ตัวอย่างรูปแบบ `rejected_reason`: `"E-xxx (12-7, OOS): t_stat <ค่า> < 1.5 (kill criteria)"`

## 6. ปิดงาน
- รัน `python scripts/wiki_lint.py` ต้อง PASS
- ถ้ามีไฟล์ใน `articles/` ที่ `about:` ลิงก์ไปยัง hypothesis นี้ ให้แจ้งผู้ใช้ว่าควรอ่านเนื้อความของบทความนั้นใหม่
  เพราะสถานะเพิ่งเปลี่ยน (ตารางผลใน ```ledger``` อัปเดตเอง แต่ prose ไม่อัปเดต)
- สรุปให้ผู้ใช้ 4 บรรทัด: experiment ที่ได้ · verdict · จำนวน trial รวม · status ของ hypothesis หลังจบ
