from app.models.project_slo import ProjectSLO

from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def test_project_slos_endpoint(client, db_session):
    operator = create_operator(db_session, email="slo-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="SLO Org", slug="slo-org")
    project = create_project(client, session_payload, organization["id"])

    slo = ProjectSLO(
        project_id=project["id"],
        organization_id=organization["id"],
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
