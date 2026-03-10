from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from fastapi import HTTPException, status

from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.services.auth import OperatorContext

from .test_api import auth_headers, create_operator, create_organization, sign_in


def test_workos_bearer_token_resolves_user_and_memberships(client, db_session, monkeypatch):
    operator = create_operator(db_session, email="workos-admin@acme.test", is_system_admin=True)
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="WorkOS Org", slug="workos-org")
    user = db_session.get(User, operator.id)
    assert user is not None

    def fake_authenticate(db, token):
        del db
        assert token == "header.payload.signature"
        return OperatorContext(
            operator=user,
            memberships=[
                OrganizationMember(
                    organization_id=UUID(organization["id"]),
                    user_id=user.id,
                    auth_user_id=str(user.id),
                    role="owner",
                )
            ],
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            auth_source="workos",
        )

    monkeypatch.setattr("app.services.auth._workos_enabled", lambda: True)
    monkeypatch.setattr("app.services.auth.authenticate_workos_token", fake_authenticate)

    response = client.get(
        "/api/v1/auth/session",
        headers={"Authorization": "Bearer header.payload.signature"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["operator"]["email"] == "workos-admin@acme.test"
    assert payload["operator"]["is_system_admin"] is True
    assert payload["memberships"][0]["organization_id"] == organization["id"]


def test_invalid_workos_token_returns_unauthorized(client, monkeypatch):
    monkeypatch.setattr("app.services.auth._workos_enabled", lambda: True)

    def reject_token(db, token):
        del db, token
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    monkeypatch.setattr("app.services.auth.authenticate_workos_token", reject_token)

    response = client.get(
        "/api/v1/auth/session",
        headers={"Authorization": "Bearer broken.token.value"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid session"


def test_dev_fallback_sign_in_works_when_enabled(client, db_session, monkeypatch):
    operator = create_operator(db_session, email="dev-fallback@acme.test")
    monkeypatch.setattr("app.services.auth._dev_auth_enabled", lambda: True)

    response = client.post(
        "/api/v1/auth/sign-in",
        json={"email": operator.email, "password": "reliai-test-password"},
    )

    assert response.status_code == 200
    assert response.json()["operator"]["email"] == operator.email
    assert response.json()["session_token"]


def test_production_rejects_dev_sign_in(client, monkeypatch):
    monkeypatch.setattr("app.services.auth._dev_auth_enabled", lambda: False)

    response = client.post(
        "/api/v1/auth/sign-in",
        json={"email": "owner@acme.test", "password": "reliai-test-password"},
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/system/growth",
        "/api/v1/system/customers",
        "/api/v1/system/event-pipeline",
    ],
)
def test_system_endpoints_require_system_admin(path, client, db_session):
    operator = create_operator(db_session, email="operator@acme.test", is_system_admin=False)
    session_payload = sign_in(client, email=operator.email)

    response = client.get(path, headers=auth_headers(session_payload))

    assert response.status_code == 403
    assert response.json()["detail"] == "System administrator access required"


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/system/growth",
        "/api/v1/system/customers",
        "/api/v1/system/event-pipeline",
    ],
)
def test_system_admin_can_access_system_endpoints(path, client, db_session):
    operator = create_operator(db_session, email="system-admin@acme.test", is_system_admin=True)
    session_payload = sign_in(client, email=operator.email)

    response = client.get(path, headers=auth_headers(session_payload))

    assert response.status_code == 200
