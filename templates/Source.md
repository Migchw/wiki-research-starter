---
type: source
id: company-doctype-period     # เช่น delta-56-1-2025 · nflx-10k-2025
company: "[[TICKER]]"
doc_type: 56-1               # 56-1 | 10-K | 10-Q | MD&A (คำอธิบายผลประกอบการรายไตรมาสที่ส่ง ตลท.) | shareholder-letter (จดหมายรายไตรมาสถึงผู้ถือหุ้น) | transcript | video | other
title: ""
period: ""                   # งวดที่เอกสารพูดถึง เช่น FY2025 · 3Q2026
published:                   # วันที่เอกสารเผยแพร่ (ไม่ใช่วันสิ้นงวด) ใช้กัน look-ahead
url: ""                      # ลิงก์ต้นฉบับจาก SEC EDGAR / SET / IR / YouTube
sha256: ""                   # hash ของไฟล์ต้นฉบับใน raw/ (ถ้าเป็นไฟล์)
locator: page                # page | section | timestamp: ที่มาในตารางใช้หน่วยไหน
status: queued
tags: [source]
created: {{date}}
---

# {{title}}

## สรุป 3 บรรทัด

## Claim table
| # | Claim | ประเภท | ที่มา (หน้า / หัวข้อ / นาที) |
|---|---|---|---|
| 1 |  | fact / interpretation (บริษัท) / interpretation (เรา) / open question | p. |

## ตัวเลขที่ต้องใช้ต่อ
ตัวเลขที่จะคำนวณต่อให้ผ่าน `scripts/validate_facts.py` ก่อน (ดู `facts/`) ห้ามคำนวณในโน้ตนี้

## ขัดหรือเสริมกับเอกสารอื่น
- 

## Open questions
