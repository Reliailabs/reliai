from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class InviteDeliveryMessage:
    invited_email: str
    organization_name: str
    role: str
    join_url: str
    invited_by_email: str | None

