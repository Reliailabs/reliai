import json
import time

import pytest

from app.core.settings import get_settings
from app.notifications import invite_delivery_notify
from app.notifications.providers import resend as resend_provider
from app.security.webhook_replay_guard import invite_delivery_replay_guard
from app.security.webhook_signing import sign_webhook_payload


def _payload() -> dict:
    return {
        "event": "organization_invitation.created",
        "invitation": {
            "id": "inv_123",
            "organization_id": "org_123",
            "organization_name": "Acme AI",
            "invited_email": "invitee@acme.test",
            "role": "member",
            "invited_by_email": "owner@acme.test",
            "signup_path": "/signup?entry=team-invite&email=invitee%40acme.test",
            "join_path": "/join?token=abc123",
            "expires_at": "2026-05-30T00:00:00Z",
            "created_at": "2026-05-23T00:00:00Z",
        },
    }


@pytest.fixture(autouse=True)
def _clear_replay_guard():
    invite_delivery_replay_guard._entries.clear()
    yield
    invite_delivery_replay_guard._entries.clear()


def _signed_headers(payload: dict, *, secret: str, timestamp: int | None = None) -> tuple[dict[str, str], bytes]:
    ts = int(time.time()) if timestamp is None else timestamp
    body = json.dumps(payload).encode("utf-8")
    sig = sign_webhook_payload(secret=secret, timestamp=ts, body=body)
    headers = {
        "X-Reliai-Signature-Version": "v1",
        "X-Reliai-Timestamp": str(ts),
        "X-Reliai-Signature": sig,
        "Content-Type": "application/json",
    }
    return headers, body


def test_invite_delivery_requires_bearer_token_config(client):
    get_settings.cache_clear()
    response = client.post("/reliai/invite-delivery", json=_payload())
    assert response.status_code == 503
    assert response.json()["detail"] == "invite_delivery_webhook_not_configured"


