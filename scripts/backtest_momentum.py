"""Momentum backtest (12-1 vs 12-7) on SET100 that logs every run as an experiment note.

Every real run is one trial: it writes experiments/E-xxx.md with metrics computed here,
never typed by hand. Use --dry-run while developing so you do not create fake trials.

Usage:
  python scripts/backtest_momentum.py --hypothesis H-001 --lookback 12-1
  python scripts/backtest_momentum.py --hypothesis H-001 --lookback 12-7 --sample in_sample
  python scripts/backtest_momentum.py --hypothesis H-001 --lookback 12-1 --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

VAULT = Path(__file__).resolve().parent.parent
SCRIPT_REL = "scripts/backtest_momentum.py"
UNIVERSE_REL = "scripts/set100.txt"

# Signal = P[t - near] / P[t - 12] - 1 at formation month-end t; held over month t+1.
#   12-1: months t-11..t-1 (skip the most recent month)
#   12-7: months t-11..t-6 window ending 6 months back (Novy-Marx intermediate horizon)
LOOKBACKS = {"12-1": 1, "12-7": 6}
ALLOWED_STATUS = {"preregistered", "testing"}
QUANTILES = 5
MIN_NAMES = 5 * QUANTILES
DOWNLOAD_START = "2008-12-01"
MIN_PRICED = 0.95  # share of the universe that must have prices before a run counts
EXTREME_RET = 1.0  # flag single-stock monthly returns above +/-100% as data-quality suspects

FIELD_ORDER = ["type", "id", "hypothesis", "trial_no", "code_ref", "lookback", "skip", "rebalance",
               "quantiles", "costs_bps", "sample", "sharpe", "ann_return", "t_stat", "max_dd",
               "turnover", "known_biases", "reviewer_verdict", "run_at", "tags"]
METRICS = ["sharpe", "ann_return", "t_stat", "max_dd"]


class GateError(Exception):
    """Raised when a research rule forbids the run."""


# ---------- vault helpers ----------

def read_note(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    end = text.find("\n---", 3)
    return yaml.safe_load(text[3:end]) or {}, text[end + 4:]


def find_hypothesis(vault: Path, hyp_id: str) -> Path:
    for path in sorted((vault / "hypotheses").glob("*.md")):
        meta, _ = read_note(path)
        if meta.get("id") == hyp_id:
            return path
    raise GateError(f"ไม่พบ hypothesis id '{hyp_id}' ใน hypotheses/")


def experiments_for(vault: Path, stem: str) -> list[tuple[Path, dict]]:
    out = []
    for path in sorted((vault / "experiments").glob("E-*.md")):
        meta, _ = read_note(path)
        if f"[[{stem}]]" in str(meta.get("hypothesis", "")):
            out.append((path, meta))
    return out


def has_run(meta: dict) -> bool:
    return bool(meta.get("run_at")) or any(meta.get(k) not in (None, "") for k in METRICS)


def next_experiment_id(vault: Path) -> str:
    nums = [int(m.group(1)) for p in (vault / "experiments").glob("E-*.md")
            if (m := re.fullmatch(r"E-(\d+)", p.stem))]
    return f"E-{max(nums, default=0) + 1:03d}"


def parse_window(text: str) -> tuple[pd.Period, pd.Period]:
    start, end = str(text).split("..")
    return pd.Period(start, "M"), pd.Period(end, "M")


def git_ref(vault: Path) -> str:
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=vault, check=True,
                             capture_output=True, text=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", SCRIPT_REL, UNIVERSE_REL],
                               cwd=vault, check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return f"{SCRIPT_REL}@nogit"
    return f"{SCRIPT_REL}@{sha}{'-dirty' if dirty else ''}"


# ---------- data ----------

def load_universe(vault: Path) -> list[str]:
    lines = (vault / UNIVERSE_REL).read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.startswith("#")]


def load_prices(vault: Path, symbols: list[str], end: str, refresh: bool) -> pd.DataFrame:
    """Daily adjusted close from yfinance, cached under data/ (gitignored).

    A partial download (rate limit, flaky network) would silently shrink the universe and
    produce a trial that can never be deleted, so refuse to run or cache below MIN_PRICED.
    """
    tag = hashlib.sha1(" ".join(symbols).encode()).hexdigest()[:8]
    cache = vault / "data" / f"set100_close_{DOWNLOAD_START}_{end}_{tag}.csv"
    if cache.exists() and not refresh:
        return pd.read_csv(cache, index_col=0, parse_dates=True)
    import yfinance as yf

    warnings.filterwarnings("ignore")

    def fetch(names: list[str]) -> pd.DataFrame:
        close = yf.download([f"{s}.BK" for s in names], start=DOWNLOAD_START, end=end,
                            auto_adjust=True, progress=False, threads=True)["Close"]
        if isinstance(close, pd.Series):
            close = close.to_frame(f"{names[0]}.BK")
        close.columns = [c.removesuffix(".BK") for c in close.columns]
        return close.dropna(how="all", axis=1)

    raw = fetch(symbols)
    for name in [s for s in symbols if s not in raw.columns]:  # retry one by one
        one = fetch([name])
        if not one.empty:
            raw = raw.join(one, how="outer")
    missing = sorted(set(symbols) - set(raw.columns))
    if len(symbols) - len(missing) < MIN_PRICED * len(symbols):
        raise GateError(f"ดาวน์โหลดราคาได้ {len(symbols) - len(missing)}/{len(symbols)} ตัว "
                        f"(ขาด {', '.join(missing)}) ไม่บันทึก cache และไม่สร้าง experiment ลองใหม่อีกครั้ง")
    if missing:
        print(f"NOTE  ไม่มีราคาใน yfinance: {', '.join(missing)}")
    cache.parent.mkdir(exist_ok=True)
    raw.to_csv(cache)
    return raw


# ---------- backtest ----------

def momentum_signal(monthly: pd.DataFrame, lookback: str) -> pd.DataFrame:
    return monthly.shift(LOOKBACKS[lookback]) / monthly.shift(12) - 1


def backtest(monthly: pd.DataFrame, lookback: str, window: tuple[pd.Period, pd.Period],
             costs_bps: float) -> dict:
    signal = momentum_signal(monthly, lookback)
    fwd = monthly.shift(-1) / monthly - 1  # return over month t+1, known only after t+1
    hold = monthly.index.to_period("M") + 1

    rows, quint_rets, prev_w = [], [], pd.Series(dtype=float)
    for i, t in enumerate(monthly.index):
        if not (window[0] <= hold[i] <= window[1]):
            continue
        ok = signal.loc[t].notna() & fwd.loc[t].notna() & monthly.loc[t].notna()
        names = ok[ok].index
        if len(names) < MIN_NAMES:
            rows.append({"month": hold[i], "n": len(names), "gross": np.nan, "turnover": np.nan})
            continue
        ranks = signal.loc[t, names].rank(method="first")
        q = pd.qcut(ranks, QUANTILES, labels=False) + 1
        r = fwd.loc[t, names]
        quint_rets.append(r.groupby(q).mean())

        w = pd.Series(0.0, index=names)
        w[q == QUANTILES] = 1.0 / (q == QUANTILES).sum()
        w[q == 1] = -1.0 / (q == 1).sum()
        traded = w.sub(prev_w, fill_value=0.0).abs().sum()
        prev_w = w[w != 0]
        rows.append({"month": hold[i], "n": len(names), "gross": float((w * r).sum()),
                     "turnover": float(traded)})

    res = pd.DataFrame(rows).set_index("month")
    skipped = int(res["gross"].isna().sum())
    res = res.dropna()
    if len(res) < 24:
        raise GateError(f"มีเดือนที่ใช้ได้แค่ {len(res)} เดือน (ต้องมีอย่างน้อย 24)")
    res["cost"] = res["turnover"] * costs_bps / 1e4
    res["net"] = res["gross"] - res["cost"]

    net, n = res["net"], len(res)
    wealth = (1 + net).cumprod()
    return {
        "sharpe": float(net.mean() / net.std(ddof=1) * np.sqrt(12)),
        "ann_return": float(wealth.iloc[-1] ** (12 / n) - 1),
        "t_stat": float(net.mean() / (net.std(ddof=1) / np.sqrt(n))),
        "max_dd": float((wealth / wealth.cummax().clip(lower=1) - 1).min()),
        # one-way turnover per leg: sum|dw| over both legs / 4, in [0, 1]
        "turnover": float(res["turnover"].iloc[1:].mean() / 4),
        "gross_sharpe": float(res["gross"].mean() / res["gross"].std(ddof=1) * np.sqrt(12)),
        "mean_gross": float(res["gross"].mean()),
        "mean_net": float(net.mean()),
        "n_months": n,
        "skipped_months": skipped,
        "names_min": int(res["n"].min()),
        "names_median": int(res["n"].median()),
        "names_max": int(res["n"].max()),
        "first": str(res.index[0]),
        "last": str(res.index[-1]),
        "quintiles": pd.concat(quint_rets, axis=1).mean(axis=1),
    }


# ---------- output ----------

def render(meta: dict, stats: dict, ctx: dict) -> str:
    fm = yaml.safe_dump({k: meta[k] for k in FIELD_ORDER}, sort_keys=False, allow_unicode=True,
                        default_flow_style=None, width=200)
    q = stats["quintiles"]
    qrow = " | ".join(f"{q.get(i, float('nan')) * 100:.2f}%" for i in range(1, QUANTILES + 1))
    oos_note = ("\n> ⚠️ รัน out_of_sample ด้วย `--force-oos` ก่อนมี in_sample ที่ Reviewer ให้ pass\n"
                if ctx["forced_oos"] else "")
    return f"""---
{fm}---

