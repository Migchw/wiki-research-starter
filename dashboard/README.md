# Research Desk (เฉลยของ prompt 13–16)

dashboard หน้าเดียวของ LLM Wiki อ่าน vault อย่างเดียว · ข้อกำหนดอยู่ใน `../SPEC.md` และ `../DESIGN.md`

```
npm install
npx playwright install chromium   # ครั้งแรกเท่านั้น
npm run dev                       # สร้าง public/index.json แล้วเปิด localhost:5173
npm test                          # Playwright + axe
```

- อ่าน vault จาก `alpha-research-wiki/` ที่ root ของ repo · ใช้ vault อื่นด้วย `VAULT=<path> npm run dev`
- `atoms/` คือแก่นของเอกสาร (prompt S8) ตอนนี้มี NFLX 4 ชิ้นกับ JT1993 · Claude ร่าง ยังไม่ได้ตรวจด้วยคน
- แผนที่ความรู้ 4 แบบ: แก่นของเอกสาร · ไล่ที่มา · ตามเวลา · ภาพรวม (ลอยตัวแบบ Obsidian)
