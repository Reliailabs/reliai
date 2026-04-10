from datetime import timedelta

from app.services.alerts import create_alert_deliveries_for_open_incidents

from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in
from .test_incidents import _list_open_incidents, _seed_success_rate_regression


def test_org_alert_deliveries_endpoint(client, db_session, fake_queue):
    session_payload, organization, project, _ = _seed_success_rate_regression(client, db_session)
    incidents = _list_open_incidents(db_session, project["id"])
    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=incidents)
    db_session.commit()

    response = client.get(
        f"/api/v1/organizations/{organization['id']}/alert-deliveries",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert items[0]["incident_id"] in {str(delivery.incident_id) for delivery in deliveries}


def test_org_alert_deliveries_isolated(client, db_session):
    owner_one = create_operator(db_session, email="alerts-owner@acme.test")
    owner_one_session = sign_in(client, email=owner_one.email)
    _ = create_organization(client, owner_one_session, name="Org One", slug="alerts-org-one")

    owner_two = create_operator(db_session, email="alerts-owner@beta.test")
    owner_two_session = sign_in(client, email=owner_two.email)
    org_two = create_organization(client, owner_two_session, name="Org Two", slug="alerts-org-two")

    response = client.get(
        f"/api/v1/organizations/{org_two['id']}/alert-deliveries",
        headers=auth_headers(owner_one_session),
    )

    assert response.status_code == 403


def test_regression_history_endpoint(client, db_session, fake_queue):
    session_payload, _, project, _ = _seed_success_rate_regression(client, db_session)
    regressions_response = client.get(
        f"/api/v1/projects/{project['id']}/regressions",
        headers=auth_headers(session_payload),
    )
    assert regressions_response.status_code == 200
    regression_id = regressions_response.json()["items"][0]["id"]

    history_response = client.get(
        f"/api/v1/projects/{project['id']}/regressions/{regression_id}/history",
        headers=auth_headers(session_payload),
    )

    assert history_response.status_code == 200
    payload = history_response.json()
    assert payload["regression_id"] == regression_id
    assert payload["points"]
    assert payload["points"][0]["window_start"]


def test_regression_history_isolated(client, db_session, fake_queue):
    session_payload, _, project, _ = _seed_success_rate_regression(client, db_session)
    regressions_response = client.get(
        f"/api/v1/projects/{project['id']}/regressions",
        headers=auth_headers(session_payload),
    )
    regression_id = regressions_response.json()["items"][0]["id"]

    other_owner = create_operator(db_session, email="history-owner@beta.test")
    other_session = sign_in(client, email=other_owner.email)
    other_org = create_organization(client, other_session, name="Org Beta", slug="org-beta-history")
    other_project = create_project(client, other_session, other_org["id"])

    response = client.get(
        f"/api/v1/projects/{other_project['id']}/regressions/{regression_id}/history",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 403


def test_dashboard_triage_avg_mttr(client, db_session, fake_queue):
    session_payload, _, project, _ = _seed_success_rate_regression(client, db_session)
    incidents = _list_open_incidents(db_session, project["id"])
    incident = incidents[0]
    incident.status = "resolved"
    incident.resolved_at = incident.started_at + timedelta(minutes=30)
    db_session.add(incident)
    db_session.commit()

    response = client.get(
        "/api/v1/dashboard/triage",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    assert response.json()["context"]["avg_mttr_minutes"] is not None
