from __future__ import annotations

from datetime import datetime, timezone, timedelta
from threading import Lock

from fastapi import HTTPException, status
from redis.exceptions import RedisError

from app.db.session import get_redis

_fallback_counts: dict[str, int] = {}
_fallback_lock = Lock()
_fallback_limit_flags: dict[str, tuple[datetime, datetime]] = {}
_fallback_limit_lock = Lock()

_LIMIT_FLAG_PREFIX = "limit_exceeded"


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


def _limit_flag_key(scope: str, identifier: str) -> str:
    return f"{_LIMIT_FLAG_PREFIX}:{scope}:{identifier}"


def record_limit_exceeded(*, scope: str, identifier: str, window_seconds: int) -> datetime:
    now = datetime.now(timezone.utc)
    key = _limit_flag_key(scope, identifier)
    try:
        redis = get_redis()
        redis.setex(key, max(int(window_seconds), 1), now.isoformat().encode("utf-8"))
    except RedisError:
        with _fallback_limit_lock:
            expiry = now + timedelta(seconds=max(int(window_seconds), 1))
            _fallback_limit_flags[key] = (now, expiry)
    return now


def get_limit_exceeded_timestamp(*, scope: str, identifier: str) -> datetime | None:
    key = _limit_flag_key(scope, identifier)
    try:
        redis = get_redis()
        value = redis.get(key)
        if value is None:
            return None
        decoded = value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value)
        return datetime.fromisoformat(decoded)
    except RedisError:
        with _fallback_limit_lock:
            record = _fallback_limit_flags.get(key)
            if record is None:
                return None
            recorded_at, expiry = record
            if expiry < datetime.now(timezone.utc):
                _fallback_limit_flags.pop(key, None)
                return None
            return recorded_at


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
