"""Fetch new papers from ML-Quant (ml-quant.com) into a local feed file for the dashboard.

Run by hand when you want new ideas; the dashboard never fetches on its own (builds must work
offline). Reads one topic list from the ML-Quant JSON API, then each paper's Markdown page for
authors, release date and the original source link. Pages already in the feed are not refetched.

ML-Quant summaries are CC BY 4.0 (credit + link back); paper metadata comes from arXiv / SSRN.
Summaries are ML-Quant's reading of the abstract, not checked against the paper.

Usage: python scripts/paper_feed.py [--topic asset-pricing-factors] [--limit 20]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent
SITE = "https://www.ml-quant.com"
OUT = VAULT / "dashboard" / "data" / "paper-feed.json"
UA = "alpha-research-wiki paper_feed.py (+https://github.com/Migchw/alpha-research-wiki)"


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_page(md: str) -> dict:
    """Pull title, authors, release date and source link from a paper's index.md."""
    out: dict = {"title": "", "authors": [], "released": "", "source_url": "", "identifier": ""}
    for line in md.splitlines():
        if line.startswith("# ") and not out["title"]:
            out["title"] = line[2:].strip()
        elif line.startswith("- Source: "):
            out["source_url"] = line[len("- Source: "):].strip()
        elif line.startswith("- Identifier: "):
            out["identifier"] = line[len("- Identifier: "):].strip()
        elif line.startswith("- Released: "):
            out["released"] = line[len("- Released: "):].strip()
        elif line.startswith("- Authors: "):
            out["authors"] = [a.strip() for a in line[len("- Authors: "):].split(",") if a.strip()]
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic", default="asset-pricing-factors", help="slug จาก /api/v1/topics.json")
    parser.add_argument("--limit", type=int, default=20, help="จำนวน paper ล่าสุด (สูงสุด 50)")
    parser.add_argument("--delay", type=float, default=1.0, help="วินาทีระหว่างแต่ละ request")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console prints Thai

    topic = json.loads(get(f"{SITE}/api/v1/topics/{args.topic}.json"))
    items = sorted(topic["items"], key=lambda x: x.get("featured") or "", reverse=True)[:min(args.limit, 50)]

    cached = {}
    if args.out.exists():
        old = json.loads(args.out.read_text(encoding="utf-8"))
        cached = {p["mlquant_url"]: p for p in old.get("items", [])}

    papers, fetched = [], 0
    for item in items:
        page = SITE + item["url"]
        if page in cached:
            papers.append(cached[page])
            continue
        time.sleep(args.delay)
        meta = parse_page(get(page + "index.md"))
        fetched += 1
        papers.append({
            "title": meta["title"] or item["title"],
            "authors": meta["authors"],
            "released": meta["released"],
            "featured": item.get("featured", ""),
            "venue": item.get("label", ""),
            "identifier": meta["identifier"],
            "source_url": meta["source_url"],
            "summary": item.get("summary", ""),
            "mlquant_url": page,
        })

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "topic": topic.get("topic", args.topic),
        "credit": "Summaries: ML-Quant (ml-quant.com), CC BY 4.0",
        "items": papers,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE  {args.out.as_posix()}  {len(papers)} papers ({fetched} ใหม่) · {topic.get('topic')}")
    print("รัน npm run index ใน dashboard/ แล้วเปิด /feed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
