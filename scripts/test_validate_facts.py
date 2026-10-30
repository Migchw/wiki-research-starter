"""Checks that the fact validator catches the failure modes an LLM extractor produces (no network).

Usage: python scripts/test_validate_facts.py
"""
from __future__ import annotations

import sys

sys.path.insert(0, __file__.rsplit("scripts", 1)[0] + "scripts")
from validate_facts import load_pages, on_page, validate  # noqa: E402

PAGES = load_pages(
    "## Page 1\n\ntotal revenue of THB 10,777 million and net debt-to-equity of 0.66x\n"
    "## Page 2\n\nTHB 10,506 million from property sales and THB 270 million from services\n"
    "MarkItDown split this one: THB 1 ,063 million\n"
)


def m(code, value, page, period="2Q2026", scope="consolidated", unit="THB_m", status="reported"):
    return {"code": code, "period": period, "scope": scope, "value": value, "unit": unit, "status": status, "page": page}


GOOD = [m("total_revenue", 10777, 1), m("property_sales_revenue", 10506, 2), m("service_revenue", 270, 2),
        m("net_debt_to_equity", 0.66, 1, period="2026-06-30", unit="times")]


def errors_of(metrics):
    return validate(metrics, PAGES)[0]


def test_good_candidate_passes() -> None:
    assert errors_of(GOOD) == [], errors_of(GOOD)


def test_number_matching() -> None:
    assert on_page(10777, PAGES[1]) and on_page(0.66, PAGES[1])
    assert on_page(1063, PAGES[2])          # token split by the converter still matches
    assert not on_page(1077, PAGES[1])      # a prefix of a real number is not a match
    assert not on_page(10.5, PAGES[2])
    assert on_page(0.6, "EPS THB 0.60 last year")   # trailing zero as printed (DELTA 3Q2026)
    assert not on_page(0.6, PAGES[1])               # 0.6 is not 0.66


def test_invented_value_fails_evidence() -> None:
    bad = GOOD[:1] + [m("property_sales_revenue", 10560, 2)] + GOOD[2:]
    errs = errors_of(bad)
    assert any(e.startswith("evidence") and "10560" in e for e in errs), errs
    assert any(e.startswith("arith") for e in errs), errs  # and the identity no longer adds up


def test_wrong_page_fails() -> None:
    errs = errors_of([m("total_revenue", 10777, 2)])
    assert any("ไม่พบ 10777 ในหน้า 2" in e for e in errs), errs


def test_not_disclosed_must_be_null() -> None:
    zero = m("operating_cash_flow", 0, None, period="1H2026", status="not_disclosed")
    assert any("not_disclosed" in e for e in errors_of([zero]))
    reported_null = m("operating_cash_flow", None, None, period="1H2026")
    assert any("not_disclosed" in e for e in errors_of([reported_null]))
    ok = m("operating_cash_flow", None, None, period="1H2026", status="not_disclosed")
    assert errors_of([ok]) == []


def test_schema_and_duplicates() -> None:
    assert any("schema" in e for e in errors_of([m("ebitda", 1, 1)]))
    assert any("unit" in e for e in errors_of([m("total_revenue", 10777, 1, unit="THB_b")]))
    assert any("ตัวเลขล้วน" in e for e in errors_of([m("total_revenue", "10,777", 1)]))
    assert any("unique" in e for e in errors_of([GOOD[0], GOOD[0]]))


def test_rounding_tolerance() -> None:
    # 10,506 + 270 = 10,776 vs 10,777: off by 1 because the document rounds each figure to THB m.
    assert not any(e.startswith("arith") for e in errors_of(GOOD))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok  {name}")
    print("all tests passed")
