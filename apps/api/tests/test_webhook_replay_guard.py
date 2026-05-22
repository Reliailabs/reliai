from app.security.webhook_replay_guard import ReplayGuard


def test_replay_guard_rejects_duplicate_within_ttl():
    guard = ReplayGuard()
    assert guard.register(key="abc", ttl_seconds=10, now_seconds=100) is True
    assert guard.register(key="abc", ttl_seconds=10, now_seconds=101) is False


def test_replay_guard_allows_after_ttl_expiry():
    guard = ReplayGuard()
    assert guard.register(key="abc", ttl_seconds=5, now_seconds=100) is True
    assert guard.register(key="abc", ttl_seconds=5, now_seconds=106) is True
