from datetime import date

from .test_api import auth_headers, create_operator, create_organization, sign_in
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_org_alert_target_crud_and_masking(client, db_session, monkeypatch):
    operator = create_operator(db_session, email="settings-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Settings Org", slug="settings-org")

    create_response = client.put(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=auth_headers(session_payload),
        json={
            "channel_target": "org:primary-slack",
            "slack_webhook_url": "https://hooks.slack.test/services/settings",
            "is_active": True,
        },
    )
    assert create_response.status_code == 200
    assert create_response.json()["channel_target"] == "org:primary-slack"
    assert create_response.json()["has_secret"] is True
    assert create_response.json()["webhook_masked"] is not None

    get_response = client.get(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=auth_headers(session_payload),
    )
    assert get_response.status_code == 200
    assert get_response.json()["webhook_masked"].startswith("https://hooks.slack")
    assert "..." in get_response.json()["webhook_masked"]
    assert "slack_webhook_url" not in get_response.json()

    update_response = client.put(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=auth_headers(session_payload),
        json={
            "channel_target": "org:secondary-slack",
            "is_active": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["channel_target"] == "org:secondary-slack"
    assert update_response.json()["is_active"] is False


def test_org_alert_target_enable_disable_and_test(client, db_session, monkeypatch):
    operator = create_operator(db_session, email="settings-toggle@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Toggle Org", slug="toggle-org")

    client.put(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=auth_headers(session_payload),
        json={
            "channel_target": "org:toggle-slack",
            "slack_webhook_url": "https://hooks.slack.test/services/toggle",
            "is_active": True,
        },
    )

    disable_response = client.post(
        f"/api/v1/organizations/{organization['id']}/alert-target/disable",
        headers=auth_headers(session_payload),
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["is_active"] is False

    enable_response = client.post(
        f"/api/v1/organizations/{organization['id']}/alert-target/enable",
        headers=auth_headers(session_payload),
    )
    assert enable_response.status_code == 200
    assert enable_response.json()["is_active"] is True

    monkeypatch.setattr(
        "app.services.organization_alert_targets.httpx.post",
        lambda *args, **kwargs: type(
            "Resp",
            (),
            {"raise_for_status": staticmethod(lambda: None)},
        )(),
    )
    test_response = client.post(
        f"/api/v1/organizations/{organization['id']}/alert-target/test",
        headers=auth_headers(session_payload),
    )
    assert test_response.status_code == 200
    assert test_response.json()["success"] is True


def test_org_alert_target_reads_and_writes_are_tenant_safe(client, db_session):
    owner = create_operator(db_session, email="settings-safe@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="Safe Org", slug="safe-org")

    outsider = create_operator(db_session, email="settings-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)

    forbidden_write = client.put(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=auth_headers(outsider_session),
        json={
            "channel_target": "org:blocked",
            "slack_webhook_url": "https://hooks.slack.test/services/blocked",
            "is_active": True,
        },
    )
    assert forbidden_write.status_code == 403

    forbidden_read = client.get(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=auth_headers(outsider_session),
    )
    assert forbidden_read.status_code == 403


def test_incident_list_filters(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    client.post(
        f"/api/v1/incidents/{incident.id}/owner",
        headers=auth_headers(owner_session),
        json={"owner_operator_user_id": owner_session["operator"]["id"]},
    )

    by_project = client.get(
        f"/api/v1/incidents?project_id={project['id']}",
        headers=auth_headers(owner_session),
    )
    assert by_project.status_code == 200
    assert all(item["project_id"] == project["id"] for item in by_project.json()["items"])

    by_severity = client.get(
        "/api/v1/incidents?severity=critical",
        headers=auth_headers(owner_session),
    )
    assert by_severity.status_code == 200
    assert by_severity.json()["items"]
    assert all(item["severity"] == "critical" for item in by_severity.json()["items"])

    by_owner = client.get(
        f"/api/v1/incidents?owner_operator_user_id={owner_session['operator']['id']}",
        headers=auth_headers(owner_session),
    )
    assert by_owner.status_code == 200
    assert by_owner.json()["items"]
    assert all(
        item["owner_operator_user_id"] == owner_session["operator"]["id"]
        for item in by_owner.json()["items"]
    )

    by_unassigned = client.get(
        "/api/v1/incidents?owner_state=unassigned",
        headers=auth_headers(owner_session),
    )
    assert by_unassigned.status_code == 200
    assert all(item["owner_operator_user_id"] is None for item in by_unassigned.json()["items"])

    by_date = client.get(
        f"/api/v1/incidents?date_from={date(2026, 3, 9).isoformat()}&date_to={date(2026, 3, 9).isoformat()}",
        headers=auth_headers(owner_session),
    )
    assert by_date.status_code == 200
    assert by_date.json()["items"]
