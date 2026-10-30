"""Convert a company document into text with a locator on every block.

PDF (56-1 One Report)  -> "=== pdf page N ===" before each page (PyMuPDF)
HTML (10-K / 10-Q)     -> "=== section: Item 7 ... ===" before each Item heading
Transcript (.txt/.vtt) -> kept as "[mm:ss] text" lines

The output goes next to the input in raw/sources/ (gitignored) together with the
SHA-256 of the original file, so a source note can cite where every claim came from.

Usage: python scripts/source_to_text.py raw/sources/delta-56-1-2025.pdf
"""
from __future__ import annotations

import hashlib
import html
import re
import sys
from pathlib import Path

ITEM = re.compile(r"^\s*(Item\s+\d+[A-C]?\.)\s*(.{0,130})$", re.I)


def pdf_text(path: Path) -> str:
    import pymupdf
    doc = pymupdf.open(path)
    return "".join(f"=== pdf page {i + 1} ===\n{page.get_text()}\n" for i, page in enumerate(doc))


def html_text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    raw = re.sub(r"(?is)<(script|style|ix:header).*?</\1>", "", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    lines = [re.sub(r"[ \t\xa0]+", " ", ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    out = []
    for i, ln in enumerate(lines):
        m = ITEM.match(ln)
        if m:  # a heading, not a sentence that mentions an Item
            title = m.group(2).strip()
            if not title and i + 1 < len(lines):  # 10-Q puts the title on the next line
                title = lines[i + 1][:100]
            out.append(f"=== section: {m.group(1)} {title} ===")
        out.append(ln)
    return "\n".join(out) + "\n"


def transcript_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".vtt":
        rows = []
        for block in text.split("\n\n"):
            m = re.search(r"(\d+):(\d{2}):(\d{2})\.\d+ -->", block)
            body = " ".join(l for l in block.splitlines()[1:] if "-->" not in l).strip()
            if m and body:
                minutes = int(m.group(1)) * 60 + int(m.group(2))
                rows.append(f"[{minutes:02d}:{m.group(3)}] {body}")
        return "\n".join(rows) + "\n"
    return text


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    src = Path(sys.argv[1])
    suffix = src.suffix.lower()
    if suffix == ".pdf":
        text = pdf_text(src)
    elif suffix in {".htm", ".html"}:
        text = html_text(src)
    elif suffix in {".txt", ".vtt"} and not src.name.endswith(".source.txt"):
        text = transcript_text(src)
    else:
        print(f"ไม่รู้จักชนิดไฟล์ {src.name}")
        return 1
    sha = hashlib.sha256(src.read_bytes()).hexdigest()
    out = src.with_name(src.stem + ".source.txt")
    out.write_text(f"<!-- source: {src.name} · sha256 {sha} -->\n{text}", encoding="utf-8")
    markers = text.count("=== pdf page") + text.count("=== section:") + text.count("\n[")
    print(f"OK  {out} · {len(text):,} ตัวอักษร · {markers} locator · sha256 {sha[:12]}…")
    return 0


if __name__ == "__main__":
    sys.exit(main())
