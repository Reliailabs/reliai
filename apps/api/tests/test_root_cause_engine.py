from app.services.auth import get_operator_context
from app.services.root_cause_engine import analyze_incident_root_cause, get_incident_analysis
from .test_api import auth_headers, create_operator, sign_in
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_root_cause_engine_returns_probabilities_and_fix(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    from app.services.incidents import get_incident_compare_traces, get_incident_regressions

    regressions = get_incident_regressions(db_session, incident)
    current_traces, baseline_traces = get_incident_compare_traces(db_session, incident)
    report = analyze_incident_root_cause(
        db_session,
        incident=incident,
        regressions=regressions,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )

    assert report.root_cause_probabilities
    probabilities = [item["probability"] for item in report.root_cause_probabilities]
    assert round(sum(probabilities), 4) == 1.0
    assert report.recommended_fix["fix_type"]
    cause_types = {item["cause_type"] for item in report.root_cause_probabilities}
    assert "error_cluster" in cause_types or "latency_change" in cause_types


def test_incident_analysis_endpoint_is_tenant_safe(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}/analysis",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()["incident"]
    assert payload["root_cause_probabilities"]
    assert payload["recommended_fix"]["summary"]
    assert payload["evidence"]["regression_snapshot_ids"]

    outsider = create_operator(db_session, email="analysis-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/incidents/{incident.id}/analysis",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 404


def test_incident_analysis_service_matches_endpoint_shape(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    report = get_incident_analysis(
        db_session,
        get_operator_context(db_session, owner_session["session_token"]),
        incident_id=incident.id,
    )
    assert str(report.incident.id) == str(incident.id)
    assert report.evidence["current_trace_ids"]
