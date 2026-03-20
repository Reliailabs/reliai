from __future__ import annotations

# NOTE:
# Do not introduce fine-grained permissions yet.
# This system is intentionally role-based for simplicity and scalability.

ROLE_HIERARCHY = {
    "viewer": 1,
    "member": 2,
    "admin": 3,
    "owner": 4,
}


def normalize_role(role: str | None) -> str:
    normalized = (role or "viewer").strip().lower()
    if normalized in {"org_admin", "admin"}:
        return "admin"
    if normalized in {"engineer", "member"}:
        return "member"
    if normalized == "owner":
        return "owner"
    return "viewer"


def has_required_role(user_role: str | None, required_role: str) -> bool:
    return ROLE_HIERARCHY[normalize_role(user_role)] >= ROLE_HIERARCHY[normalize_role(required_role)]
