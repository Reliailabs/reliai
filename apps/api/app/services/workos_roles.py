from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.services.rbac import has_required_role, normalize_role

ORG_ROLE_VIEWER = "viewer"
ORG_ROLE_MEMBER = "member"
ORG_ROLE_ADMIN = "admin"
ORG_ROLE_OWNER = "owner"
ORG_ROLE_ENGINEER = "member"
PROJECT_ROLE_VIEWER = "viewer"
PROJECT_ROLE_ENGINEER = "engineer"

GROUP_ROLE_MAP = {
    "Reliai-Admins": ORG_ROLE_ADMIN,
    "Reliai-Engineers": ORG_ROLE_MEMBER,
    "Reliai-Viewers": ORG_ROLE_VIEWER,
}

# Future extensions: custom roles, permission-level RBAC, org-level policy enforcement, SSO/SCIM mapping.
ORG_ROLE_RANK = {
    ORG_ROLE_VIEWER: 1,
    ORG_ROLE_MEMBER: 2,
    ORG_ROLE_ADMIN: 3,
    ORG_ROLE_OWNER: 4,
}

PROJECT_ROLE_RANK = {
    PROJECT_ROLE_VIEWER: 1,
    PROJECT_ROLE_ENGINEER: 2,
}


def normalize_org_role(role: str | None) -> str:
    return normalize_role(role)


def normalize_project_role(role: str | None) -> str:
    normalized = (role or PROJECT_ROLE_VIEWER).strip().lower()
    if normalized in {"owner", "admin", "member", PROJECT_ROLE_ENGINEER, ORG_ROLE_ADMIN, ORG_ROLE_ENGINEER}:
        return PROJECT_ROLE_ENGINEER
    return PROJECT_ROLE_VIEWER


def org_role_meets_requirement(actual_role: str | None, required_role: str) -> bool:
    return has_required_role(actual_role, required_role)


def project_role_meets_requirement(actual_role: str | None, required_role: str) -> bool:
    return PROJECT_ROLE_RANK[normalize_project_role(actual_role)] >= PROJECT_ROLE_RANK[
        normalize_project_role(required_role)
    ]


def map_groups_to_roles(groups: list[str] | tuple[str, ...] | None) -> list[str]:
    mapped = [GROUP_ROLE_MAP[group] for group in groups or [] if group in GROUP_ROLE_MAP]
    deduped: list[str] = []
    for role in mapped:
        if role not in deduped:
            deduped.append(role)
    return deduped


def highest_mapped_org_role(groups: list[str] | tuple[str, ...] | None) -> str | None:
    mapped = map_groups_to_roles(groups)
    if not mapped:
        return None
    return max(mapped, key=lambda role: ORG_ROLE_RANK[normalize_org_role(role)])


def _coerce_uuid_set(value) -> set[UUID]:
    if not isinstance(value, (list, tuple, set)):
        return set()
    result: set[UUID] = set()
    for item in value:
        try:
            result.add(UUID(str(item)))
        except (TypeError, ValueError):
            continue
    return result


def apply_workos_group_roles(
    db: Session,
    *,
    user: User,
    claims: dict,
    memberships: list[OrganizationMember],
) -> list[OrganizationMember]:
    role = highest_mapped_org_role(claims.get("groups"))
    if role is None or not memberships:
        return memberships

    target_org_ids = (
        _coerce_uuid_set(claims.get("organization_ids"))
        or _coerce_uuid_set(claims.get("org_ids"))
        or _coerce_uuid_set(claims.get("organizations"))
    )

    updated = False
    if target_org_ids:
        for membership in memberships:
            if membership.organization_id in target_org_ids:
                membership.role = normalize_org_role(role)
                db.add(membership)
                updated = True
    elif len(memberships) == 1:
        memberships[0].role = normalize_org_role(role)
        db.add(memberships[0])
        updated = True

    if updated:
        db.flush()
    return memberships
