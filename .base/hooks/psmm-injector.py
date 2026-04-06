#!/usr/bin/env python3
"""
Hook: psmm-injector.py
Purpose: Per-Session Meta Memory — inject ephemeral session observations
         into every prompt so they stay hot in long sessions (1M window).

         Uses a single psmm.json file with session-keyed entries.
         Each session gets its own array keyed by Claude Code session UUID.
         Stale sessions are NOT auto-cleaned — that's the operator's job
         via CARL hygiene / BASE drift detection.

Triggers: UserPromptSubmit
Output: Current session's PSMM entries as system context, or silent if empty.
"""

import sys
import json
from pathlib import Path

HOOK_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = HOOK_DIR.parent.parent
PSMM_FILE = WORKSPACE_ROOT / ".base" / "data" / "psmm.json"


def main():
    # Get session_id from hook input
    try:
        input_data = json.loads(sys.stdin.read())
        session_id = input_data.get("session_id", "")
    except (json.JSONDecodeError, OSError):
        session_id = ""

    if not session_id or not PSMM_FILE.exists():
        sys.exit(0)

    try:
        data = json.loads(PSMM_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        sys.exit(0)

    sessions = data.get("sessions", {})
    session = sessions.get(session_id)

    if not session or not session.get("entries"):
        sys.exit(0)

    # Build output from this session's entries
    entries = session["entries"]
    lines = []
    for entry in entries:
        entry_type = entry.get("type", "NOTE")
        text = entry.get("text", "")
        timestamp = entry.get("timestamp", "")
        lines.append(f"- [{timestamp}] {entry_type}: {text}")

    if lines:
        created = session.get("created", "unknown")
        count = len(entries)
        print(f"""<psmm session="{session_id[:8]}" entries="{count}" created="{created}">
{chr(10).join(lines)}
</psmm>""")

    sys.exit(0)


if __name__ == "__main__":
    main()
