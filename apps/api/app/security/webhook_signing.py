from __future__ import annotations

import hashlib
import hmac
import time


def sign_webhook_payload(*, secret: str, timestamp: int, body: bytes) -> str:
    payload = f"{timestamp}.".encode("utf-8") + body
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def verify_webhook_signature(
    *,
    secret: str,
    timestamp: int,
    signature: str,
    body: bytes,
    max_age_seconds: int,
    now_seconds: int | None = None,
) -> bool:
    now = int(time.time()) if now_seconds is None else now_seconds
    if max_age_seconds < 1:
        return False
    if abs(now - timestamp) > max_age_seconds:
        return False
    expected = sign_webhook_payload(secret=secret, timestamp=timestamp, body=body)
    return hmac.compare_digest(expected, signature)
