from __future__ import annotations

from fastapi import HTTPException, status

from app.core.settings import get_settings
from app.notifications.providers.base import InviteDeliveryMessage
from app.notifications.providers.gmail import send_invitation_via_gmail
from app.notifications.providers.resend import send_invitation_via_resend


def _message_from_payload(payload: dict) -> InviteDeliveryMessage:
    invitation = payload.get("invitation")
    if not isinstance(invitation, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_payload")

    invited_email = invitation.get("invited_email")
    organization_name = invitation.get("organization_name")
    role = invitation.get("role")
    join_path = invitation.get("join_path")
    invited_by_email = invitation.get("invited_by_email")
    if not all(isinstance(v, str) and v.strip() for v in [invited_email, organization_name, role, join_path]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_payload")
    if invited_by_email is not None and not isinstance(invited_by_email, str):
        invited_by_email = None

    settings = get_settings()
    join_url = join_path if join_path.startswith("http://") or join_path.startswith("https://") else f"{settings.canonical_dashboard_url}{join_path}"
    return InviteDeliveryMessage(
        invited_email=invited_email.strip(),
        organization_name=organization_name.strip(),
        role=role.strip(),
        join_url=join_url,
        invited_by_email=(invited_by_email.strip() if invited_by_email else None),
    )


def dispatch_invitation(payload: dict) -> dict[str, object]:
    settings = get_settings()
    provider = (settings.invite_email_provider or "resend").strip().lower()
    message = _message_from_payload(payload)

    if provider == "resend":
        return send_invitation_via_resend(message)
    if provider == "gmail":
        return send_invitation_via_gmail(message)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unsupported_invite_email_provider")

