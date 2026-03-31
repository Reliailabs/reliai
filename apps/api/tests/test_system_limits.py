from app.services.rate_limiter import record_limit_exceeded

from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _setup_org_project(client, db_session):
    operator = create_operator(db_session, email="limits-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")
    project = create_project(client, session_payload, organization["id"], name="Support Copilot")
    return session_payload, organization, project


def test_system_limits_endpoint_shape(client, db_session):
    session_payload, _organization, _project = _setup_org_project(client, db_session)
    response = client.get("/api/v1/system/limits", headers=auth_headers(session_payload))
    assert response.status_code == 200
    payload = response.json()
    assert "limits" in payload
    assert isinstance(payload["limits"], list)


def test_system_limits_severity_ordering(client, db_session):
    session_payload, organization, _project = _setup_org_project(client, db_session)
    record_limit_exceeded(scope="api_rate", identifier=organization["id"], window_seconds=60)
    record_limit_exceeded(scope="ingest_global", identifier="global", window_seconds=60)
    response = client.get("/api/v1/system/limits", headers=auth_headers(session_payload))
    assert response.status_code == 200
    limits = response.json()["limits"]
    assert limits
    assert limits[0]["type"] == "ingest_global"


def test_system_limits_project_scope(client, db_session):
    session_payload, _organization, project = _setup_org_project(client, db_session)
    record_limit_exceeded(scope="ingest_project", identifier=project["id"], window_seconds=60)

    response = client.get("/api/v1/system/limits", headers=auth_headers(session_payload))
    assert response.status_code == 200
    assert all(limit["type"] != "ingest_project" for limit in response.json()["limits"])

    response = client.get(
        f"/api/v1/system/limits?project_id={project['id']}",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    limits = response.json()["limits"]
    assert any(limit["type"] == "ingest_project" for limit in limits)
    scoped = next(limit for limit in limits if limit["type"] == "ingest_project")
    assert scoped["scope"]["project_id"] == project["id"]


def test_system_limits_sampling_status(client, db_session):
    session_payload, _organization, project = _setup_org_project(client, db_session)
    response = client.put(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_payload),
        json={"sampling_success_rate": 0.5, "sampling_error_rate": 1.0},
    )
    assert response.status_code == 200

    response = client.get(
        f"/api/v1/system/limits?project_id={project['id']}",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    limits = response.json()["limits"]
    assert any(limit["type"] == "sampling" for limit in limits)
    sampling = next(limit for limit in limits if limit["type"] == "sampling")
    assert sampling["is_plan_related"] is False
    assert sampling["cta_priority"] == "settings_first"
    assert sampling["cta"]["label"] == "View ingestion policy"
    assert sampling["cta_secondary"]["label"] == "Adjust sampling"


def test_system_limits_storage_status(client, db_session):
    session_payload, organization, _project = _setup_org_project(client, db_session)
    from app.models.usage_quota import UsageQuota
    from app.models.organization import Organization

    quota = db_session.query(UsageQuota).filter(UsageQuota.organization_id == organization["id"]).one_or_none()
    if quota is None:
        quota = UsageQuota(organization_id=organization["id"])
        db_session.add(quota)
    quota.max_traces_per_day = 1
    org = db_session.query(Organization).filter(Organization.id == organization["id"]).one()
    org.monthly_traces = 100
    db_session.commit()

    response = client.get("/api/v1/system/limits", headers=auth_headers(session_payload))
    assert response.status_code == 200
    limits = response.json()["limits"]
    assert any(limit["type"] == "storage" for limit in limits)
    storage = next(limit for limit in limits if limit["type"] == "storage")
    assert storage["is_plan_related"] is True
    assert storage["cta_priority"] == "settings_first"
    assert storage["cta"]["label"] == "View retention settings"
    assert storage["cta_secondary"]["label"] == "Increase retention"


def test_system_limits_limit_flag_produces_status(client, db_session):
    session_payload, _organization, _project = _setup_org_project(client, db_session)
    record_limit_exceeded(scope="ingest_global", identifier="global", window_seconds=60)
    response = client.get("/api/v1/system/limits", headers=auth_headers(session_payload))
    assert response.status_code == 200
    limits = response.json()["limits"]
    assert any(limit["type"] == "ingest_global" for limit in limits)
    ingest_global = next(limit for limit in limits if limit["type"] == "ingest_global")
    assert ingest_global["is_plan_related"] is True
    assert ingest_global["cta_priority"] == "settings_first"
    assert ingest_global["cta"]["label"] == "Adjust sampling"
    assert ingest_global["cta_secondary"]["label"] == "Upgrade ingest capacity"