# {meta['id']}: {meta['lookback']} momentum บน {ctx['universe']} ({meta['sample']}) · trial {meta['trial_no']}

> สร้างอัตโนมัติโดย `{meta['code_ref']}` เมื่อ {meta['run_at']} ห้ามแก้ตัวเลขด้วยมือ
{oos_note}
## Config
- Hypothesis: {meta['hypothesis']}
- Signal: P[t-{meta['skip']}] / P[t-12] − 1 ณ สิ้นเดือน t ถือเดือน t+1 (lookback {meta['lookback']}, skip {meta['skip']} เดือน)
- Universe: {ctx['universe']} รายชื่อปัจจุบัน {ctx['n_universe']} ตัว (`{UNIVERSE_REL}`) มีราคาใน yfinance {ctx['n_priced']} ตัว{ctx['missing']}
- ช่วงถือพอร์ต: {stats['first']} ถึง {stats['last']} ({stats['n_months']} เดือน · ข้าม {stats['skipped_months']} เดือนที่มีหุ้นน้อยกว่า {MIN_NAMES} ตัว)
- จำนวนหุ้นต่อเดือน: min {stats['names_min']} · median {stats['names_median']} · max {stats['names_max']}
- Portfolio: quintile equal-weight long Q5 / short Q1, rebalance รายเดือน
- ค่าธรรมเนียม: {meta['costs_bps']} bps × Σ|Δw| ทุกเดือน (นับทั้งสองขา ไม่คิด weight drift)
- ข้อมูล: yfinance `auto_adjust=True` ราคาปิดสิ้นเดือน cache ที่ `data/` (ไม่ commit)

