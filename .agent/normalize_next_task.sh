#!/usr/bin/env bash
set -e

python3 - <<'PY'
from pathlib import Path

p = Path.home() / ".openclaw" / "workspace" / "slotsmathguide-site" / ".agent" / "NEXT_TASK.md"
text = p.read_text(encoding="utf-8") if p.exists() else ""

lines = [line.rstrip() for line in text.splitlines() if line.strip()]
task = next((x for x in lines if x.startswith("TASK: ")), "TASK: Define the next homepage improvement.")
why = next((x for x in lines if x.startswith("WHY: ")), "WHY: Improve homepage conversion, trust, and scanability.")
browser_line = next((x for x in lines if x.startswith("BROWSER: ")), None)

browser = "BROWSER: yes" if browser_line is None else (
    "BROWSER: yes" if browser_line.split(":", 1)[1].strip().lower() == "yes" else "BROWSER: no"
)

out = "\n".join([
    task,
    "FILE: index.html",
    why,
    browser,
]) + "\n"

p.write_text(out, encoding="utf-8")
PY
