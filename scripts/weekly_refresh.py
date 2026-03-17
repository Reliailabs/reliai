"""Weekly README refresh script.

Updates the "What's New" section in the main README and all repo-template
READMEs, and rotates the "Featured Example" section.

Usage:
    python scripts/weekly_refresh.py [--date YYYY-MM-DD]

Idempotent: running multiple times on the same date produces no additional
changes after the first run.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

# ── What's New message pool ────────────────────────────────────────────────
# Indexed by ISO week number % len(MESSAGES).  New messages can be appended
# to extend the pool without breaking existing rotation.
MESSAGES: list[str] = [
    "Improved trace visualization in the demo control panel",
    "Added LangGraph agent example with guardrail tracing",
    "Refreshed marketing screenshots with latest UI",
    "Updated reliai-python SDK with zero-config auto-instrumentation",
    "Added FastAPI RAG example with retrieval span breakdown",
    "Improved incident command center layout and operator guidance",
    "Added evaluation pipeline example with regression scoring",
    "Updated reliai-demo with expanded synthetic traffic patterns",
    "Refreshed architecture diagrams across all repo templates",
    "Added deployment regression detection walkthrough to docs",
    "Updated guardrail retry simulation in the demo agent",
    "Improved trace graph rendering for multi-service spans",
]

# ── Featured examples ──────────────────────────────────────────────────────
EXAMPLES: list[dict[str, str]] = [
    {
        "key": "simple-llm",
        "link": "./examples/simple-llm",
        "description": (
            "Minimal LLM call traced with `@reliai.trace` — "
            "the fastest path from zero to your first trace."
        ),
    },
    {
        "key": "fastapi-rag",
        "link": "./examples/fastapi-rag",
        "description": (
            "FastAPI + retriever + LLM with retrieval spans and "
            "latency breakdown per step."
        ),
    },
    {
        "key": "langgraph-agent",
        "link": "./examples/langgraph-agent",
        "description": (
            "Multi-step agent with tool calls, memory reads, and "
            "guardrail hooks — all traced automatically."
        ),
    },
]

# ── READMEs that get a "What's New" section ───────────────────────────────
WHATS_NEW_FILES: list[Path] = [
    REPO_ROOT / "README.md",
    REPO_ROOT / "repo-templates" / "reliai" / "README.md",
    REPO_ROOT / "repo-templates" / "reliai-python" / "README.md",
    REPO_ROOT / "repo-templates" / "reliai-demo" / "README.md",
    REPO_ROOT / "repo-templates" / "reliai-examples" / "README.md",
    REPO_ROOT / "repo-templates" / "reliai-agent-starter" / "README.md",
    REPO_ROOT / "repo-templates" / "reliai-rag-starter" / "README.md",
]

# ── READMEs that get a "Featured Example" section ────────────────────────
FEATURED_EXAMPLE_FILES: list[Path] = [
    REPO_ROOT / "README.md",
    REPO_ROOT / "repo-templates" / "reliai-examples" / "README.md",
]

MAX_ENTRIES = 5

# ── Regex patterns ────────────────────────────────────────────────────────
_WHATS_NEW_SECTION = re.compile(
    r"(## What's New\n\n)((?:- \(\d{4}-\d{2}-\d{2}\)[^\n]*\n)*)",
    re.MULTILINE,
)
_FEATURED_EXAMPLE_SECTION = re.compile(
    r"(## Featured Example\n\n).*?(?=\n---|\n## |\Z)",
    re.DOTALL,
)


def _whats_new_message(week_number: int) -> str:
    return MESSAGES[week_number % len(MESSAGES)]


def _featured_example(week_number: int) -> dict[str, str]:
    return EXAMPLES[week_number % len(EXAMPLES)]


def _update_whats_new(content: str, entry_date: str, week_number: int) -> str:
    """Prepend a dated bullet to the What's New section, cap at MAX_ENTRIES."""
    match = _WHATS_NEW_SECTION.search(content)
    if match is None:
        return content  # section not found — skip silently

    header = match.group(1)
    bullets_block = match.group(2)

    # Idempotency: skip if this date already has an entry
    if f"({entry_date})" in bullets_block:
        return content

    existing_bullets = [
        line for line in bullets_block.splitlines() if line.strip()
    ]
    message = _whats_new_message(week_number)
    new_bullet = f"- ({entry_date}) {message}"
    updated_bullets = [new_bullet] + existing_bullets
    updated_bullets = updated_bullets[:MAX_ENTRIES]

    new_block = "\n".join(updated_bullets) + "\n"
    return content[: match.start()] + header + new_block + content[match.end() :]


def _update_featured_example(content: str, week_number: int) -> str:
    """Replace the Featured Example section with the current week's pick."""
    match = _FEATURED_EXAMPLE_SECTION.search(content)
    if match is None:
        return content  # section not found — skip silently

    ex = _featured_example(week_number)
    new_body = f"**[{ex['key']}]({ex['link']})** — {ex['description']}\n"

    header = match.group(1)
    replacement = header + new_body
    return content[: match.start()] + replacement + content[match.end() :]


def process_file(
    path: Path,
    entry_date: str,
    week_number: int,
    update_featured: bool,
) -> bool:
    """Update a single README. Returns True if the file was modified."""
    if not path.exists():
        print(f"  skip (not found): {path.relative_to(REPO_ROOT)}")
        return False

    original = path.read_text(encoding="utf-8")
    content = _update_whats_new(original, entry_date, week_number)
    if update_featured:
        content = _update_featured_example(content, week_number)

    if content == original:
        print(f"  unchanged: {path.relative_to(REPO_ROOT)}")
        return False

    path.write_text(content, encoding="utf-8")
    print(f"  updated:   {path.relative_to(REPO_ROOT)}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Weekly README refresh")
    parser.add_argument(
        "--date",
        default=date.today().isoformat(),
        help="Date string YYYY-MM-DD (default: today)",
    )
    args = parser.parse_args()

    try:
        parsed_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    except ValueError:
        print(f"Invalid date: {args.date}. Use YYYY-MM-DD.", file=sys.stderr)
        return 1

    entry_date = parsed_date.isoformat()
    week_number = parsed_date.isocalendar()[1]

    print(f"Weekly refresh — date={entry_date}, week={week_number}")

    any_changed = False

    print("\nWhat's New updates:")
    for path in WHATS_NEW_FILES:
        changed = process_file(
            path,
            entry_date,
            week_number,
            update_featured=path in FEATURED_EXAMPLE_FILES,
        )
        any_changed = any_changed or changed

    # Handle Featured Example files not already in WHATS_NEW_FILES
    print("\nFeatured Example updates:")
    for path in FEATURED_EXAMPLE_FILES:
        if path in WHATS_NEW_FILES:
            continue  # already handled above
        changed = process_file(path, entry_date, week_number, update_featured=True)
        any_changed = any_changed or changed

    if any_changed:
        print("\nFiles changed — ready to commit.")
    else:
        print("\nNo changes — already up to date.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