## ผลลัพธ์ (หลังหักค่าธรรมเนียม)
| metric | ค่า |
|---|---|
| Sharpe (annualized) | {stats['sharpe']:.2f} |
| Annual return (geometric) | {stats['ann_return'] * 100:.2f}% |
| t-stat ของผลตอบแทนเฉลี่ยรายเดือน | {stats['t_stat']:.2f} |
| Max drawdown | {stats['max_dd'] * 100:.2f}% |
| Turnover ต่อขาต่อเดือน (one-way) | {stats['turnover'] * 100:.1f}% |
| ผลตอบแทนเฉลี่ยรายเดือน gross / net | {stats['mean_gross'] * 100:.2f}% / {stats['mean_net'] * 100:.2f}% |
| Sharpe ก่อนหักค่าธรรมเนียม | {stats['gross_sharpe']:.2f} |

ผลตอบแทนเฉลี่ยรายเดือนของแต่ละ quintile (Q1 = loser ... Q5 = winner):

| Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|
| {qrow} |

นิยาม: Sharpe = mean/std × √12 · t-stat = mean/(std/√n) ไม่ปรับ autocorrelation ·
max drawdown คิดจาก wealth แบบทบต้น · turnover = Σ|Δw| / 4

## ข้อจำกัดที่รู้อยู่แล้ว
- **Survivorship bias**: ใช้รายชื่อ SET100 ปัจจุบันย้อนหลังทั้งช่วง หุ้นที่หลุดดัชนีหรือเพิกถอนไม่อยู่ในตัวอย่าง
- ตัดหุ้นที่ไม่มีผลตอบแทนเดือน t+1 ออกตอนสร้างพอร์ต (ใช้ข้อมูลอนาคตเล็กน้อย)
- ผลตอบแทนรายเดือนของหุ้นตัวเดียวที่เกิน ±{EXTREME_RET * 100:.0f}% มี {ctx['extreme']} ครั้งในช่วงนี้ (อาจเป็นปัญหาข้อมูลจาก yfinance)
- จำนวน trial ของ hypothesis นี้ ณ ตอนรัน: {meta['trial_no']} (ใช้ประกอบ deflated Sharpe ใน Module 8)

