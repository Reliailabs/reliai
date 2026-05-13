from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def test_project_oncall_endpoints_roundtrip(client, db_session):
    owner = create_operator(db_session, email="oncall-owner@acme.test")
    teammate = create_operator(db_session, email="oncall-secondary@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Oncall Org", slug="oncall-org")
    project = create_project(client, session_payload, organization["id"])

    add_member = client.post(
        f"/api/v1/organizations/{organization['id']}/members",
        headers=auth_headers(session_payload),
        json={"user_id": str(teammate.id), "role": "engineer"},
    )
    assert add_member.status_code == 201

    read_response = client.get(
        f"/api/v1/projects/{project['id']}/oncall",
        headers=auth_headers(session_payload),
    )
    assert read_response.status_code == 200
    assert read_response.json()["project_id"] == project["id"]

    assignment_response = client.put(
        f"/api/v1/projects/{project['id']}/oncall/assignments",
        headers=auth_headers(session_payload),
        json={
            "items": [
                {"role": "primary", "user_id": session_payload["operator"]["id"]},
                {"role": "secondary", "user_id": str(teammate.id)},
            ]
        },
    )
    assert assignment_response.status_code == 200
    assignment_roles = [item["role"] for item in assignment_response.json()["assignments"]]
    assert assignment_roles == ["primary", "secondary"]

    policy_response = client.put(
        f"/api/v1/projects/{project['id']}/oncall/escalation-policy",
        headers=auth_headers(session_payload),
        json={
            "items": [
                {"step_order": 1, "target_role": "primary", "wait_minutes": 5, "channel": "slack"},
                {"step_order": 2, "target_role": "secondary", "wait_minutes": 10, "channel": "phone"},
            ]
        },
    )
    assert policy_response.status_code == 200
    channels = [item["channel"] for item in policy_response.json()["escalation_policy"]]
    assert channels == ["slack", "phone"]


def test_project_oncall_assignments_reject_non_members(client, db_session):
    owner = create_operator(db_session, email="oncall-owner-two@acme.test")
    outsider = create_operator(db_session, email="outsider@beta.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Oncall Org Two", slug="oncall-org-two")
    project = create_project(client, session_payload, organization["id"])

    response = client.put(
        f"/api/v1/projects/{project['id']}/oncall/assignments",
        headers=auth_headers(session_payload),
        json={"items": [{"role": "primary", "user_id": str(outsider.id)}]},
    )
    assert response.status_code == 400
    assert "not organization members" in response.json()["detail"]
