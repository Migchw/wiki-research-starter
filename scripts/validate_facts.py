"""Deterministic validator for facts extracted by an LLM from a filing (EP7 · F45-style pipeline).

The LLM only reads and points (value + page). This script decides whether the candidate is usable:
  1. schema    : known code/period/scope/unit, value is a number, not_disclosed <=> null
  2. unique    : no duplicate code + period + scope
  3. evidence  : the reported value is actually printed on the cited page of the extracted Markdown
  4. arithmetic: accounting identities hold within the rounding the document itself uses

Only a candidate with zero errors can be written as the fact pack (single source of truth).

Usage:
  python scripts/validate_facts.py --facts facts/runs/ap-2026-q2-opus-1.json --source data/filings/ap-2026-q2
  python scripts/validate_facts.py --facts <candidate> --source <dir> --write facts/ap-2026-q2.json
      --model "<model id>" --filing-key SET:AP:2569:Q2 --reported-at 2026-08-13
  python scripts/validate_facts.py --facts facts/ap-2026-q2.json --render
  งบบริษัทอื่น: เพิ่ม --schema facts/schemas/<filing>.json (code/period/scope/unit + identity ของงบนั้น)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

UNITS = {"THB_m", "percent", "times"}
STATUS = {"reported", "not_disclosed"}
EXPECTED = {  # code -> (periods, scopes, unit); mirrors scripts/extract_facts_prompt.md
    "total_revenue": ({"2Q2026", "1H2026"}, {"consolidated"}, "THB_m"),
    "property_sales_revenue": ({"2Q2026", "1H2026"}, {"consolidated"}, "THB_m"),
    "service_revenue": ({"2Q2026", "1H2026"}, {"consolidated"}, "THB_m"),
    "net_profit": ({"2Q2026", "1H2026"}, {"consolidated"}, "THB_m"),
    "revenue": ({"2Q2026"}, {"segment:low_rise", "segment:condo"}, "THB_m"),
    "gross_margin": ({"2Q2026"}, {"consolidated"}, "percent"),
    "sga_to_revenue": ({"2Q2026"}, {"consolidated"}, "percent"),
    "net_debt_to_equity": ({"2026-06-30"}, {"consolidated"}, "times"),
    "presales": ({"2Q2026", "1H2026", "7M2026", "JUL2026"}, {"consolidated", "segment:low_rise", "segment:condo"}, "THB_m"),
    "presales_target": ({"FY2026"}, {"consolidated"}, "THB_m"),
    "presales_target_achieved": ({"7M2026"}, {"consolidated"}, "percent"),
    "backlog": ({"2026-07-31"}, {"consolidated", "segment:low_rise", "segment:condo"}, "THB_m"),
    "operating_cash_flow": ({"1H2026"}, {"consolidated"}, "THB_m"),
}
# Identities: (name, total, parts) for sums; (name, result, numerator, denominator) for ratios.
# Keys are code|period|scope. The MD&A rounds to whole THB m, so each term can be off by 0.5.
SUMS = [
    ("revenue 2Q = property + service", "total_revenue|2Q2026|consolidated",
     ["property_sales_revenue|2Q2026|consolidated", "service_revenue|2Q2026|consolidated"]),
    ("revenue 1H = property + service", "total_revenue|1H2026|consolidated",
     ["property_sales_revenue|1H2026|consolidated", "service_revenue|1H2026|consolidated"]),
    ("presales Jul = low-rise + condo", "presales|JUL2026|consolidated",
     ["presales|JUL2026|segment:low_rise", "presales|JUL2026|segment:condo"]),
    ("backlog = low-rise + condo", "backlog|2026-07-31|consolidated",
     ["backlog|2026-07-31|segment:low_rise", "backlog|2026-07-31|segment:condo"]),
]
RATIOS = [
    ("presales 7M / target", "presales_target_achieved|7M2026|consolidated",
     "presales|7M2026|consolidated", "presales_target|FY2026|consolidated"),
]
PAGE = re.compile(r"^## Page (\d+)\s*$", re.M)


def key(m: dict) -> str:
    return f"{m.get('code')}|{m.get('period')}|{m.get('scope')}"


def load_pages(md: str) -> dict[int, str]:
    marks = list(PAGE.finditer(md))
    return {int(m.group(1)): md[m.end():(marks[i + 1].start() if i + 1 < len(marks) else len(md))]
            for i, m in enumerate(marks)}


def number_forms(value: float) -> list[str]:
    if float(value).is_integer():
        return [str(int(value))]
    text = f"{value:.6f}".rstrip("0").rstrip(".")
    return [text, text.lstrip("0")] if text.startswith("0.") else [text]


def on_page(value: float, page_text: str) -> bool:
    # MarkItDown keeps the text layer but may split tokens ("2 02 6"), so compare on two normalisations.
    spaced = re.sub(r"(?<=\d),(?=\d)", "", re.sub(r"\s+", " ", page_text))
    packed = re.sub(r"(?<=\d),(?=\d)", "", re.sub(r"\s+", "", page_text))
    for form in number_forms(value):
        tail = r"0*(?![\d])" if "." in form else r"(?![\d])"  # 0.6 also matches a printed 0.60
        pat = re.compile(r"(?<![\d.])" + re.escape(form) + tail)
        if pat.search(spaced) or pat.search(packed):
            return True
    return False


def load_schema(path: Path) -> dict:
    """facts/schemas/<filing>.json -> the same shapes as EXPECTED / SUMS / RATIOS (default schema = AP 2Q2026)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {
        "units": set(raw.get("units", UNITS)),
        "expected": {c: (set(v[0]), set(v[1]), v[2]) for c, v in raw["expected"].items()},
        "sums": [tuple(s) for s in raw.get("sums", [])],
        "ratios": [tuple(r) for r in raw.get("ratios", [])],
    }


