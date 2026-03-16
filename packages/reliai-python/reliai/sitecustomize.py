from __future__ import annotations

import os

_BOOTSTRAPPED = False


def bootstrap() -> None:
    global _BOOTSTRAPPED
    if _BOOTSTRAPPED:
        return
    if os.getenv("RELIAI_AUTO_INSTRUMENT", "").lower() != "true":
        return

    try:
        import reliai

        reliai.init()
        reliai.auto_instrument()
        _BOOTSTRAPPED = True
    except Exception:
        return


bootstrap()
