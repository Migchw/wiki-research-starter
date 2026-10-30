---
name: log-experiment
description: รันสคริปต์ทดสอบของ hypothesis (ตาม test_script ที่ pre-register ไว้ ถ้ายังไม่มีสคริปต์ให้ออกแบบและเขียนก่อน trial แรก) เป็น trial ใหม่ ส่งให้ Reviewer ตรวจ ลิงก์ experiment เข้า hypothesis แล้วตัดสิน promote / graveyard ตาม kill criteria ใช้เมื่อผู้ใช้สั่ง /log-experiment หรือขอ "รัน experiment", "log ผล backtest"
argument-hint: <H-xxx> [variant เช่น 12-7] [in_sample|out_of_sample]
---
<!-- สร้างจาก .claude/skills/log-experiment/SKILL.md ด้วย scripts/sync_skills.py ห้ามแก้ไฟล์นี้ตรงๆ ให้แก้ต้นฉบับแล้วรันสคริปต์ใหม่ -->

# /log-experiment

Argument: argument ที่ผู้ใช้พิมพ์ต่อจากชื่อ skill (เช่น `H-001 12-7 in_sample` ถ้าไม่ระบุ sample ให้ใช้ `in_sample` · variant ใช้กับสคริปต์ที่มีหลายแบบ เช่น lookback ของ momentum)

## 0. เลือกสคริปต์ทดสอบ
อ่าน `test_script` ใน frontmatter ของ hypothesis
- มีค่าและไฟล์มีอยู่จริง → ไปข้อ 1
- ว่าง หรือไฟล์ไม่มี และ hypothesis ยังไม่มี experiment เลย → ออกแบบสคริปต์ใหม่ก่อน:
  1. อ่าน Pre-registration (signal · universe · ช่วง sample · expected sign · kill criteria) แล้วดูว่าสคริปต์ที่มีใน `scripts/` ใช้ได้ไหม
     (`backtest_momentum.py` ทดสอบได้เฉพาะ momentum 12-1 / 12-7 บน SET100)
  2. ถ้าใช้ไม่ได้ ให้เสนอแผนเป็นตารางสั้นให้ผู้ใช้อนุมัติก่อนเขียน: ชื่อไฟล์ `scripts/test_<ชื่อ>.py` · ข้อมูลที่ใช้และแหล่ง (เช่น ราคาจาก yfinance, ตัวเลขจาก `facts/*.json`) ·
     วิธีคำนวณ signal · การสร้างพอร์ตหรือวิธีทดสอบ · metric ที่รายงาน · ต้นทุนการซื้อขาย · bias ที่รู้อยู่แล้ว
  3. เขียนสคริปต์โดยใช้ `scripts/backtest_momentum.py` เป็นแบบ และต้องทำตามสัญญานี้ทุกข้อ:
     - รับ `--hypothesis`, `--sample in_sample|out_of_sample`, `--dry-run` (ไม่เขียนไฟล์ ไม่นับ trial)
     - คำนวณ metric เองแล้วเขียน `experiments/E-xxx.md` (frontmatter ตาม `templates/Experiment.md` · `trial_no` ถัดไป · `code_ref` · `reviewer_verdict: pending`) แล้วพิมพ์ `WROTE <path>`
     - ปฏิเสธ `out_of_sample` (พิมพ์ `REFUSED ...`) ถ้ายังไม่มี experiment `in_sample` ของ hypothesis นี้ที่ได้ `reviewer_verdict: pass`
     - ข้อมูลที่ดาวน์โหลดเก็บใน `data/` (ไม่ commit)
  4. รัน `--help` และ `--dry-run` ให้ผ่าน แล้วใส่ `test_script: scripts/test_<ชื่อ>.py` ใน hypothesis ถือเป็นส่วนหนึ่งของ pre-registration
- ว่าง แต่ hypothesis มี experiment แล้ว → หยุด เพราะการเปลี่ยนวิธีทดสอบหลังเห็นผลคือ data snooping ให้เสนอ hypothesis ใหม่แทน
- การแก้สคริปต์หลังมี trial แล้ว (เช่นแก้บั๊ก) ทำได้ แต่ต้องบอกผู้ใช้ และ trial ถัดไปจะมี `code_ref` ใหม่ ห้ามลบ experiment เก่า

ทำตามลำดับนี้ทุกครั้ง ห้ามข้ามขั้น และ **ห้ามเขียนหรือคำนวณตัวเลข metric เอง** (AGENTS.md กติกาข้อ 2)

## 1. ตรวจก่อนรัน
- อ่าน hypothesis ใน `hypotheses/` ที่ `id` ตรงกัน ต้องมี `status` เป็น `preregistered` หรือ `testing`
  ถ้าไม่ใช่ ให้หยุดและบอกผู้ใช้ว่าต้อง pre-register ก่อน
- เทียบ config ที่จะรันกับส่วน Pre-registration (variant, ช่วง sample, วิธีสร้างพอร์ต, ต้นทุน) ถ้าไม่ตรง ให้ถามผู้ใช้ก่อน
  เพราะเป็น data snooping
- บอกผู้ใช้ว่าตอนนี้ hypothesis นี้มีกี่ trial แล้ว และการรันนี้จะเป็น trial ที่เท่าไร

## 2. รัน backtest (1 ครั้ง = 1 trial)
```bash
python <test_script> --hypothesis <H-xxx> --sample <sample> [ตัวเลือกของสคริปต์ เช่น --lookback <variant>]
```
- ถ้าได้ `REFUSED` ให้หยุดแล้วอธิบายเหตุผลจากข้อความ **ห้ามเติม `--force-oos` เอง** ถ้าผู้ใช้ยืนยันจะใช้
  ให้เตือนว่าจะถูกบันทึกเป็น `oos-before-review`
- จดชื่อไฟล์ `experiments/E-xxx.md` จากบรรทัด `WROTE`

## 3. Reviewer
ใช้ skill `reviewer` เป็นขั้นแยก (ตัดสินจากไฟล์เท่านั้น ไม่อิงบทสนทนาก่อนหน้า) ให้ตรวจ `experiments/E-xxx.md` ที่เพิ่งเขียน รอผล verdict และข้อห้าม promote

## 4. ลิงก์เข้า hypothesis
เพิ่มบรรทัดใต้ `## Experiments` ของ hypothesis (ห้ามแก้ส่วน Pre-registration):
`- [[E-xxx]]: <variant> (<sample>) · trial <trial_no> · verdict <verdict>`

## 5. ตัดสิน (ใช้ตัวเลขจาก frontmatter ของ experiment เท่านั้น)
kill criteria ใช้กับ experiment ที่ config ตรงกับ `signal` ใน pre-registration เท่านั้น (H-001 = 12-7)
variant อื่นเป็น **baseline** ใช้เปรียบเทียบได้ แต่ห้ามใช้ส่ง hypothesis เข้า graveyard หรือ promote

| สถานการณ์ | สิ่งที่ทำ |
|---|---|
| verdict `fail` | ไม่เปลี่ยน status ของ hypothesis · สรุปเหตุผลจาก Reviewer notes |
| `in_sample` + `pass` | ไม่เปลี่ยน status · บอกว่า out-of-sample ของ variant นี้ปลดล็อกแล้ว |
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
