---
name: find-source
description: กวาดหาเอกสารของบริษัทจากชื่อหุ้น (หุ้นไทย: 56-1 One Report, MD&A, งบ, Opportunity Day · หุ้น US: 10-K, 10-Q, 8-K, shareholder letter, earnings call) หรือจากลิงก์ YouTube แล้วรายงานว่าเจออะไร ให้ผู้ใช้เลือก เก็บไฟล์ไว้ใน raw/sources/ และจดคิวใน source-list.md ใช้เมื่อผู้ใช้สั่ง /find-source หรือขอ "หาเอกสารของ <หุ้น>", "ดึง 10-K", "เอาคลิปนี้เข้า wiki"
argument-hint: <ticker> [ชนิดเอกสาร งวด] | <ลิงก์ YouTube>
---
<!-- สร้างจาก .claude/skills/find-source/SKILL.md ด้วย scripts/sync_skills.py ห้ามแก้ไฟล์นี้ตรงๆ ให้แก้ต้นฉบับแล้วรันสคริปต์ใหม่ -->

# /find-source

Argument: argument ที่ผู้ใช้พิมพ์ต่อจากชื่อ skill เช่น `NFLX` · `NFLX 10-Q 2026Q3` · `DELTA` · `https://www.youtube.com/watch?v=...`

skill นี้ **หาและเก็บ** เท่านั้น ไม่อ่านเนื้อหา การอ่านเป็นงานของ `/ingest-source` ห้ามเติมชื่อเอกสาร วันที่ หรือลิงก์จากความจำของโมเดล
ทุกแถวที่รายงานต้องมาจากสิ่งที่ดึงหรือเปิดดูได้จริงในรอบนี้

## 1. รู้ว่าเป็นอะไร
- ลิงก์ YouTube → ข้อ 2C
- ticker อยู่ใน `scripts/set100.txt` หรือผู้ใช้บอกว่าเป็นหุ้นไทย → ข้อ 2A
- ไม่ใช่ → ลองหาใน SEC (ข้อ 2B) ถ้าไม่เจอให้ถามผู้ใช้ว่าเป็นตลาดไหน

## 2A. หุ้นไทย
เว็บ SET และ ก.ล.ต. โหลดเนื้อหาด้วย JavaScript และบล็อก API (`set.or.th/api` ตอบ 403) จึงดึงไฟล์อัตโนมัติไม่ได้ ให้ทำแบบนี้:
1. เปิดหน้าข้อมูลบริษัท `https://www.set.or.th/th/market/product/stock/quote/<TICKER>/company-profile/information`
   และหน้าข่าว `.../quote/<TICKER>/news` หา 56-1 One Report ฉบับล่าสุด · MD&A และงบรายไตรมาสล่าสุด 1–2 งวด
2. หาเว็บนักลงทุนสัมพันธ์ของบริษัทจากหน้าข้อมูลบริษัท (ช่องเว็บไซต์) ส่วนใหญ่มีหน้า "เอกสารเผยแพร่" ที่โหลด PDF ตรงได้
   ลอง `curl -sIL <url>` ถ้าได้ 200 และ `content-type: application/pdf` ถือว่าดึงได้
3. คลิป Opportunity Day: ค้นใน YouTube ช่อง SET (`"<TICKER> Opportunity Day"`) แล้วทำตามข้อ 2C
4. ไฟล์ที่ดึงตรงไม่ได้ ให้ส่งลิงก์ให้ผู้ใช้เปิดในเบราว์เซอร์ แล้วบันทึกเป็นชื่อไฟล์ตามข้อ 4

## 2B. หุ้น US (SEC EDGAR)
SEC ต้องการ User-Agent ที่มีชื่อและอีเมล ใช้ `UA="wiki-research-starter <อีเมลของผู้ใช้>"` (ถามผู้ใช้ถ้ายังไม่รู้)
1. หา CIK: `curl -s -A "$UA" https://www.sec.gov/files/company_tickers.json` แล้วหา ticker
2. รายการ filing: `curl -s -A "$UA" https://data.sec.gov/submissions/CIK<CIK 10 หลัก>.json`
   ใช้ `filings.recent` ช่อง `form` · `filingDate` · `reportDate` · `accessionNumber` · `primaryDocument`
   เลือก 10-K ล่าสุด 1 ฉบับ · 10-Q ล่าสุด 2 ฉบับ · 8-K ที่มี earnings release (Item 2.02) ล่าสุด
