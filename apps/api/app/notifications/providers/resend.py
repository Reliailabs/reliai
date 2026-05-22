from __future__ import annotations

import json
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from app.core.settings import get_settings
from app.notifications.providers.base import InviteDeliveryMessage


def send_invitation_via_resend(message: InviteDeliveryMessage) -> dict[str, object]:
    settings = get_settings()
    resend_api_key = (settings.resend_api_key or "").strip()
    from_email = (settings.invite_from_email or settings.resend_from_email or "").strip()
    if not resend_api_key or not from_email:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="invite_delivery_not_configured",
        )

    subject = f"{settings.resend_invite_subject_prefix}: {message.organization_name} ({message.role})"
    html = (
        "<p>You have been invited to join Reliai.</p>"
        f"<p><strong>Organization:</strong> {message.organization_name}<br/>"
        f"<strong>Role:</strong> {message.role}</p>"
        f"<p><a href=\"{message.join_url}\">Accept invitation</a></p>"
    )

    to_email = (settings.invite_to_email or "").strip() or message.invited_email
    resend_body = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    request = Request(
        f"{settings.resend_api_base.rstrip('/')}/emails",
        data=json.dumps(resend_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8") if hasattr(response, "read") else "{}"
            parsed = json.loads(body) if body else {}
            if not (200 <= getattr(response, "status", 200) < 300):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="resend_delivery_failed",
                )
            return {"accepted": True, "provider": "resend", "provider_id": parsed.get("id")}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="resend_delivery_failed",
        ) from exc

