from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock

from fastapi import HTTPException, status
from redis.exceptions import RedisError

from app.db.session import get_redis

_fallback_counts: dict[str, int] = {}
_fallback_lock = Lock()


def _bucket_expiry(seconds: int) -> int:
    return max(seconds, 1)


def _increment_with_fallback(*, key: str, amount: int = 1, window_seconds: int = 86400) -> int:
    try:
        redis = get_redis()
        value = int(redis.incrby(key, amount))
        if value == amount:
            redis.expire(key, _bucket_expiry(window_seconds))
        return value
    except RedisError:
        with _fallback_lock:
            _fallback_counts[key] = _fallback_counts.get(key, 0) + amount
            return _fallback_counts[key]


def enforce_rate_limit(*, scope: str, key: str, limit: int, window_seconds: int) -> int:
    if limit <= 0:
        return 0
    bucket_key = f"rate_limit:{scope}:{key}"
    current = _increment_with_fallback(key=bucket_key, window_seconds=window_seconds)
    if current > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {scope}",
        )
    return current


def day_bucket_key(*, prefix: str, identifier: str, now: datetime | None = None) -> str:
    anchor = now.astimezone(timezone.utc) if now is not None else datetime.now(timezone.utc)
    return f"{prefix}:{identifier}:{anchor.date().isoformat()}"


def month_bucket_key(*, prefix: str, identifier: str, now: datetime | None = None) -> str:
    anchor = now.astimezone(timezone.utc) if now is not None else datetime.now(timezone.utc)
    return f"{prefix}:{identifier}:{anchor.strftime('%Y-%m')}"


def increment_daily_usage(*, key: str, amount: int = 1) -> int:
    return _increment_with_fallback(key=key, amount=amount)


def increment_monthly_usage(*, key: str, amount: int = 1) -> int:
    return _increment_with_fallback(key=key, amount=amount, window_seconds=32 * 24 * 60 * 60)


def get_daily_usage(*, key: str) -> int:
    try:
        redis = get_redis()
        value = redis.get(key)
        return int(value) if value is not None else 0
    except RedisError:
        return _fallback_counts.get(key, 0)


def get_monthly_usage(*, key: str) -> int:
    try:
        redis = get_redis()
        value = redis.get(key)
        return int(value) if value is not None else 0
    except RedisError:
        return _fallback_counts.get(key, 0)
