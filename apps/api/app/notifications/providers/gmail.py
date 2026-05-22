from __future__ import annotations

import base64
import json
from email.message import EmailMessage
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import jwt
from fastapi import HTTPException, status

from app.core.settings import get_settings
from app.notifications.providers.base import InviteDeliveryMessage


def _exchange_service_account_token(*, client_email: str, private_key: str, delegated_user: str) -> str:
    now = int(__import__("time").time())
    payload = {
        "iss": client_email,
        "sub": delegated_user,
        "scope": "https://www.googleapis.com/auth/gmail.send",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    assertion = jwt.encode(payload, private_key, algorithm="RS256")
    body = urlencode(
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        }
    ).encode("utf-8")
    request = Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        parsed = json.loads(response.read().decode("utf-8"))
        token = parsed.get("access_token")
        if not isinstance(token, str) or not token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="gmail_token_exchange_failed")
        return token


def send_invitation_via_gmail(message: InviteDeliveryMessage) -> dict[str, object]:
    settings = get_settings()
    client_email = (settings.gmail_client_email or "").strip()
    private_key = (settings.gmail_private_key or "").strip().replace("\\n", "\n")
    delegated_user = (settings.gmail_delegated_user or "").strip()
    from_email = (settings.invite_from_email or delegated_user).strip()
    if not client_email or not private_key or not delegated_user or not from_email:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="invite_delivery_not_configured")

    to_email = (settings.invite_to_email or "").strip() or message.invited_email
    subject = f"Reliai invitation: {message.organization_name} ({message.role})"
    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(
        "You have been invited to join Reliai.\n\n"
        f"Organization: {message.organization_name}\n"
        f"Role: {message.role}\n"
        f"Accept invitation: {message.join_url}\n"
    )

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8").rstrip("=")
    access_token = _exchange_service_account_token(
        client_email=client_email,
        private_key=private_key,
        delegated_user=delegated_user,
    )
    request = Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        data=json.dumps({"raw": raw}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8") if hasattr(response, "read") else "{}"
            parsed = json.loads(body) if body else {}
            if not (200 <= getattr(response, "status", 200) < 300):
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="gmail_delivery_failed")
            return {"accepted": True, "provider": "gmail", "provider_id": parsed.get("id")}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="gmail_delivery_failed") from exc

