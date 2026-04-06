#!/usr/bin/env python3
"""
BASE Hook Template — Canonical reference for data surface injection hooks.

THIS IS A TEMPLATE, NOT A RUNNABLE HOOK.
Copy this file, rename it to {surface}-hook.py, and customize the marked sections.

=== CONTRACT ===
Every data surface hook MUST follow this contract:
  1. Reads ONE JSON file from .base/data/{SURFACE_NAME}.json
  2. Outputs a compact XML-tagged block to stdout
  3. Wraps output in <{SURFACE_NAME}-awareness> tags
  4. Includes a BEHAVIOR directive block
  5. Exits cleanly (exit 0) — never crashes, never blocks

=== DO ===
  - Read the JSON file using absolute paths (Path(__file__).resolve())
  - Format a compact summary: IDs, one-line descriptions, grouped by priority/status
  - Include item count summaries
  - Include the behavioral directive (passive by default)
  - Handle missing/empty/malformed files gracefully (output nothing, exit 0)
  - Keep output compact — hooks fire every prompt, token cost matters

=== DO NOT ===
  - Never write to any file
  - Never make network calls
  - Never import heavy dependencies (sys, json, pathlib ONLY)
  - Never read multiple data files (one hook = one surface)
  - Never include full item details in injection (that's what MCP tools are for)
  - Never include dynamic logic that changes based on time of day, session count, etc.

=== TRIGGERS ===
Register in .claude/settings.json under UserPromptSubmit.
Use `which python3` to detect the absolute python path for your system.
  {
    "type": "command",
    "command": "{absolute_python3_path} /absolute/path/to/.base/hooks/{surface}-hook.py"
  }
"""

import sys
import json
from pathlib import Path

# ============================================================
# CONFIGURATION — CUSTOMIZE THIS
# ============================================================

SURFACE_NAME = "example"  # CHANGE THIS: your surface name (e.g., "active", "backlog")

# ============================================================
# PATH RESOLUTION — DO NOT CHANGE
# ============================================================

HOOK_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = HOOK_DIR.parent           # .base/hooks/ → .base/ → workspace root is parent of .base/
# Fix: .base/hooks/_template.py → .base/ is parent, workspace root is parent of .base/
WORKSPACE_ROOT = HOOK_DIR.parent.parent
DATA_FILE = WORKSPACE_ROOT / ".base" / "data" / f"{SURFACE_NAME}.json"

# ============================================================
# BEHAVIORAL DIRECTIVE — CUSTOMIZE IF NEEDED
# ============================================================

BEHAVIOR_DIRECTIVE = f"""BEHAVIOR: This context is PASSIVE AWARENESS ONLY.
Do NOT proactively mention these items unless:
  - User explicitly asks (e.g., "what should I work on?", "what's next?")
  - A deadline is within 24 hours AND user hasn't acknowledged it this session
For details on any item, use base_get_item("{SURFACE_NAME}", id)."""


def main():
    # --- Read hook input from stdin (Claude Code provides session context) ---
    try:
        input_data = json.loads(sys.stdin.read())
        session_id = input_data.get("session_id", "")
    except (json.JSONDecodeError, OSError):
        session_id = ""

    # --- Guard: file must exist ---
    if not DATA_FILE.exists():
        sys.exit(0)

    # --- Read and parse JSON ---
    try:
        data = json.loads(DATA_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        sys.exit(0)

    # ============================================================
    # ITEM EXTRACTION — CUSTOMIZE THIS
    # ============================================================
    # Default expects: { "items": [ { "id": "...", "title": "...", ... }, ... ] }
    # Adjust the key and field names to match your surface's schema.

    items = data.get("items", [])

    if not items:
        sys.exit(0)

    # ============================================================
    # SUMMARY FORMATTING — CUSTOMIZE THIS
    # ============================================================
    # Build compact summary lines. Keep it SHORT — one line per item max.
    # Group by status/priority if your schema supports it.
    # Example format: "- [ID] Title (status)"

    lines = []
    for item in items:
        item_id = item.get("id", "?")
        title = item.get("title", "untitled")
        status = item.get("status", "")
        status_suffix = f" ({status})" if status else ""
        lines.append(f"- [{item_id}] {title}{status_suffix}")

    # --- Output ---
    if lines:
        count = len(items)
        summary = "\n".join(lines)
        print(f"""<{SURFACE_NAME}-awareness items="{count}">
{summary}

{BEHAVIOR_DIRECTIVE}
</{SURFACE_NAME}-awareness>""")

    sys.exit(0)


if __name__ == "__main__":
    main()
