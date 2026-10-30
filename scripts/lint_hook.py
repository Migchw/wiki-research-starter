"""Claude Code PostToolUse hook: run wiki_lint after a Markdown file in the vault is written.

Reads the hook payload (JSON) from stdin. Exit 2 sends the lint errors back to Claude so it
fixes them before continuing; exit 0 otherwise. Configured in .claude/settings.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(VAULT / "scripts"))


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not file_path.endswith(".md"):
        return 0
    try:
        Path(file_path).resolve().relative_to(VAULT)
    except ValueError:
        return 0  # outside the vault

    try:
        from wiki_lint import lint
    except ImportError as exc:
        print(f"wiki_lint hook: import ไม่ได้ ({exc}) ติดตั้ง requirements.txt ก่อน", file=sys.stderr)
        return 0

    errors = lint(VAULT)
    if not errors:
        return 0
    sys.stderr.reconfigure(encoding="utf-8")
    print(f"wiki_lint FAIL ({len(errors)} error) หลังแก้ {Path(file_path).name} — แก้ให้ผ่านก่อนทำงานต่อ:",
          file=sys.stderr)
    for err in errors:
        print(f"  {err}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
