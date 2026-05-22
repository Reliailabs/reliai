import json

from app.core.settings import get_settings
from app.notifications import invite_delivery_notify
from app.notifications.providers import resend as resend_provider


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


def test_invite_delivery_forwards_to_resend(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
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

    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token"},
        json=_payload(),
    )
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
    monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "unknown")
    get_settings.cache_clear()
    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token"},
        json=_payload(),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "unsupported_invite_email_provider"
    get_settings.cache_clear()


def test_invite_delivery_uses_gmail_provider_when_configured(client, monkeypatch):
    monkeypatch.setenv("INVITE_DELIVERY_WEBHOOK_BEARER_TOKEN", "secret-token")
    monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "gmail")
    get_settings.cache_clear()

    monkeypatch.setattr(
        invite_delivery_notify,
        "send_invitation_via_gmail",
        lambda _message: {"accepted": True, "provider": "gmail", "provider_id": "gmail_msg_123"},
    )

    response = client.post(
        "/reliai/invite-delivery",
        headers={"Authorization": "Bearer secret-token"},
        json=_payload(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["delivery"]["provider"] == "gmail"
    assert body["delivery"]["provider_id"] == "gmail_msg_123"
    get_settings.cache_clear()
