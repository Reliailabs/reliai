from __future__ import annotations

import os
import sys

BOOTSTRAP_FLAG = "RELIAI_BOOTSTRAPPED"
AUTO_INSTRUMENT_FLAG = "RELIAI_AUTO_INSTRUMENT"


def main(argv: list[str] | None = None) -> int:
    command = list(sys.argv[1:] if argv is None else argv)
    if not command:
        print("Usage: reliai-run <command> [args...]", file=sys.stderr)
        return 1

    if os.environ.get(BOOTSTRAP_FLAG) != "1":
        os.environ[BOOTSTRAP_FLAG] = "1"
        os.environ[AUTO_INSTRUMENT_FLAG] = "true"

    os.execvp(command[0], command)
    return 0