3. ลิงก์ไฟล์: `https://www.sec.gov/Archives/edgar/data/<CIK>/<accessionNumber ไม่มีขีด>/<primaryDocument>`
   ตรวจด้วย `curl -sIL -A "$UA" <url>` เท่านั้นในขั้นนี้
4. shareholder letter และคลิป earnings call อยู่บนเว็บ IR ของบริษัท (ไม่อยู่ใน EDGAR) ให้หาจากหน้า IR แล้วรายงานเป็นแถวแยก

## 2C. คลิป YouTube
1. ดูข้อมูลก่อน: `yt-dlp --skip-download --print "%(title)s | %(upload_date)s | %(duration)s | %(channel)s" <url>`
2. ดูว่ามีคำบรรยายไหม: `yt-dlp --list-subs <url>`
3. มีคำบรรยาย → `yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "th,en.*" --sub-format vtt -o "raw/sources/<source-id>.%(ext)s" <url>`
   แล้วเปลี่ยนชื่อเป็น `raw/sources/<source-id>.vtt` · คำบรรยายอัตโนมัติให้บันทึกว่าเป็น machine transcript
4. ไม่มีคำบรรยาย → บอกผู้ใช้ก่อน แล้วโหลดเสียงอย่างเดียว `yt-dlp -x --audio-format mp3 -o "raw/sources/<source-id>.%(ext)s" <url>`
   ถอดเสียงในเครื่องด้วย faster-whisper ถ้าติดตั้งไว้ (`pip install faster-whisper`) เป็น `.vtt` ถ้าไม่มีให้หยุดและบอกวิธีติดตั้ง
5. ตัวเลขจากคลิปต้องเทียบกับ filing ก่อนเป็น fact (กติกาของ `/ingest-source`)

## 3. รายงานแล้วรอให้เลือก
ตารางเดียว เรียงจากใหม่ไปเก่า:

| # | source-id | ชนิด | งวด | วันที่เผยแพร่ | ดึงเองได้ไหม | ลิงก์ |
|---|---|---|---|---|---|---|

`source-id` ตั้งเป็น `<ticker ตัวเล็ก>-<ชนิด>-<งวด>` เช่น `nflx-10q-2026q3` · `nflx-10k-2025` · `delta-56-1-2025` · `delta-mda-2026q3` · `nflx-earnings-interview-2026q3`
ถามผู้ใช้ว่าจะเก็บแถวไหน **ห้ามดาวน์โหลดก่อนผู้ใช้เลือก** ยกเว้นคำบรรยายคลิปที่ผู้ใช้ส่งลิงก์มาเอง

## 4. เก็บ
- ดาวน์โหลดแถวที่เลือกไปที่ `raw/sources/<source-id>.<pdf|htm|vtt>` (gitignored ห้าม commit) ใช้ `-A "$UA"` กับ SEC
- คำนวณ sha256: `python -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" <ไฟล์>`
- เปิดหน้าแรกหรือหัวไฟล์ดูว่าเป็นบริษัทและงวดที่ถูกต้อง ถ้าไม่ตรงให้ลบไฟล์แล้วบอกผู้ใช้

## 5. จดคิวใน `source-list.md`
เพิ่มหรือแก้แถวในตาราง ห้ามลบแถวเดิม:
`| <source-id> | <TICKER> | <ชนิด> | <งวด> | <วันที่เผยแพร่> | <ลิงก์> | <status> |`
status: `found` (เจอแต่ยังไม่มีไฟล์ รอผู้ใช้โหลด) · `downloaded` (มีไฟล์ใน raw/sources/ แล้ว) · `ingested` (ตั้งโดย `/ingest-source`)

## 6. ปิดงาน
สรุปสั้นๆ: เก็บแล้วกี่ชิ้น · ชิ้นไหนผู้ใช้ต้องโหลดเอง (พร้อมชื่อไฟล์ที่ต้องบันทึก) · คำสั่งถัดไป `/ingest-source <source-id>`
