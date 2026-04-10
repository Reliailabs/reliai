from datetime import datetime, timezone
from uuid import UUID

from app.models.project_slo import ProjectSLO
from app.models.reliability_metric import ReliabilityMetric

from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def test_project_slos_endpoint(client, db_session):
    operator = create_operator(db_session, email="slo-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="SLO Org", slug="slo-org")
    project = create_project(client, session_payload, organization["id"])

    slo = ProjectSLO(
        project_id=UUID(project["id"]),
        organization_id=UUID(organization["id"]),
        name="Quality Pass Rate",
        description="Test SLO",
        metric_type="quality_pass_rate",
        target_value=95.0,
        window_days=30,
        enabled=True,
    )
    db_session.add(slo)
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/slos",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert payload["items"][0]["name"] == "Quality Pass Rate"


def test_project_slos_isolated(client, db_session):
    owner_one = create_operator(db_session, email="slo-owner-one@acme.test")
    owner_one_session = sign_in(client, email=owner_one.email)
    org_one = create_organization(client, owner_one_session, name="SLO Org One", slug="slo-org-one")
    project_one = create_project(client, owner_one_session, org_one["id"])

    owner_two = create_operator(db_session, email="slo-owner-two@beta.test")
    owner_two_session = sign_in(client, email=owner_two.email)
    org_two = create_organization(client, owner_two_session, name="SLO Org Two", slug="slo-org-two")
    project_two = create_project(client, owner_two_session, org_two["id"])

    response = client.get(
        f"/api/v1/projects/{project_two['id']}/slos",
        headers=auth_headers(owner_one_session),
    )

    assert response.status_code == 403


def test_project_slos_period_override(client, db_session):
    """window_days query param overrides SLO's own window_days when computing current_value."""
    operator = create_operator(db_session, email="slo-period@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client, session_payload, name="SLO Period Org", slug="slo-period-org"
    )
    project = create_project(client, session_payload, organization["id"])

    project_uuid = UUID(project["id"])
    org_uuid = UUID(organization["id"])

    # SLO is configured for 30-day window
    slo = ProjectSLO(
        project_id=project_uuid,
        organization_id=org_uuid,
        name="Quality Pass Rate",
        description="Test SLO period override",
        metric_type="quality_pass_rate",
        target_value=95.0,
        window_days=30,
        enabled=True,
    )
    db_session.add(slo)

    # Seed a ReliabilityMetric for the 7-day window
    now = datetime.now(timezone.utc)
    metric = ReliabilityMetric(
        organization_id=org_uuid,
        project_id=project_uuid,
        scope_type="project",
        scope_id=str(project_uuid),
        metric_name="quality_pass_rate",
        window_minutes=7 * 24 * 60,
        window_start=now.replace(hour=0, minute=0, second=0, microsecond=0),
        window_end=now,
        value_number=0.97,
        unit="ratio",
        computed_at=now,
    )
    db_session.add(metric)
    db_session.commit()

    # Without override — no 30-day metric seeded, current_value should be null
    response_default = client.get(
        f"/api/v1/projects/{project['id']}/slos",
        headers=auth_headers(session_payload),
    )
    assert response_default.status_code == 200
    assert response_default.json()["items"][0]["current_value"] is None

    # With window_days=7 override — should resolve the 7-day metric
    response_7d = client.get(
        f"/api/v1/projects/{project['id']}/slos?window_days=7",
        headers=auth_headers(session_payload),
    )
    assert response_7d.status_code == 200
    item = response_7d.json()["items"][0]
    assert item["current_value"] is not None
    # 0.97 * 100 = 97.0
    assert abs(item["current_value"] - 97.0) < 0.01
