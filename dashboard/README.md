# Research Desk (เฉลยของ prompt 13–16)

dashboard หน้าเดียวของ LLM Wiki อ่าน vault อย่างเดียว ไม่แก้ไฟล์ · วิธีใช้อยู่ใน `../GUIDE.html` หัวข้อ 5

```
npm install
npx playwright install chromium   # ครั้งแรกเท่านั้น
npm run dev                       # สร้าง public/index.json แล้วเปิด localhost:5173
npm run index                     # หลัง ingest เอกสารใหม่ แล้ว refresh เบราว์เซอร์
npm test                          # Playwright + axe
```

- อ่าน vault จากโฟลเดอร์ที่อยู่เหนือ `dashboard/` (root ของ repo) · ใช้ vault อื่นด้วย `VAULT=<path> npm run dev`
- `atoms/` คือแก่นของเอกสาร `/ingest-paper` และ `/ingest-source` เขียนให้ · starter ยังว่าง แผนที่จึงไม่มีจุดจนกว่าจะ ingest ชิ้นแรก
- แผนที่ความรู้ 4 แบบ: แก่นของเอกสาร · ไล่ที่มา · ตามเวลา · ภาพรวม (ลอยตัวแบบ Obsidian)
