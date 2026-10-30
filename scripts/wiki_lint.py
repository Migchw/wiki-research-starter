"""Deterministic lint for the research wiki.

Checks frontmatter against the schema in AGENTS.md, broken wikilinks,
pre-registration rules and graveyard rules. Covers papers, company sources
(56-1, 10-K, 10-Q, transcripts) and company pages as well as the quant layer. Exit code 1 if any error.

Usage: python scripts/wiki_lint.py [--vault PATH]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

FOLDER_TYPE = {
    "articles": "article",
    "papers": "paper",
    "sources": "source",
    "companies": "company",
    "concepts": "concept",
    "hypotheses": "hypothesis",
    "experiments": "experiment",
    "factors": "factor",
}

REQUIRED = {
    "article": ["title", "about", "basis", "status"],
    "paper": ["citekey", "title", "authors", "year", "status"],
    "source": ["id", "company", "doc_type", "title", "period", "published", "url", "status"],
    "company": ["ticker", "name", "exchange"],
    "concept": ["title"],
    "hypothesis": ["id", "status", "source_papers", "signal", "universe", "in_sample",
                   "out_of_sample", "expected_sign", "kill_criteria"],
    "experiment": ["id", "hypothesis", "trial_no", "code_ref", "lookback", "costs_bps",
                   "sample", "known_biases", "reviewer_verdict"],
    "factor": ["id", "hypothesis", "definition", "evidence"],
}

ENUMS = {
    ("article", "status"): {"draft", "reviewed"},
    ("paper", "status"): {"queued", "ingested", "reviewed"},
    ("paper", "verified_against"): {"fulltext", "working_paper", "abstract", ""},
    ("article", "basis"): {"fulltext", "working_paper", "abstract", "vault"},
    ("source", "status"): {"queued", "ingested", "reviewed"},
    ("source", "doc_type"): {"56-1", "10-K", "10-Q", "MD&A", "shareholder-letter", "transcript", "video", "other"},
    ("hypothesis", "status"): {"idea", "preregistered", "testing", "promoted", "rejected"},
    ("hypothesis", "expected_sign"): {"positive", "negative", ""},
    ("experiment", "sample"): {"in_sample", "out_of_sample"},
    ("experiment", "reviewer_verdict"): {"pending", "pass", "fail"},
}

# Fields that must be filled once a hypothesis leaves the "idea" stage.
PREREG = ["signal", "universe", "in_sample", "out_of_sample", "expected_sign", "kill_criteria"]
METRICS = ["sharpe", "ann_return", "t_stat", "max_dd"]

WIKILINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")
SKIP_DIRS = {"templates", "dashboard", "node_modules", ".obsidian", ".claude", ".agents", ".git", "raw"}


def split_frontmatter(text: str) -> tuple[dict | None, str]:
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    meta = yaml.safe_load(text[3:end]) or {}
    return meta, text[end + 4:]


def empty(value) -> bool:
    return value is None or value == "" or value == []


def lint(vault: Path) -> list[str]:
    errors: list[str] = []
    notes = [p for p in vault.rglob("*.md")
             if not SKIP_DIRS.intersection(p.relative_to(vault).parts)]
    stems = {p.stem for p in notes}
    trials: dict[tuple[str, int], str] = {}

    for path in notes:
        rel = path.relative_to(vault).as_posix()
        folder = path.relative_to(vault).parts[0]
        text = path.read_text(encoding="utf-8")
        try:
            meta, body = split_frontmatter(text)
        except yaml.YAMLError as exc:
            errors.append(f"{rel}: YAML ผิดรูปแบบ ({exc.__class__.__name__})")
            continue

        for target in WIKILINK.findall(text):
            # assets/ is local only (gitignored), so a missing image is not an error on a fresh clone
            if target.strip().startswith("assets/"):
                continue
            if Path(target.strip()).stem not in stems:
                errors.append(f"{rel}: wikilink เสีย [[{target}]]")

        expected = FOLDER_TYPE.get(folder)
        if expected is None:
            continue
        if meta is None:
            errors.append(f"{rel}: ไม่มี frontmatter")
            continue
        kind = meta.get("type")
        if kind != expected:
            errors.append(f"{rel}: type ควรเป็น '{expected}' แต่เป็น '{kind}'")
            continue

        for key in REQUIRED[kind]:
            if key not in meta:
                errors.append(f"{rel}: ขาด field '{key}'")
        for key, value in meta.items():
            if isinstance(value, dict):
                errors.append(f"{rel}: field '{key}' ซ้อน object ไม่ได้ (ต้อง flat)")
            allowed = ENUMS.get((kind, key))
            if allowed is not None and (value or "") not in allowed:
                errors.append(f"{rel}: {key}='{value}' ไม่อยู่ใน {sorted(allowed)}")

        if kind == "hypothesis":
            status = meta.get("status")
            if status != "idea":
                for key in PREREG:
                    if empty(meta.get(key)):
                        errors.append(f"{rel}: status '{status}' ต้อง pre-register '{key}' ก่อน")
            if status == "rejected" and empty(meta.get("rejected_reason")):
                errors.append(f"{rel}: ส่งเข้า graveyard ต้องมี rejected_reason")

        if kind == "experiment":
            verdict = meta.get("reviewer_verdict")
            if verdict in {"pass", "fail"}:
                for key in METRICS:
                    if empty(meta.get(key)):
                        errors.append(f"{rel}: verdict '{verdict}' แต่ยังไม่มี metric '{key}'")
            hyp = WIKILINK.findall(str(meta.get("hypothesis", "")))
            trial = meta.get("trial_no")
            if hyp and isinstance(trial, int):
                key = (hyp[0], trial)
                if key in trials:
                    errors.append(f"{rel}: trial_no {trial} ซ้ำกับ {trials[key]}")
                trials[key] = rel

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    # Windows consoles default to cp1252/cp874, which cannot print Thai messages.
    sys.stdout.reconfigure(encoding="utf-8")

    errors = lint(args.vault)
    for err in errors:
        print(f"ERROR  {err}")
    print(f"\n{'FAIL' if errors else 'PASS'}: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