def validate(metrics: list[dict], pages: dict[int, str] | None,
             schema: dict | None = None) -> tuple[list[str], list[str], list[str]]:
    schema = schema or {"units": UNITS, "expected": EXPECTED, "sums": SUMS, "ratios": RATIOS}
    units, expected = schema["units"], schema["expected"]
    errors, warnings, passed = [], [], []
    seen: dict[str, dict] = {}
    for m in metrics:
        k = key(m)
        exp = expected.get(m.get("code"))
        if exp is None or m.get("period") not in exp[0] or m.get("scope") not in exp[1]:
            errors.append(f"schema    {k}: ไม่อยู่ในรายการที่ขอ")
            continue
        if m.get("unit") != exp[2] or m.get("unit") not in units:
            errors.append(f"schema    {k}: unit '{m.get('unit')}' ควรเป็น '{exp[2]}'")
        status, value = m.get("status"), m.get("value")
        if status not in STATUS:
            errors.append(f"schema    {k}: status '{status}' ไม่รู้จัก")
        elif (status == "not_disclosed") != (value is None):
            errors.append(f"schema    {k}: not_disclosed ต้องคู่กับ value null เท่านั้น (ได้ {value!r})")
        elif value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
            errors.append(f"schema    {k}: value ต้องเป็นตัวเลขล้วน (ได้ {value!r})")
        if k in seen:
            errors.append(f"unique    {k}: ซ้ำ")
        seen[k] = m
        if pages is not None and isinstance(value, (int, float)) and not isinstance(value, bool):
            page = m.get("page")
            if page not in pages:
                errors.append(f"evidence  {k}: ไม่มีหน้า {page} ในเอกสาร")
            elif not on_page(value, pages[page]):
                errors.append(f"evidence  {k}: ไม่พบ {value:g} ในหน้า {page}")
            else:
                passed.append(f"evidence  {k} = {value:g} (p. {page})")
        if m.get("note"):
            warnings.append(f"note      {k}: {m['note']}")

    def val(k: str):
        v = seen.get(k, {}).get("value")
        return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    for name, total, parts in schema["sums"]:
        vals = [val(total)] + [val(p) for p in parts]
        if None in vals:
            warnings.append(f"arith     {name}: ข้ามเพราะขาดตัวเลข")
            continue
        diff, tol = vals[0] - sum(vals[1:]), 0.5 * len(vals)
        line = f"arith     {name}: {vals[0]:g} vs {sum(vals[1:]):g} (ต่าง {diff:+g}, ยอมได้ ±{tol:g} จากการปัดเศษ)"
        (passed if abs(diff) <= tol else errors).append(line)
    for name, result, num, den in schema["ratios"]:
        r, a, b = val(result), val(num), val(den)
        if None in (r, a, b) or b == 0:
            warnings.append(f"arith     {name}: ข้ามเพราะขาดตัวเลข")
            continue
        calc = a / b * 100
        tol = 0.05 + 100 * 0.5 * (a + b) / b ** 2  # 1-decimal rounding of the % plus whole-million inputs
        line = f"arith     {name}: รายงาน {r:g}% vs คำนวณ {calc:.2f}% (ยอมได้ ±{tol:.2f})"
        (passed if abs(r - calc) <= tol else errors).append(line)
    return errors, warnings, passed