## Reviewer notes
รอ Reviewer ตรวจ (`reviewer_verdict: pending`)
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hypothesis", required=True, help="เช่น H-001")
    parser.add_argument("--lookback", choices=sorted(LOOKBACKS), default="12-1")
    parser.add_argument("--sample", choices=["in_sample", "out_of_sample"], default="in_sample")
    parser.add_argument("--costs-bps", type=float, default=30)
    parser.add_argument("--vault", type=Path, default=VAULT)
    parser.add_argument("--dry-run", action="store_true", help="พิมพ์ผลเท่านั้น ไม่เขียนไฟล์ (ไม่นับเป็น trial)")
    parser.add_argument("--force-oos", action="store_true",
                        help="ยอมรัน out_of_sample ทั้งที่ยังไม่มี in_sample ที่ผ่าน Reviewer (บันทึกไว้ใน experiment)")
    parser.add_argument("--refresh", action="store_true", help="ดาวน์โหลดราคาใหม่ ไม่ใช้ cache")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    vault = args.vault.resolve()

    try:
        hyp_path = find_hypothesis(vault, args.hypothesis)
        hyp, _ = read_note(hyp_path)
        status = hyp.get("status")
        if status not in ALLOWED_STATUS:
            raise GateError(f"{args.hypothesis} status '{status}' ต้องเป็น preregistered หรือ testing ก่อนรัน "
                            "(pre-registration rule)")
        stem = hyp_path.stem
        existing = experiments_for(vault, stem)
        forced_oos = False
        if args.sample == "out_of_sample":
            passed = [m for _, m in existing if m.get("sample") == "in_sample"
                      and m.get("reviewer_verdict") == "pass" and str(m.get("lookback")) == args.lookback]
            if not passed:
                if not args.force_oos:
                    raise GateError(f"ยังไม่มี in_sample {args.lookback} ของ {args.hypothesis} ที่ Reviewer ให้ pass "
                                    "ห้ามแตะ out-of-sample (ใช้ --force-oos ถ้าจำเป็นจริง และจะถูกบันทึกไว้)")
                forced_oos = True
                print("WARNING  รัน out_of_sample ก่อนผ่าน Reviewer — บันทึกไว้ใน experiment แล้ว")

        window = parse_window(hyp[args.sample])
        last = max(parse_window(hyp["in_sample"])[1], parse_window(hyp["out_of_sample"])[1])
        end = (last + 1).to_timestamp(how="end").strftime("%Y-%m-%d")
        symbols = load_universe(vault)
        daily = load_prices(vault, symbols, end, args.refresh)
        monthly = daily.resample("ME").last()
        stats = backtest(monthly, args.lookback, window, args.costs_bps)
    except GateError as exc:
        print(f"REFUSED  {exc}")
        return 2

    rets = monthly.pct_change(fill_method=None)
    in_win = (rets.index.to_period("M") >= window[0]) & (rets.index.to_period("M") <= window[1])
    extreme = int((rets[in_win].abs() > EXTREME_RET).sum().sum())

    stubs = [(p, m) for p, m in existing if not has_run(m)]
    trial_no = max((int(m.get("trial_no") or 0) for _, m in existing if has_run(m)), default=0) + 1
    exp_path = stubs[0][0] if stubs else vault / "experiments" / f"{next_experiment_id(vault)}.md"
    biases = ["survivorship"] + (["oos-before-review"] if forced_oos else [])
    meta = {
        "type": "experiment", "id": exp_path.stem, "hypothesis": f"[[{stem}]]", "trial_no": trial_no,
        "code_ref": git_ref(vault), "lookback": args.lookback, "skip": LOOKBACKS[args.lookback],
        "rebalance": "monthly", "quantiles": QUANTILES, "costs_bps": int(args.costs_bps)
        if float(args.costs_bps).is_integer() else args.costs_bps,
        "sample": args.sample, "sharpe": round(stats["sharpe"], 3),
        "ann_return": round(stats["ann_return"], 4), "t_stat": round(stats["t_stat"], 3),
        "max_dd": round(stats["max_dd"], 4), "turnover": round(stats["turnover"], 4),
        "known_biases": biases, "reviewer_verdict": "pending",
        "run_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tags": ["experiment", "momentum"],
    }
    ctx = {"universe": hyp.get("universe", "SET100"), "n_universe": len(symbols),
           "n_priced": daily.shape[1], "extreme": extreme, "forced_oos": forced_oos,
           "missing": "".join(f" (ไม่มี: {', '.join(m)})" for m in [sorted(set(symbols) - set(daily.columns))] if m)}
    note = render(meta, stats, ctx)

    summary = (f"{meta['id']} trial {trial_no} · {args.lookback} {args.sample} · sharpe {meta['sharpe']} · "
               f"t {meta['t_stat']} · ann {meta['ann_return']} · maxDD {meta['max_dd']} · "
               f"turnover {meta['turnover']} · {stats['n_months']} เดือน")
    if args.dry_run:
        print(note)
        print(f"DRY-RUN  {summary} (ไม่ได้เขียนไฟล์)")
        return 0

    exp_path.write_text(note, encoding="utf-8", newline="\n")
    print(f"WROTE  {exp_path.relative_to(vault).as_posix()}  {summary}")
    if status == "preregistered":
        text = hyp_path.read_text(encoding="utf-8")
        hyp_path.write_text(text.replace("status: preregistered", "status: testing", 1),
                            encoding="utf-8", newline="\n")
        print(f"UPDATED  {hyp_path.relative_to(vault).as_posix()}  status: preregistered → testing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
