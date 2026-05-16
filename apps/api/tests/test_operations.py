"""Phase 11.4 — Operations Center read-path tests.

Covers:
    GET /api/v1/operations/timeline
    GET /api/v1/operations/lifecycles

Test matrix:
    - Unauthenticated requests return 401
    - Empty org returns items=[] total=0
    - Rows in DB are returned in the response
    - Tenant isolation: org-A operator cannot see org-B rows
    - Filter by kind / incident_id / proposal_id / state
    - state_history is included and ordered ascending by transitioned_at
    - limit parameter is respected
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.models.lifecycle_transition_history import LifecycleTransitionHistory
from app.models.operations_timeline_event import OperationsTimelineEvent
from app.models.proposal_lifecycle_record import ProposalLifecycleRecord
from .test_api import (
    auth_headers,
    create_operator,
    create_organization,
    sign_in,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _org_uuid(organization_id) -> UUID:
    """Coerce string or UUID to UUID — API responses return strings."""
    return UUID(str(organization_id)) if not isinstance(organization_id, UUID) else organization_id


def _make_event(
    db_session,
    *,
    organization_id,
    entry_id: str = "",
    kind: str = "incident_detected",
    occurred_at: datetime | None = None,
    incident_id: str | None = None,
    proposal_id: str | None = None,
    lifecycle_id: str | None = None,
    severity: str | None = None,
    lifecycle_state: str | None = None,
    actor_type: str = "system",
    policy_gate_result: str | None = None,
) -> OperationsTimelineEvent:
    eid = entry_id or f"otl-{uuid4().hex[:16]}"
    event = OperationsTimelineEvent(
        entry_id=eid,
        kind=kind,
        occurred_at=occurred_at or datetime.now(timezone.utc),
        organization_id=_org_uuid(organization_id),
        project_id=None,
        lifecycle_id=lifecycle_id,
        proposal_id=proposal_id,
        incident_id=incident_id,
        severity=severity,
        lifecycle_state=lifecycle_state,
        actor_type=actor_type,
        actor_label="Reliai System",
        title=f"Test event: {kind}",
        summary="Test summary.",
        policy_gate_result=policy_gate_result,
        evidence_refs=[],
        requires_operator_review=True,
        idempotency_key=eid,
    )
    db_session.add(event)
    db_session.flush()
    return event


def _make_lifecycle(
    db_session,
    *,
    organization_id,
    state: str = "detected",
    lifecycle_id: str = "",
    proposal_id: str = "",
) -> ProposalLifecycleRecord:
    lid = lifecycle_id or f"lifecycle-{uuid4().hex[:16]}"
    pid = proposal_id or f"phase9-inc-{uuid4().hex[:16]}"
    record = ProposalLifecycleRecord(
        lifecycle_id=lid,
        proposal_id=pid,
        action_type="ack",
        target_type="incident",
        target_id="inc-001",
        organization_id=_org_uuid(organization_id),
        project_id=None,
        state=state,
        execution_granted=False,
        requires_operator_review=True,
        operator_email=None,
        verification_result_id=None,
        audit_receipt_id=None,
        failure_reason=None,
        expires_at=datetime(2099, 12, 31, tzinfo=timezone.utc),
        updated_at=datetime.now(timezone.utc),
        idempotency_key=lid,
    )
    db_session.add(record)
    db_session.flush()
    return record


def _make_transition(
    db_session,
    *,
    lifecycle_id: str,
    organization_id,
    from_state: str,
    to_state: str,
    transitioned_at: datetime | None = None,
    reason: str | None = None,
) -> LifecycleTransitionHistory:
    ikey = f"{lifecycle_id}:{from_state}:{to_state}"
    h = LifecycleTransitionHistory(
        lifecycle_id=lifecycle_id,
        organization_id=_org_uuid(organization_id),
        from_state=from_state,
        to_state=to_state,
        transitioned_at=transitioned_at or datetime.now(timezone.utc),
        reason=reason,
        idempotency_key=ikey,
    )
    db_session.add(h)
    db_session.flush()
    return h


def _setup_org(client, db_session, *, email: str, org_name: str, org_slug: str):
    """Create an operator, sign in, create an org; return (session, org_id)."""
    create_operator(db_session, email=email)
    session = sign_in(client, email=email)
    org = create_organization(
        client, session, name=org_name, slug=org_slug
    )
    return session, org["id"]


# ── Timeline: auth + empty ────────────────────────────────────────────────────


def test_timeline_unauthenticated_returns_401(client):
    response = client.get("/api/v1/operations/timeline")
    assert response.status_code == 401


def test_timeline_empty_org_returns_empty(client, db_session):
    session, _ = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    response = client.get(
        "/api/v1/operations/timeline", headers=auth_headers(session)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


# ── Timeline: basic read ──────────────────────────────────────────────────────


def test_timeline_returns_rows_for_org(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_event(db_session, organization_id=org_id, kind="incident_detected")
    _make_event(db_session, organization_id=org_id, kind="approval_recorded")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/timeline", headers=auth_headers(session)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    kinds = {item["kind"] for item in body["items"]}
    assert kinds == {"incident_detected", "approval_recorded"}


def test_timeline_items_have_required_fields(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_event(
        db_session,
        organization_id=org_id,
        kind="policy_gate_evaluated",
        incident_id="inc-001",
        policy_gate_result="passed",
    )
    db_session.commit()

    response = client.get(
        "/api/v1/operations/timeline", headers=auth_headers(session)
    )
    item = response.json()["items"][0]
    assert "entry_id" in item
    assert "kind" in item
    assert "occurred_at" in item
    assert "organization_id" in item
    assert item["requires_operator_review"] is True
    assert item["policy_gate_result"] == "passed"
    assert item["incident_id"] == "inc-001"


# ── Timeline: tenant isolation ────────────────────────────────────────────────


def test_timeline_tenant_isolation(client, db_session):
    """Org-A operator must not see org-B events."""
    session_a, org_a_id = _setup_org(
        client, db_session, email="alice@alpha.test", org_name="Alpha", org_slug="alpha"
    )
    session_b, org_b_id = _setup_org(
        client, db_session, email="bob@beta.test", org_name="Beta", org_slug="beta"
    )

    _make_event(db_session, organization_id=org_a_id, kind="incident_detected")
    _make_event(db_session, organization_id=org_b_id, kind="approval_recorded")
    db_session.commit()

    response_a = client.get(
        "/api/v1/operations/timeline", headers=auth_headers(session_a)
    )
    response_b = client.get(
        "/api/v1/operations/timeline", headers=auth_headers(session_b)
    )

    items_a = response_a.json()["items"]
    items_b = response_b.json()["items"]

    assert len(items_a) == 1
    assert items_a[0]["kind"] == "incident_detected"

    assert len(items_b) == 1
    assert items_b[0]["kind"] == "approval_recorded"


# ── Timeline: filters ─────────────────────────────────────────────────────────


def test_timeline_filter_by_kind(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_event(db_session, organization_id=org_id, kind="incident_detected")
    _make_event(db_session, organization_id=org_id, kind="approval_recorded")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/timeline",
        headers=auth_headers(session),
        params={"kind": "approval_recorded"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["kind"] == "approval_recorded"


def test_timeline_filter_by_incident_id(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_event(db_session, organization_id=org_id, incident_id="inc-001")
    _make_event(db_session, organization_id=org_id, incident_id="inc-002")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/timeline",
        headers=auth_headers(session),
        params={"incident_id": "inc-001"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["incident_id"] == "inc-001"


def test_timeline_filter_by_proposal_id(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_event(db_session, organization_id=org_id, proposal_id="phase9-inc-aaa")
    _make_event(db_session, organization_id=org_id, proposal_id="phase9-inc-bbb")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/timeline",
        headers=auth_headers(session),
        params={"proposal_id": "phase9-inc-aaa"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["proposal_id"] == "phase9-inc-aaa"


def test_timeline_limit_is_respected(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    for _ in range(5):
        _make_event(db_session, organization_id=org_id)
    db_session.commit()

    response = client.get(
        "/api/v1/operations/timeline",
        headers=auth_headers(session),
        params={"limit": 3},
    )
    body = response.json()
    assert body["total"] == 5  # total reflects full result set
    assert len(body["items"]) == 3


# ── Lifecycles: auth + empty ──────────────────────────────────────────────────


def test_lifecycles_unauthenticated_returns_401(client):
    response = client.get("/api/v1/operations/lifecycles")
    assert response.status_code == 401


def test_lifecycles_empty_org_returns_empty(client, db_session):
    session, _ = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    response = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


# ── Lifecycles: basic read ────────────────────────────────────────────────────


def test_lifecycles_returns_rows_for_org(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_lifecycle(db_session, organization_id=org_id, state="detected")
    _make_lifecycle(db_session, organization_id=org_id, state="approved")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session)
    )
    body = response.json()
    assert body["total"] == 2
    states = {item["state"] for item in body["items"]}
    assert states == {"detected", "approved"}


def test_lifecycles_invariants_enforced_in_response(client, db_session):
    """execution_granted must always be false; requires_operator_review must always be true."""
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_lifecycle(db_session, organization_id=org_id)
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session)
    )
    item = response.json()["items"][0]
    assert item["execution_granted"] is False
    assert item["requires_operator_review"] is True


def test_lifecycles_state_history_is_included(client, db_session):
    """state_history from lifecycle_transition_history is inlined and ordered."""
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    lc = _make_lifecycle(
        db_session,
        organization_id=org_id,
        state="approved",
        lifecycle_id="lifecycle-testhistory01",
    )
    _make_transition(
        db_session,
        lifecycle_id=lc.lifecycle_id,
        organization_id=org_id,
        from_state="detected",
        to_state="analyzed",
        transitioned_at=datetime(2026, 5, 12, 9, 0, tzinfo=timezone.utc),
    )
    _make_transition(
        db_session,
        lifecycle_id=lc.lifecycle_id,
        organization_id=org_id,
        from_state="analyzed",
        to_state="approved",
        transitioned_at=datetime(2026, 5, 12, 10, 0, tzinfo=timezone.utc),
        reason="Threshold met.",
    )
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session)
    )
    item = response.json()["items"][0]
    history = item["state_history"]
    assert len(history) == 2
    assert history[0]["from_state"] == "detected"
    assert history[0]["to_state"] == "analyzed"
    assert history[1]["from_state"] == "analyzed"
    assert history[1]["to_state"] == "approved"
    assert history[1]["reason"] == "Threshold met."


def test_lifecycles_state_history_empty_when_none(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_lifecycle(db_session, organization_id=org_id)
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session)
    )
    assert response.json()["items"][0]["state_history"] == []


# ── Lifecycles: tenant isolation ──────────────────────────────────────────────


def test_lifecycles_tenant_isolation(client, db_session):
    """Org-A operator must not see org-B lifecycle records."""
    session_a, org_a_id = _setup_org(
        client, db_session, email="alice@alpha.test", org_name="Alpha", org_slug="alpha"
    )
    session_b, org_b_id = _setup_org(
        client, db_session, email="bob@beta.test", org_name="Beta", org_slug="beta"
    )

    _make_lifecycle(db_session, organization_id=org_a_id, state="detected")
    _make_lifecycle(db_session, organization_id=org_b_id, state="approved")
    db_session.commit()

    items_a = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session_a)
    ).json()["items"]
    items_b = client.get(
        "/api/v1/operations/lifecycles", headers=auth_headers(session_b)
    ).json()["items"]

    assert len(items_a) == 1 and items_a[0]["state"] == "detected"
    assert len(items_b) == 1 and items_b[0]["state"] == "approved"


# ── Lifecycles: filters ───────────────────────────────────────────────────────


def test_lifecycles_filter_by_state(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_lifecycle(db_session, organization_id=org_id, state="detected")
    _make_lifecycle(db_session, organization_id=org_id, state="approved")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles",
        headers=auth_headers(session),
        params={"state": "approved"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["state"] == "approved"


def test_lifecycles_filter_by_proposal_id(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    _make_lifecycle(db_session, organization_id=org_id, proposal_id="phase9-inc-target")
    _make_lifecycle(db_session, organization_id=org_id, proposal_id="phase9-inc-other")
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles",
        headers=auth_headers(session),
        params={"proposal_id": "phase9-inc-target"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["proposal_id"] == "phase9-inc-target"


def test_lifecycles_limit_is_respected(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    for _ in range(4):
        _make_lifecycle(db_session, organization_id=org_id)
    db_session.commit()

    response = client.get(
        "/api/v1/operations/lifecycles",
        headers=auth_headers(session),
        params={"limit": 2},
    )
    body = response.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2


def test_lifecycle_by_id_unauthenticated_returns_401(client):
    response = client.get("/api/v1/operations/lifecycles/lifecycle-missing")
    assert response.status_code == 401


def test_lifecycle_by_id_returns_record_with_state_history(client, db_session):
    session, org_id = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )
    lc = _make_lifecycle(
        db_session,
        organization_id=org_id,
        state="approved",
        lifecycle_id="lifecycle-by-id-01",
    )
    _make_transition(
        db_session,
        lifecycle_id=lc.lifecycle_id,
        organization_id=org_id,
        from_state="detected",
        to_state="analyzed",
        transitioned_at=datetime(2026, 5, 12, 9, 0, tzinfo=timezone.utc),
    )
    _make_transition(
        db_session,
        lifecycle_id=lc.lifecycle_id,
        organization_id=org_id,
        from_state="analyzed",
        to_state="approved",
        transitioned_at=datetime(2026, 5, 12, 10, 0, tzinfo=timezone.utc),
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/operations/lifecycles/{lc.lifecycle_id}",
        headers=auth_headers(session),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["lifecycle_id"] == lc.lifecycle_id
    assert body["execution_granted"] is False
    assert body["requires_operator_review"] is True
    assert [h["to_state"] for h in body["state_history"]] == ["analyzed", "approved"]


def test_lifecycle_by_id_not_found_returns_404(client, db_session):
    session, _ = _setup_org(
        client, db_session, email="ops@acme.test", org_name="Acme", org_slug="acme"
    )

    response = client.get(
        "/api/v1/operations/lifecycles/lifecycle-does-not-exist",
        headers=auth_headers(session),
    )
    assert response.status_code == 404


def test_lifecycle_by_id_tenant_isolated_returns_404_for_other_org(client, db_session):
    _session_a, org_a_id = _setup_org(
        client, db_session, email="alice@alpha.test", org_name="Alpha", org_slug="alpha"
    )
    session_b, _org_b_id = _setup_org(
        client, db_session, email="bob@beta.test", org_name="Beta", org_slug="beta"
    )
    lc = _make_lifecycle(
        db_session,
        organization_id=org_a_id,
        lifecycle_id="lifecycle-org-a-only",
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/operations/lifecycles/{lc.lifecycle_id}",
        headers=auth_headers(session_b),
    )
    assert response.status_code == 404