def test_invite_delivery_rejects_invalid_auth(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    get_settings.cache_clear()
    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer wrong-token"},
        json=_payload(),
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "unauthorized"
    get_settings.cache_clear()


def test_invite_delivery_rejects_non_json_content_type(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    get_settings.cache_clear()
    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token", "Content-Type": "text/plain"},
        content="not-json",
    )
    assert response.status_code == 415
    assert response.json()["detail"] == "unsupported_media_type"
    get_settings.cache_clear()


def test_invite_delivery_rejects_oversized_payload(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    get_settings.cache_clear()
    big_body = b"{" + b"\"x\":\"" + (b"a" * (64 * 1024)) + b"\"}"
    headers = {
        "Authorization": "Bearer secret-token",
        "Content-Type": "application/json",
        "X-Reliai-Signature-Version": "v1",
        "X-Reliai-Timestamp": str(int(time.time())),
        "X-Reliai-Signature": "bad",
    }
    response = client.post("/reliai/invite-delivery", headers=headers, content=big_body)
    assert response.status_code == 413
    assert response.json()["detail"] == "payload_too_large"
    get_settings.cache_clear()


def test_invite_delivery_rejects_missing_signature_when_configured(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    get_settings.cache_clear()
    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token"},
        json=_payload(),
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "missing_signature"
    get_settings.cache_clear()


def test_invite_delivery_rejects_unsupported_signature_version(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    get_settings.cache_clear()
    payload = _payload()
    signed_headers, body = _signed_headers(payload, secret="signing-secret")
    signed_headers["X-Reliai-Signature-Version"] = "v2"
    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token", **signed_headers},
        content=body,
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "unsupported_signature_version"
    get_settings.cache_clear()


def test_invite_delivery_rejects_invalid_signature_when_configured(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    get_settings.cache_clear()
    headers = {
        "Authorization": "Bearer secret-token",
        "X-Reliai-Signature-Version": "v1",
        "X-Reliai-Timestamp": str(int(time.time())),
        "X-Reliai-Signature": "bad",
        "Content-Type": "application/json",
    }
    response = client.post("/reliai/invite-delivery", headers=headers, json=_payload())
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_signature"
    get_settings.cache_clear()


def test_invite_delivery_rejects_invalid_json(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    get_settings.cache_clear()
    raw = b"{not-valid-json"
    ts = int(time.time())
    sig = sign_webhook_payload(secret="signing-secret", timestamp=ts, body=raw)
    headers = {
        "Authorization": "Bearer secret-token",
        "Content-Type": "application/json",
        "X-Reliai-Signature-Version": "v1",
        "X-Reliai-Timestamp": str(ts),
        "X-Reliai-Signature": sig,
    }
    response = client.post("/reliai/invite-delivery", headers=headers, content=raw)
    assert response.status_code == 400
    assert response.json()["detail"] == "invalid_payload"
    get_settings.cache_clear()


def test_invite_delivery_rejects_stale_signature(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNATURE_MAX_AGE_SECONDS", "10")
    get_settings.cache_clear()
    payload = _payload()
    stale_timestamp = int(time.time()) - 30
    signed_headers, body = _signed_headers(payload, secret="signing-secret", timestamp=stale_timestamp)
    headers = {"Authorization": "Bearer secret-token", **signed_headers}
    response = client.post("/reliai/invite-delivery", headers=headers, content=body)
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_signature"
    get_settings.cache_clear()


def test_invite_delivery_rejects_replayed_signed_request(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "gmail")
    get_settings.cache_clear()
    invite_delivery_replay_guard._entries.clear()

    monkeypatch.setattr(
        invite_delivery_notify,
        "send_invitation_via_gmail",
        lambda _message: {"accepted": True, "provider": "gmail", "provider_id": "gmail_msg_123"},
    )

    payload = _payload()
    signed_headers, body = _signed_headers(payload, secret="signing-secret", timestamp=int(time.time()))
    headers = {"Authorization": "Bearer secret-token", **signed_headers}
    first = client.post("/reliai/invite-delivery", headers=headers, content=body)
    second = client.post("/reliai/invite-delivery", headers=headers, content=body)
    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "replay_detected"
    get_settings.cache_clear()


def test_invite_delivery_forwards_to_resend(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    monkeypatch.setenv("RESEND_API_KEY", "resend_test_key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "invites@reliai.dev")
    monkeypatch.setenv("CANONICAL_DASHBOARD_URL", "https://app.reliai.dev")
    get_settings.cache_clear()

    seen = {}

    class _Response:
        status = 202

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return b'{"id":"email_123"}'

    def _fake_urlopen(req, timeout=10):
        seen["url"] = req.full_url
        seen["headers"] = dict(req.header_items())
        seen["body"] = json.loads(req.data.decode("utf-8"))
        seen["timeout"] = timeout
        return _Response()

    monkeypatch.setattr(resend_provider, "urlopen", _fake_urlopen)

    payload = _payload()
    signed_headers, body = _signed_headers(payload, secret="signing-secret")
    response = client.post("/reliai/invite-delivery", headers={"Authorization": "Bearer secret-token", **signed_headers}, content=body)
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["delivery"]["accepted"] is True
    assert payload["delivery"]["provider"] == "resend"
    assert payload["delivery"]["provider_id"] == "email_123"

    assert seen["url"] == "https://api.resend.com/emails"
    assert seen["headers"]["Authorization"] == "Bearer resend_test_key"
    assert seen["body"]["from"] == "invites@reliai.dev"
    assert seen["body"]["to"] == ["invitee@acme.test"]
    assert seen["body"]["subject"].startswith("Reliai invitation:")
    assert "https://app.reliai.dev/join?token=abc123" in seen["body"]["html"]
    get_settings.cache_clear()


def test_invite_delivery_rejects_unknown_provider(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "unknown")
    get_settings.cache_clear()
    payload = _payload()
    signed_headers, body = _signed_headers(payload, secret="signing-secret")
    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token", **signed_headers},
        content=body,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "unsupported_invite_email_provider"
    get_settings.cache_clear()


def test_invite_delivery_uses_gmail_provider_when_configured(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_SIGNING_SECRET", "signing-secret")
    monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "gmail")
    get_settings.cache_clear()

    monkeypatch.setattr(
        invite_delivery_notify,
        "send_invitation_via_gmail",
        lambda _message: {"accepted": True, "provider": "gmail", "provider_id": "gmail_msg_123"},
    )

    payload = _payload()
    signed_headers, body = _signed_headers(payload, secret="signing-secret")
    response = client.post("/reliai/invite-delivery", headers={"Authorization": "Bearer secret-token", **signed_headers}, content=body)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["delivery"]["provider"] == "gmail"
    assert body["delivery"]["provider_id"] == "gmail_msg_123"
    get_settings.cache_clear()
