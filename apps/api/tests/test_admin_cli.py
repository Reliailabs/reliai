import pytest
from sqlalchemy import select

from app.cli.__main__ import main as cli_main
from app.models.audit_event import AuditEvent
from app.models.operator_user import OperatorUser
from apps.api.tests.conftest import BorrowedSession
from apps.api.tests.test_api import create_operator


def _patch_session(monkeypatch, db_session):
    monkeypatch.setattr("app.cli.admin.SessionLocal", lambda: BorrowedSession(db_session))


def _run_cli(args, monkeypatch, db_session, *, enable=True, user="tester"):
    if enable:
        monkeypatch.setenv("RELIAI_ADMIN_CLI_ENABLED", "true")
    else:
        monkeypatch.delenv("RELIAI_ADMIN_CLI_ENABLED", raising=False)
    if user is not None:
        monkeypatch.setenv("USER", user)
    _patch_session(monkeypatch, db_session)
    cli_main(args)


def test_grant_requires_confirm(db_session, monkeypatch, capsys):
    operator = create_operator(db_session, email="owner@acme.test")
    with pytest.raises(SystemExit) as exc:
        _run_cli(["admin", "grant", "--email", operator.email], monkeypatch, db_session)
    assert exc.value.code == 1
    assert "Refusing to grant admin without --confirm flag" in capsys.readouterr().err


def test_grant_dry_run_no_mutation(db_session, monkeypatch):
    operator = create_operator(db_session, email="owner@acme.test")
    _run_cli(
        ["admin", "grant", "--email", operator.email, "--confirm", "--dry-run"],
        monkeypatch,
        db_session,
    )
    refreshed = db_session.get(OperatorUser, operator.id)
    assert refreshed.is_system_admin is False


def test_grant_success(db_session, monkeypatch):
    operator = create_operator(db_session, email="owner@acme.test")
    _run_cli(
        ["admin", "grant", "--email", operator.email, "--confirm"],
        monkeypatch,
        db_session,
    )
    refreshed = db_session.get(OperatorUser, operator.id)
    assert refreshed.is_system_admin is True


def test_grant_already_admin(db_session, monkeypatch, capsys):
    operator = create_operator(db_session, email="owner@acme.test", is_system_admin=True)
    _run_cli(
        ["admin", "grant", "--email", operator.email, "--confirm"],
        monkeypatch,
        db_session,
    )
    assert "User is already system admin" in capsys.readouterr().out


def test_env_gate(db_session, monkeypatch, capsys):
    operator = create_operator(db_session, email="owner@acme.test")
    with pytest.raises(SystemExit) as exc:
        _run_cli(
            ["admin", "grant", "--email", operator.email, "--confirm"],
            monkeypatch,
            db_session,
            enable=False,
        )
    assert exc.value.code == 1
    assert "Admin CLI is disabled" in capsys.readouterr().err


def test_actor_tagging(db_session, monkeypatch):
    operator = create_operator(db_session, email="owner@acme.test")
    _run_cli(
        ["admin", "grant", "--email", operator.email, "--confirm"],
        monkeypatch,
        db_session,
        user="robert",
    )
    event = db_session.scalar(select(AuditEvent).order_by(AuditEvent.created_at.desc()))
    assert event is not None
    assert event.actor_label == "cli:robert"


def test_grant_reason_recorded(db_session, monkeypatch):
    operator = create_operator(db_session, email="owner@acme.test")
    _run_cli(
        [
            "admin",
            "grant",
            "--email",
            operator.email,
            "--confirm",
            "--reason",
            "on-call escalation",
        ],
        monkeypatch,
        db_session,
    )
    event = db_session.scalar(select(AuditEvent).order_by(AuditEvent.created_at.desc()))
    assert event is not None
    assert event.reason == "on-call escalation"
