"""Download a public filing PDF, verify its SHA-256, and convert it page by page with MarkItDown.

Output goes to data/filings/<name>/ (gitignored): the PDF, a Markdown file with `## Page N`
markers so every fact can cite a page, and manifest.json with the hash and page stats.
The Markdown is the document's full text, so it must never be committed.

Usage:
  python scripts/extract_pdf.py --name ap-2026-q2 \
      --url https://ap.listedcompany.com/misc/MDNA/20260813-ap-mdna-2q2026-en.pdf \
      --sha256 bac2ddd555a8a19351c4cabe0702c2f205fe355cf1bc1f11685be00d0b749f7a
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader, PdfWriter

VAULT = Path(__file__).resolve().parent.parent
MIN_TEXT_CHARS = 80  # pages below this are candidates for a human/vision look, not automatic OCR


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "alpha-research-wiki/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


def convert_pages(pdf: Path) -> list[str]:
    from markitdown import MarkItDown

    converter = MarkItDown()
    pages = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, page in enumerate(PdfReader(str(pdf)).pages, start=1):
            one = Path(tmp) / f"page_{i:04d}.pdf"
            writer = PdfWriter()
            writer.add_page(page)
            with one.open("wb") as fh:
                writer.write(fh)
            pages.append((converter.convert_local(one, file_extension=".pdf").text_content or "").strip())
    return pages


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="folder name under data/filings/")
    ap.add_argument("--url", required=True)
    ap.add_argument("--sha256", help="expected hash; the run stops if the file differs")
    args = ap.parse_args()

    out = VAULT / "data" / "filings" / args.name
    out.mkdir(parents=True, exist_ok=True)
    pdf = out / "source.pdf"
    if not pdf.exists():
        download(args.url, pdf)
    if pdf.read_bytes()[:4] != b"%PDF":
        print(f"ERROR  ไฟล์ที่ได้ไม่ใช่ PDF: {args.url}")
        return 1
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    if args.sha256 and digest != args.sha256:
        print(f"ERROR  SHA-256 ไม่ตรง: ได้ {digest} แต่คาด {args.sha256} (ต้นฉบับถูกแก้หรือได้ไฟล์ผิด)")
        return 1

    pages = convert_pages(pdf)
    md = "\n".join(f"<!-- source: {args.name}; page: {i} -->\n## Page {i}\n\n{text}\n"
                   for i, text in enumerate(pages, start=1))
    (out / "source.md").write_text(md, encoding="utf-8")
    manifest = {
        "url": args.url,
        "sha256": digest,
        "engine": "microsoft-markitdown",
        "engine_version": importlib.metadata.version("markitdown"),
        "page_count": len(pages),
        "low_text_pages": [i for i, t in enumerate(pages, start=1) if len(t) < MIN_TEXT_CHARS],
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK  {len(pages)} หน้า · sha256 {digest[:12]}… · {out.relative_to(VAULT).as_posix()}/source.md")
    if manifest["low_text_pages"]:
        print(f"    หน้าที่ข้อความน้อย (ควรเปิดดูเอง): {manifest['low_text_pages']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
