"""Render one figure from a PDF page into assets/ for an article (images stay local: assets/ is gitignored).

Usage:
  python scripts/crop_figure.py <pdf> <pdf_page> <out.png> [--above "Figure 1:"]

--above crops from the top margin down to just above that caption text; without it the whole page is rendered.
Open the PNG and look at it before writing the caption.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pymupdf


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("page", type=int, help="PDF page number (1-based), not the printed page")
    parser.add_argument("out")
    parser.add_argument("--above", help="caption text; crop the area above it")
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args()

    page = pymupdf.open(args.pdf)[args.page - 1]
    clip = page.rect + (40, 40, -40, -40)
    if args.above:
        hits = page.search_for(args.above)
        if not hits:
            print(f"ไม่พบ {args.above!r} ในหน้า {args.page}", file=sys.stderr)
            return 1
        clip.y1 = hits[0].y0 - 4
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    page.get_pixmap(dpi=args.dpi, clip=clip).save(args.out)
    print(f"{args.out}  (หน้า PDF {args.page}, clip {tuple(round(v) for v in clip)})")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
