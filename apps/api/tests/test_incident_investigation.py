from .test_api import auth_headers, create_operator, sign_in
from .test_incident_command_center import _seed_incident_with_deployment


def test_incident_investigation_endpoint_returns_workflow_payload(client, db_session, fake_queue):
    owner_session, _, _, incident, _ = _seed_incident_with_deployment(client, db_session)

    response = client.get(
        f"/api/v1/incidents/{incident.id}/investigation",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["incident"]["id"] == str(incident.id)
    assert payload["root_cause_analysis"]["ranked_causes"]
    assert payload["trace_comparison"]["compare_link"].startswith("/")
    assert payload["trace_comparison"]["key_differences"]
    assert "diff_blocks" in payload["trace_comparison"]["comparison"]
    assert payload["recommendations"]
    assert "recommended_action" in payload["recommendations"][0]
    assert "confidence" in payload["recommendations"][0]
    assert "supporting_evidence" in payload["recommendations"][0]
    assert "latest_risk_score" in payload["deployment_context"]
    assert "latest_simulation" in payload["deployment_context"]


def test_incident_investigation_endpoint_is_tenant_safe(client, db_session, fake_queue):
    owner_session, _, _, incident, _ = _seed_incident_with_deployment(client, db_session)

    response = client.get(
        f"/api/v1/incidents/{incident.id}/investigation",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200

    outsider = create_operator(db_session, email="investigation-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/incidents/{incident.id}/investigation",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 404
