from uuid import UUID

from app.models.organization import Organization
from tests.test_api import auth_headers, create_operator, sign_in


def _create_org(client, session_payload, *, name: str, slug: str):
    response = client.post(
        "/api/v1/organizations",
        headers=auth_headers(session_payload),
        json={
            "name": name,
            "slug": slug,
            "owner_auth_user_id": session_payload["operator"]["id"],
            "owner_role": "owner",
        },
    )
    assert response.status_code == 201
    return response.json()


def _enable_collaboration(db_session, organization_id: str) -> None:
    org_record = db_session.get(Organization, UUID(organization_id))
    assert org_record is not None
    org_record.plan = "team"
    db_session.add(org_record)
    db_session.commit()


def test_create_list_and_revoke_pending_invitation(client, db_session):
    owner = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Acme AI", slug="acme-ai")
    _enable_collaboration(db_session, org["id"])

    response = client.post(
        f"/api/v1/organizations/{org['id']}/invitations",
        headers=auth_headers(session_payload),
        json={"email": "invitee@acme.test", "role": "engineer"},
    )
    assert response.status_code == 201
    invitation = response.json()
    assert invitation["invited_email"] == "invitee@acme.test"
    assert invitation["role"] == "member"
    assert invitation["status"] == "pending"
    assert invitation["signup_path"].startswith("/signup?entry=team-invite&email=")
    assert invitation["join_path"].startswith("/join?token=")

    list_response = client.get(
        f"/api/v1/organizations/{org['id']}/invitations",
        headers=auth_headers(session_payload),
    )
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert len(items) == 1
    assert items[0]["invited_email"] == "invitee@acme.test"

    revoke_response = client.delete(
        f"/api/v1/organizations/{org['id']}/invitations/{invitation['id']}",
        headers=auth_headers(session_payload),
    )
    assert revoke_response.status_code == 204

    list_after_revoke = client.get(
        f"/api/v1/organizations/{org['id']}/invitations",
        headers=auth_headers(session_payload),
    )
    assert list_after_revoke.status_code == 200
    assert list_after_revoke.json()["items"] == []


def test_validate_and_accept_pending_invitation(client, db_session):
    owner = create_operator(db_session, email="owner@gamma.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Gamma AI", slug="gamma-ai")
    _enable_collaboration(db_session, org["id"])

    create_response = client.post(
        f"/api/v1/organizations/{org['id']}/invitations",
        headers=auth_headers(session_payload),
        json={"email": "joiner@gamma.test", "role": "engineer"},
    )
    assert create_response.status_code == 201
    invitation = create_response.json()
    token = invitation["join_path"].split("token=")[1]

    public_by_token = client.get(f"/api/v1/invitations/{token}")
    assert public_by_token.status_code == 200
    public_payload = public_by_token.json()
    assert public_payload["organization_name"] == "Gamma AI"
    assert public_payload["invited_email"] == "joiner@gamma.test"
    assert public_payload["join_path"] == invitation["join_path"]

    accept_response = client.post(
        f"/api/v1/invitations/{token}/accept",
    )
    assert accept_response.status_code == 200
    accepted = accept_response.json()
    assert accepted["session_token"]
    assert accepted["operator"]["email"] == "joiner@gamma.test"
    assert accepted["memberships"][0]["organization_id"] == org["id"]
    assert accepted["join_path"] == invitation["join_path"]

    after_accept = client.get(f"/api/v1/invitations/{token}")
    assert after_accept.status_code == 404

    second_accept = client.post(
        f"/api/v1/invitations/{token}/accept",
    )
    assert second_accept.status_code == 409
    assert second_accept.json()["detail"] == "Invitation already accepted"


def test_duplicate_pending_invitation_is_rejected(client, db_session):
    owner = create_operator(db_session, email="owner@beta.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Beta AI", slug="beta-ai")
    _enable_collaboration(db_session, org["id"])

    first = client.post(
        f"/api/v1/organizations/{org['id']}/invitations",
        headers=auth_headers(session_payload),
        json={"email": "invitee@beta.test", "role": "engineer"},
    )
    assert first.status_code == 201

    duplicate = client.post(
        f"/api/v1/organizations/{org['id']}/invitations",
        headers=auth_headers(session_payload),
        json={"email": "invitee@beta.test", "role": "engineer"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Invitation already pending"
