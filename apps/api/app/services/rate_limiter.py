from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.db.session import get_redis


def _bucket_expiry(seconds: int) -> int:
    return max(seconds, 1)


def enforce_rate_limit(*, scope: str, key: str, limit: int, window_seconds: int) -> int:
    if limit <= 0:
        return 0
    redis = get_redis()
    bucket_key = f"rate_limit:{scope}:{key}"
    current = int(redis.incr(bucket_key))
    if current == 1:
        redis.expire(bucket_key, _bucket_expiry(window_seconds))
    if current > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {scope}",
        )
    return current


def day_bucket_key(*, prefix: str, identifier: str, now: datetime | None = None) -> str:
    anchor = now.astimezone(timezone.utc) if now is not None else datetime.now(timezone.utc)
    return f"{prefix}:{identifier}:{anchor.date().isoformat()}"


def increment_daily_usage(*, key: str, amount: int = 1) -> int:
    redis = get_redis()
    value = int(redis.incrby(key, amount))
    if value == amount:
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
        expires = datetime.fromisoformat(f"{tomorrow}T00:00:00+00:00")
        seconds = int((expires - datetime.now(timezone.utc)).total_seconds())
        redis.expire(key, _bucket_expiry(seconds))
    return value
