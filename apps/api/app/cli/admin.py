from __future__ import annotations

import os
import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.audit_event import AuditEvent
from app.models.operator_user import OperatorUser
from app.models.user import User


def _ensure_enabled() -> None:
    if os.getenv("RELIAI_ADMIN_CLI_ENABLED", "").lower() != "true":
        print("Admin CLI is disabled", file=sys.stderr)
        sys.exit(1)


def _actor_label() -> str:
    return f"cli:{os.getenv('USER', 'unknown')}"


def _require_confirm(confirm: bool, *, message: str) -> None:
    if confirm:
        return
    print(message, file=sys.stderr)
    sys.exit(1)


def grant_system_admin(
    email: str,
    *,
    confirm: bool = False,
    dry_run: bool = False,
    reason: str | None = None,
) -> None:
    _ensure_enabled()
    _require_confirm(confirm, message="Refusing to grant admin without --confirm flag")
    db = SessionLocal()
    try:
        operator = db.scalar(select(OperatorUser).where(OperatorUser.email == email))
        if operator is None:
            print("Operator not found", file=sys.stderr)
            sys.exit(1)
        if operator.is_system_admin:
            print("User is already system admin")
            return
        user = db.scalar(select(User).where(User.legacy_operator_user_id == operator.id))
        if dry_run:
            print(f"Would grant system admin to {email}")
            return
        operator.is_system_admin = True
        db.add(operator)
        if user is not None and not user.is_system_admin:
            user.is_system_admin = True
            db.add(user)
        db.add(
            AuditEvent(
                action="grant_system_admin",
                actor_type="cli",
                actor_label=_actor_label(),
                target_type="user",
                target_id=user.id if user is not None else None,
                target_label=email,
                organization_id=user.active_organization_id if user is not None else None,
                metadata_json={"source": "cli"},
                reason=reason,
            )
        )
        db.commit()
        print(f"Granted system admin to {email}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def revoke_system_admin(
    email: str,
    *,
    confirm: bool = False,
    dry_run: bool = False,
    reason: str | None = None,
) -> None:
    _ensure_enabled()
    _require_confirm(confirm, message="Refusing to revoke admin without --confirm flag")
    db = SessionLocal()
    try:
        operator = db.scalar(select(OperatorUser).where(OperatorUser.email == email))
        if operator is None:
            print("Operator not found", file=sys.stderr)
            sys.exit(1)
        if not operator.is_system_admin:
            print("User is not system admin")
            return
        user = db.scalar(select(User).where(User.legacy_operator_user_id == operator.id))
        if dry_run:
            print(f"Would revoke system admin from {email}")
            return
        operator.is_system_admin = False
        db.add(operator)
        if user is not None and user.is_system_admin:
            user.is_system_admin = False
            db.add(user)
        db.add(
            AuditEvent(
                action="revoke_system_admin",
                actor_type="cli",
                actor_label=_actor_label(),
                target_type="user",
                target_id=user.id if user is not None else None,
                target_label=email,
                organization_id=user.active_organization_id if user is not None else None,
                metadata_json={"source": "cli"},
                reason=reason,
            )
        )
        db.commit()
        print(f"Revoked system admin from {email}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