def render(pack: dict) -> str:
    rows = ["| code | period | scope | value | unit | หน้า |", "|---|---|---|---|---|---|"]
    for m in pack["metrics"]:
        v = "ไม่เปิดเผย" if m["value"] is None else f"{m['value']:,g}"
        rows.append(f"| {m['code']} | {m['period']} | {m['scope']} | {v} | {m['unit']} | {m.get('page') or '-'} |")
    head = f"# {pack.get('filing_key', '')} · fact pack\n\nที่มา: {pack.get('source', {}).get('url', '')}\n\n"
    return head + "\n".join(rows) + "\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True, type=Path)
    ap.add_argument("--source", type=Path, help="data/filings/<name>/ ที่มี source.md และ manifest.json")
    ap.add_argument("--write", type=Path, help="เขียน fact pack เมื่อผ่านทุกข้อเท่านั้น")
    ap.add_argument("--model", default="", help="model ที่สกัด candidate นี้ (บันทึกลง fact pack)")
    ap.add_argument("--filing-key", default="", help="เช่น SET:AP:2569:Q2")
    ap.add_argument("--reported-at", default="", help="วันที่ประกาศงบ (YYYY-MM-DD) ใช้กำหนดวันที่ signal เริ่มใช้ได้")
    ap.add_argument("--schema", type=Path, help="facts/schemas/<filing>.json ถ้าไม่ใส่ใช้ schema ของ AP 2Q2026")
    ap.add_argument("--render", action="store_true", help="พิมพ์ตารางอ่านง่ายจาก fact pack (ไม่เรียก LLM)")
    args = ap.parse_args()

    pack = json.loads(args.facts.read_text(encoding="utf-8"))
    if args.render:
        print(render(pack))
        return 0
    pages = None
    if args.source:
        pages = load_pages((args.source / "source.md").read_text(encoding="utf-8"))
    else:
        print("WARN  ไม่ได้ส่ง --source จึงไม่ได้ตรวจ evidence (ข้อ 3)")
    schema = load_schema(args.schema) if args.schema else None
    errors, warnings, passed = validate(pack["metrics"], pages, schema)
    for line in passed:
        print("PASS  " + line)
    for line in warnings:
        print("WARN  " + line)
    for line in errors:
        print("ERROR " + line)
    print(f"\n{'FAIL' if errors else 'PASS'}: {len(errors)} error(s) · {len(passed)} check(s) ผ่าน · {len(warnings)} warning(s)")
    if errors:
        return 1
    if args.write:
        if not (args.source and args.filing_key and args.reported_at):
            print("ERROR --write ต้องใช้คู่กับ --source, --filing-key และ --reported-at")
            return 1
        manifest = json.loads((args.source / "manifest.json").read_text(encoding="utf-8"))
        out = {
            "schema_version": "demo-1",
            "filing_key": args.filing_key,
            "reported_at": args.reported_at,
            "source": {k: manifest[k] for k in ("url", "sha256", "engine", "engine_version", "page_count")},
            "extraction": {"model": args.model, "prompt": "scripts/extract_facts_prompt.md",
                           "schema": args.schema.as_posix() if args.schema else "built-in (AP 2Q2026)",
                           "candidate": args.facts.as_posix(),
                           "validated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")},
            "metrics": pack["metrics"],
        }
        args.write.parent.mkdir(parents=True, exist_ok=True)
        args.write.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"เขียน {args.write.as_posix()} แล้ว")
    return 0


if __name__ == "__main__":
    sys.exit(main())
