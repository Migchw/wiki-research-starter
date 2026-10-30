"""Checks the ML-Quant page parser on a saved page (no network).

Usage: python scripts/test_paper_feed.py
"""
from __future__ import annotations

import sys

sys.path.insert(0, __file__.rsplit("scripts", 1)[0] + "scripts")
from paper_feed import parse_page  # noqa: E402

# Shape of https://www.ml-quant.com/papers/ssrn/7626643/index.md (2026-10-24), shortened
PAGE = """---
title: The Options-Implied Information Content: Evidence from 3.8 Billion Option Contracts
identifier: SSRN 7626643
source_url: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7626643
---


# The Options-Implied Information Content: Evidence from 3.8 Billion Option Contracts

One-sentence summary.

- Source: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7626643
- Identifier: SSRN 7626643
- Released: 2026-10-20
- First featured: Quant Letter No. 136 (2026-10-23): https://www.ml-quant.com/issues/2026-10-23/
- Authors: Ada Lovelace, Alan Turing
"""


def test_fields() -> None:
    p = parse_page(PAGE)
    assert p["title"] == "The Options-Implied Information Content: Evidence from 3.8 Billion Option Contracts", p
    assert p["source_url"] == "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7626643"
    assert p["identifier"] == "SSRN 7626643"
    assert p["released"] == "2026-10-20"
    assert p["authors"] == ["Ada Lovelace", "Alan Turing"]


def test_missing_fields_stay_empty() -> None:
    p = parse_page("# Only a title\n")
    assert p["title"] == "Only a title" and p["authors"] == [] and p["source_url"] == ""


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok  {name}")
    print("all tests passed")
