---
name: find-paper
description: ตรวจว่า paper มีอยู่จริงและ metadata ถูก (Crossref + OpenAlex) หาฉบับที่อ่านได้ฟรี (ฉบับตีพิมพ์ open access, NBER, arXiv, SSRN, เว็บผู้เขียน) และตรวจว่าไฟล์ที่ได้คือต้นฉบับจริง แล้วอัปเดต reading-list.md ใช้เมื่อผู้ใช้สั่ง /find-paper หรือได้ชื่อ paper / DOI มาจาก LLM, บทความ, slide หรือคนอื่น
argument-hint: <ชื่อ paper | DOI | "Author (ปี)">
---
<!-- สร้างจาก .claude/skills/find-paper/SKILL.md ด้วย scripts/sync_skills.py ห้ามแก้ไฟล์นี้ตรงๆ ให้แก้ต้นฉบับแล้วรันสคริปต์ใหม่ -->

# /find-paper

Argument: argument ที่ผู้ใช้พิมพ์ต่อจากชื่อ skill

รายชื่อ paper ที่ LLM สร้าง **ผิดได้เสมอ** ทั้งปี ชื่อวารสาร และ DOI (ดู `raw/2026-10-24-citation-check.md`:
DOI ของ Novy-Marx 2012 ที่ได้มาชี้ไปที่ paper อีกชิ้น และไฟล์ "Novy-Marx 2012" ที่ได้มาเป็นสรุปจาก AI)
skill นี้จึงตรวจทุกอย่างกับฐานข้อมูลภายนอก และห้ามเติมข้อมูลจากความจำของโมเดล

## 1. ตรวจ metadata
1. ค้น Crossref (ใช้ชื่อ + ผู้เขียน + ปี ถ้ามี):
   ```bash
   curl -s "https://api.crossref.org/works?query.bibliographic=<คำค้น+คั่นด้วย+>&rows=3&select=DOI,title,author,container-title,issued,volume,issue,page,type"
   ```
   ถ้าได้ DOI มาแล้ว ให้ดึงตรง: `curl -s https://api.crossref.org/works/<DOI>`
2. เทียบกับ OpenAlex อีกแหล่ง:
   ```bash
   curl -s "https://api.openalex.org/works/https://doi.org/<DOI>?select=title,authorships,publication_year,primary_location,open_access,locations"
   ```
3. เทียบทีละช่อง: ชื่อเรื่อง · ผู้เขียนทุกคน · ปี · วารสาร · เล่ม(ฉบับ) · หน้า
   - ตรงกันทั้งสองแหล่ง → ✅
   - ข้อมูลที่ได้มาต่างจากฐานข้อมูล → ใช้ค่าจากฐานข้อมูล แล้ว **บอกผู้ใช้ว่าอะไรผิด** (ตัวอย่างดีสำหรับ EP6)
   - หาไม่เจอทั้งสองแหล่ง → ⏳ และบอกว่าอาจไม่มีอยู่จริง ห้ามอ้าง
4. ถ้ามีทั้ง working paper และฉบับตีพิมพ์ ให้บันทึกทั้งสอง DOI (เช่น `10.3386/w5375` กับ DOI ของวารสาร)

## 2. หาฉบับที่อ่านได้
เรียงตามลำดับความน่าเชื่อ:
1. ฉบับตีพิมพ์ที่เป็น open access (`open_access.oa_url` ใน OpenAlex)
2. working paper ของ NBER (`https://www.nber.org/papers/w<เลข>`), arXiv หรือ SSRN
3. เว็บของผู้เขียน หรือคลังของมหาวิทยาลัย

ตรวจว่ามีไฟล์จริงและขนาดเท่าไรด้วย header เท่านั้น (`curl -sIL <url> | grep -i content-length`)
**ห้ามดาวน์โหลดเองโดยไม่ถาม**: บอกผู้ใช้ชื่อไฟล์ แหล่ง และขนาด แล้วรอให้ยืนยัน
ถ้าเว็บบล็อกสคริปต์ (403) ให้บอกผู้ใช้ให้เปิดลิงก์ในเบราว์เซอร์แล้วบันทึกไฟล์เอง

ไฟล์ทั้งหมดวางที่ `raw/pdf/<citekey>.pdf` หรือ `raw/pdf/<citekey>-wp.pdf` (อยู่ใน `.gitignore` ห้าม commit)

## 3. ตรวจว่าไฟล์คือต้นฉบับจริง
ก่อนใช้ไฟล์ใดเป็นฐาน ingest ต้องผ่านทุกข้อ:
- หน้าแรกมีชื่อเรื่องและชื่อผู้เขียนตรงกับ metadata
- ฉบับตีพิมพ์: มีชื่อวารสาร เล่ม และเลขหน้าตรงกับ Crossref · working paper: มีเลข working paper (เช่น NBER Working Paper No. 5375) และปี
- จำนวนหน้าสมเหตุสมผล (ฉบับตีพิมพ์ = ช่วงหน้าใน Crossref)
- **สัญญาณของไฟล์ปลอมหรือสรุปจาก AI:** producer เป็น WeasyPrint/HTML-to-PDF, มีสูตร LaTeX ดิบ (`$r_{12,7}$`),
  คำว่า "summary", "review of", "key takeaways" บนหน้าแรก, ไม่มีเชิงอรรถหรือรายการอ้างอิง, จำนวนหน้าน้อยผิดปกติ
- ตรวจ metadata ของไฟล์ได้ด้วย `python -c "import pypdf,sys;r=pypdf.PdfReader(sys.argv[1]);print(len(r.pages),r.metadata)" <ไฟล์>`

ถ้าไม่ผ่าน ให้เปลี่ยนชื่อไฟล์เป็น `<citekey>_NOT-SOURCE.pdf` และบันทึกเหตุผลใน `raw/<วันที่>-citation-check.md`

## 4. อัปเดต `reading-list.md`
แก้แถวของ paper นั้นในหมวดที่ถูกต้อง: ชื่อตามฐานข้อมูล · DOI เป็นลิงก์ · สถานะ
`✅` ตรวจ metadata แล้ว · `⏳` ยังไม่ตรวจ ห้ามอ้าง · `📄` มี source note · บอกด้วยว่ามีไฟล์ฉบับไหน (fulltext / working paper / abstract)

## 5. รายงานผู้ใช้
ตารางสั้น: paper · metadata ตรงไหม (และอะไรที่ผิดจากข้อมูลตั้งต้น) · ฉบับที่อ่านได้ + ขนาด · ไฟล์ผ่านการตรวจไหม · ขั้นถัดไป (`/ingest-paper <citekey>`)
