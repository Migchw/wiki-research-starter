"""Generate .agents/skills/ (Antigravity CLI and other Agent Skills tools) from .claude/.

Source of truth is .claude/skills/*/SKILL.md plus .claude/agents/reviewer.md (as a skill, since
other agents have no Claude Code subagent). Edit the source, then run this script.
--check exits 1 if .agents/skills/ is out of date.

Usage: python scripts/sync_skills.py [--check]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent
SRC = VAULT / ".claude"
DST = VAULT / ".agents" / "skills"
NOTICE = ("<!-- สร้างจาก {src} ด้วย scripts/sync_skills.py ห้ามแก้ไฟล์นี้ตรงๆ "
          "ให้แก้ต้นฉบับแล้วรันสคริปต์ใหม่ -->\n")

# Claude Code-only wording -> wording any agent can follow.
REPLACE = [
    ("`$ARGUMENTS`", "argument ที่ผู้ใช้พิมพ์ต่อจากชื่อ skill"),
    ("เรียก subagent `reviewer` ให้ตรวจ",
     "ใช้ skill `reviewer` เป็นขั้นแยก (ตัดสินจากไฟล์เท่านั้น ไม่อิงบทสนทนาก่อนหน้า) ให้ตรวจ"),
]


def convert(text: str, src: str) -> str:
    end = text.index("\n---", 3) + len("\n---\n")
    head = "".join(line for line in text[:end].splitlines(keepends=True)
                   if not line.startswith("tools:"))  # subagent-only field
    body = text[end:]
    for old, new in REPLACE:
        body = body.replace(old, new)
    return head + NOTICE.format(src=src) + body


def expected() -> dict[Path, str]:
    out = {}
    for skill in sorted(SRC.glob("skills/*/SKILL.md")):
        rel = skill.relative_to(VAULT).as_posix()
        out[DST / skill.parent.name / "SKILL.md"] = convert(skill.read_text(encoding="utf-8"), rel)
    reviewer = SRC / "agents" / "reviewer.md"
    out[DST / "reviewer" / "SKILL.md"] = convert(reviewer.read_text(encoding="utf-8"),
                                                 reviewer.relative_to(VAULT).as_posix())
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="ไม่เขียนไฟล์ แค่ตรวจว่าตรงกับต้นฉบับ")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console prints Thai

    want = expected()
    have = set(DST.glob("*/SKILL.md")) if DST.exists() else set()
    stale = [p for p, t in want.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
    extra = sorted(have - set(want))

    if args.check:
        for p in stale + extra:
            print(f"OUT OF DATE  {p.relative_to(VAULT).as_posix()}")
        print("OK" if not stale and not extra else "รัน python scripts/sync_skills.py")
        return 1 if stale or extra else 0

    for p in stale:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(want[p], encoding="utf-8", newline="\n")
        print(f"WROTE  {p.relative_to(VAULT).as_posix()}")
    for p in extra:
        p.unlink()
        print(f"REMOVED  {p.relative_to(VAULT).as_posix()}")
    print(f"{len(want)} skills ใน .agents/skills/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
