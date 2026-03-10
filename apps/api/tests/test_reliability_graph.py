from .test_api import auth_headers, create_operator, sign_in
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_incident_graph_returns_investigation_context(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}/graph",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["incident"]["id"] == str(incident.id)
    assert payload["regressions"]
    assert payload["traces"]
    assert payload["evaluations"]
    assert payload["root_causes"]
    assert payload["prompt_version"] is not None
    assert payload["model_version"] is not None
    assert payload["deployment"] is None

    first_trace = payload["traces"][0]
    assert first_trace["evaluations"]
    assert first_trace["prompt_version_record"] is not None
    assert first_trace["model_version_record"] is not None


def test_incident_graph_is_tenant_safe(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    allowed = client.get(
        f"/api/v1/incidents/{incident.id}/graph",
        headers=auth_headers(owner_session),
    )
    assert allowed.status_code == 200

    outsider = create_operator(db_session, email="graph-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/incidents/{incident.id}/graph",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 404


def test_incident_graph_root_causes_are_deterministic(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}/graph",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()

    cause_types = {item["cause_type"] for item in payload["root_causes"]}
    assert "prompt_version" in cause_types
    assert "model_version" in cause_types
    assert any(item["confidence_score"] is not None for item in payload["root_causes"])
    assert all(
        item["evidence_json"]["supporting_trace_ids"] for item in payload["root_causes"]
    )
