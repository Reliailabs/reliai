from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import inspect, select

from app.models.environment import Environment
from app.models.incident import Incident
from app.models.project_audit_summary import ProjectAuditSummary
from app.models.audit_artifact import AuditArtifact
from app.models.audit_stage import AuditStage
from app.models.audit_run import AuditRun
from app.services.auth import create_operator_user


def create_operator(
    db_session,
    *,
    email: str,
    password: str = "reliai-test-password",
    is_system_admin: bool = False,
):
    operator = create_operator_user(
        db_session,
        email=email,
        password=password,
        is_system_admin=is_system_admin,
    )
    db_session.commit()
    db_session.refresh(operator)
    return operator


def sign_in(client, *, email: str, password: str = "reliai-test-password") -> dict:
    response = client.post(
        "/api/v1/auth/sign-in",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def auth_headers(session_payload: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session_payload['session_token']}"}


def create_organization(client, session_payload: dict, *, name: str, slug: str) -> dict:
    response = client.post(
        "/api/v1/organizations",
        headers=auth_headers(session_payload),
        json={
            "name": name,
            "slug": slug,
            "plan": "pilot",
            "owner_auth_user_id": session_payload["operator"]["id"],
            "owner_role": "owner",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_project(client, session_payload: dict, organization_id: str, *, name: str = "Support Copilot") -> dict:
    response = client.post(
        f"/api/v1/organizations/{organization_id}/projects",
        headers=auth_headers(session_payload),
        json={
            "name": name,
            "environment": "prod",
            "description": "Primary production app",
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_audit(client, headers: dict[str, str], payload: dict) -> dict:
    response = client.post("/api/v1/audits", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _default_payload(project_id: str | None = None) -> dict:
    return {
        "name": "Support Copilot Audit",
        "target_system_name": "Support Copilot",
        "company_name": "Acme",
        "audit_type": "production_readiness",
        "policy_profile": "production_readiness",
        "description": "Production readiness audit",
        "use_cases": ["ticket triage", "refund guidance"],
        "workflow_summary": "chat -> retrieval -> tool",
        "endpoints_notes": "POST /assist",
        "risk_focus_areas": ["hallucination", "guardrails"],
        "project_id": project_id,
        "environment": "production",
        "linked_production_enabled": bool(project_id),
        "evidence_window_days": 14,
        "include_incidents": True,
        "include_trace_samples": True,
        "include_guardrail_violations": True,
        "include_regressions": True,
        "include_model_changes": True,
    }


def test_audit_create_with_and_without_linked_project(client, db_session):
    operator = create_operator(db_session, email="audit-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Acme", slug="acme-audit")
    project = create_project(client, session, organization["id"], name="Support Copilot")

    linked = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    assert linked["audit"]["project_id"] == project["id"]
    assert linked["audit"]["linked_production_enabled"] is True

    unlinked = _create_audit(client, headers, _default_payload(project_id=None))
    assert unlinked["audit"]["project_id"] is None
    assert unlinked["audit"]["linked_production_enabled"] is False


def test_run_start_captures_snapshot_and_artifacts(client, db_session):
    operator = create_operator(db_session, email="snapshot-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Snapshot Org", slug="snapshot-org")
    project = create_project(client, session, organization["id"], name="Snapshot Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]

    start_response = client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers)
    assert start_response.status_code == 200, start_response.text

    detail_response = client.get(f"/api/v1/audits/{audit_id}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()
    context = detail["linked_production_context"]
    assert context is not None
    assert "evidenceWindow" in context
    assert "incidentSummary" in context
    assert "traceSampleSummary" in context
    assert "guardrailViolationSummary" in context
    assert "regressionSummary" in context
    assert "modelChangeSummary" in context
    assert "topRiskySurfaces" in context

    artifact_types = {
        row.artifact_type
        for row in db_session.scalars(
            select(AuditArtifact).join(AuditRun).where(AuditRun.id == UUID(run_id))
        ).all()
    }
    assert "production_incident_summary" in artifact_types
    assert "production_trace_sample_bundle" in artifact_types


def test_rerun_stage_invalidates_downstream_and_resets_summary(client, db_session):
    operator = create_operator(db_session, email="rerun-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Rerun Org", slug="rerun-org")
    project = create_project(client, session, organization["id"], name="Rerun Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]

    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    rerun = client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/stages/testing/rerun", headers=headers)
    assert rerun.status_code == 200, rerun.text
    payload = rerun.json()
    assert payload["run"]["certification_status"] == "pending"

    stage_status = {
        row.stage_key: row.status
        for row in db_session.scalars(select(AuditStage).where(AuditStage.audit_run_id == UUID(run_id))).all()
    }
    assert stage_status["testing"] == "completed"
    assert stage_status["review"] == "not_started"
    assert stage_status["certification"] == "not_started"

    summary = db_session.scalar(
        select(ProjectAuditSummary).where(ProjectAuditSummary.project_id == UUID(project["id"]))
    )
    assert summary is not None
    assert summary.certification_status == "pending"

    results = client.get(f"/api/v1/audits/{audit_id}/results", headers=headers)
    assert results.status_code == 200
    assert results.json()["run"]["certification_status"] == "pending"


def test_project_summary_and_certification_at_risk(client, db_session):
    operator = create_operator(db_session, email="risk-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Risk Org", slug="risk-org")
    project = create_project(client, session, organization["id"], name="Risk Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    summary_response = client.get(f"/api/v1/projects/{project['id']}/audit-summary", headers=headers)
    assert summary_response.status_code == 200
    assert summary_response.json()["latest_audit_run_id"] == run_id

    environment = db_session.scalar(select(Environment).where(Environment.project_id == UUID(project["id"])))
    assert environment is not None
    db_session.add(
        Incident(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            environment_id=environment.id,
            deployment_id=None,
            incident_type="reliability_drop",
            severity="critical",
            title="Post-certification critical incident",
            status="open",
            fingerprint=f"critical-{run_id}",
            summary_json={"detail": "post-cert risk"},
            started_at=datetime.now(timezone.utc) + timedelta(minutes=1),
            updated_at=datetime.now(timezone.utc) + timedelta(minutes=1),
            resolved_at=None,
            acknowledged_at=None,
            acknowledged_by_operator_user_id=None,
            owner_operator_user_id=None,
        )
    )
    db_session.add(
        Incident(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            environment_id=environment.id,
            deployment_id=None,
            incident_type="reliability_drop",
            severity="critical",
            title="Second post-certification critical incident",
            status="open",
            fingerprint=f"critical-2-{run_id}",
            summary_json={"detail": "post-cert risk #2"},
            started_at=datetime.now(timezone.utc) + timedelta(minutes=2),
            updated_at=datetime.now(timezone.utc) + timedelta(minutes=2),
            resolved_at=None,
            acknowledged_at=None,
            acknowledged_by_operator_user_id=None,
            owner_operator_user_id=None,
        )
    )
    db_session.commit()

    at_risk_response = client.get(f"/api/v1/projects/{project['id']}/audit-summary", headers=headers)
    assert at_risk_response.status_code == 200
    assert at_risk_response.json()["certification_at_risk"] is True


def test_project_summary_not_fresh_when_latest_run_in_progress(client, db_session):
    operator = create_operator(db_session, email="freshness-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Freshness Org", slug="freshness-org")
    project = create_project(client, session, organization["id"], name="Freshness Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    summary_completed = client.get(f"/api/v1/projects/{project['id']}/audit-summary", headers=headers)
    assert summary_completed.status_code == 200
    assert summary_completed.json()["certification_status"] != "pending"

    second_run = client.post(f"/api/v1/audits/{audit_id}/runs", headers=headers)
    assert second_run.status_code == 201
    second_run_id = second_run.json()["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{second_run_id}/start", headers=headers).status_code == 200

    summary_in_progress = client.get(f"/api/v1/projects/{project['id']}/audit-summary", headers=headers)
    assert summary_in_progress.status_code == 200
    assert summary_in_progress.json()["certification_status"] == "pending"
    assert summary_in_progress.json()["certification_at_risk"] is False


def test_audit_migration_schema_tables_present(db_session):
    inspector = inspect(db_session.bind)
    table_names = set(inspector.get_table_names())
    assert "audits" in table_names
    assert "audit_runs" in table_names
    assert "audit_stages" in table_names
    assert "audit_findings" in table_names
    assert "audit_artifacts" in table_names
    assert "audit_finding_traces" in table_names
    assert "audit_finding_incidents" in table_names
    assert "project_audit_summaries" in table_names
    project_summary_uniques = inspector.get_unique_constraints("project_audit_summaries")
    unique_columns = {tuple(item.get("column_names", [])) for item in project_summary_uniques}
    assert ("organization_id", "project_id") in unique_columns


def test_audit_tenancy_forbidden_cross_org(client, db_session):
    operator_a = create_operator(db_session, email="owner-a@acme.test")
    session_a = sign_in(client, email=operator_a.email)
    headers_a = auth_headers(session_a)
    organization_a = create_organization(client, session_a, name="Org A", slug="org-a")
    project_a = create_project(client, session_a, organization_a["id"], name="Project A")
    created = _create_audit(client, headers_a, _default_payload(project_id=project_a["id"]))
    audit_id = created["audit"]["id"]

    operator_b = create_operator(db_session, email="owner-b@acme.test")
    session_b = sign_in(client, email=operator_b.email)
    headers_b = auth_headers(session_b)
    create_organization(client, session_b, name="Org B", slug="org-b")

    forbidden = client.get(f"/api/v1/audits/{audit_id}", headers=headers_b)
    assert forbidden.status_code == 403


def test_certification_at_risk_threshold_reasons_are_explainable(client, db_session):
    # Reuse existing fixture helpers from this file.
    operator = create_operator(db_session, email="threshold-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Threshold Org", slug="threshold-org")
    project = create_project(client, session, organization["id"], name="Threshold Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    # Inject incidents after certification effective time to trigger at-risk.
    env = db_session.scalar(select(Environment).where(Environment.project_id == UUID(project["id"])))
    assert env is not None
    # Add two critical incidents to cross the default threshold (>=2).
    for i in range(2):
        db_session.add(
            Incident(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=env.id,
                deployment_id=None,
                incident_type="reliability_drop",
                severity="critical",
                title=f"Critical post-cert incident {i}",
                status="open",
                fingerprint=f"threshold-critical-{i}-{run_id}",
                summary_json={"detail": "post-cert threshold"},
                started_at=datetime.now(timezone.utc) + timedelta(minutes=1 + i),
                updated_at=datetime.now(timezone.utc) + timedelta(minutes=1 + i),
                resolved_at=None,
                acknowledged_at=None,
                acknowledged_by_operator_user_id=None,
                owner_operator_user_id=None,
            )
        )
    db_session.commit()

    at_risk = client.get(f"/api/v1/projects/{project['id']}/audit-summary", headers=headers)
    assert at_risk.status_code == 200
    payload = at_risk.json()
    assert payload["certification_at_risk"] is True
    assert payload["certification_risk_reason"] is not None
    # Ensure the reason stays human-readable and not a raw ID dump.
    assert "incident" in payload["certification_risk_reason"].lower()


def test_audit_detail_includes_recent_runs(client, db_session):
    operator = create_operator(db_session, email="runs-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Runs Org", slug="runs-org")
    project = create_project(client, session, organization["id"], name="Runs Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]

    # Create a few additional runs.
    run_ids = [created["run"]["id"]]
    for _ in range(3):
        resp = client.post(f"/api/v1/audits/{audit_id}/runs", headers=headers)
        assert resp.status_code == 201
        run_ids.append(resp.json()["run"]["id"])

    detail = client.get(f"/api/v1/audits/{audit_id}", headers=headers)
    assert detail.status_code == 200
    payload = detail.json()
    assert "recent_runs" in payload
    assert len(payload["recent_runs"]) == 4
    assert payload["recent_runs"][0]["id"] == run_ids[-1]


def test_completed_run_artifacts_include_structured_report_narrative(client, db_session):
    operator = create_operator(db_session, email="report-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Report Org", slug="report-org")
    project = create_project(client, session, organization["id"], name="Report Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    results = client.get(f"/api/v1/audits/{audit_id}/results", headers=headers)
    assert results.status_code == 200
    payload = results.json()
    assert "report_narrative" in payload
    assert payload["report_narrative"]["decision"]
    assert payload["report_narrative"]["required_next_action"]

    bundle = db_session.scalar(
        select(AuditArtifact).where(
            AuditArtifact.audit_run_id == UUID(run_id),
            AuditArtifact.artifact_type == "evidence_bundle",
            AuditArtifact.is_stale.is_(False),
        )
    )
    assert bundle is not None
    metadata = bundle.metadata_json or {}
    assert "report_narrative" in metadata
    assert "top_evidence_refs" in metadata
