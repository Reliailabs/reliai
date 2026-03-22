from types import SimpleNamespace
from uuid import UUID

from app.models.audit_log import AuditLog
from app.models.organization_member import OrganizationMember
from app.models.project_member import ProjectMember
from app.models.user import User
from app.services.auth_workos import authenticate_workos_token

from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _add_org_member(db_session, *, organization_id: str, user_id, role: str) -> None:
    db_session.add(
        OrganizationMember(
            organization_id=UUID(organization_id),
            user_id=user_id,
            auth_user_id=str(user_id),
            role=role,
        )
    )
    db_session.commit()


def _add_project_member(db_session, *, project_id: str, user_id, role: str) -> None:
    db_session.add(
        ProjectMember(
            project_id=UUID(project_id),
            user_id=user_id,
            role=role,
        )
    )
    db_session.commit()


def test_project_membership_required_when_project_is_restricted(client, db_session):
    owner = create_operator(db_session, email="rbac-owner@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="RBAC Org", slug="rbac-org")
    project = create_project(client, owner_session, organization["id"], name="Restricted Project")

    teammate = create_operator(db_session, email="rbac-engineer@acme.test")
    _add_org_member(db_session, organization_id=organization["id"], user_id=teammate.id, role="engineer")
    _add_project_member(db_session, project_id=project["id"], user_id=owner.id, role="engineer")
    teammate_session = sign_in(client, email=teammate.email)

    response = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(teammate_session))

    assert response.status_code == 403


def test_org_admin_can_access_restricted_project_without_project_membership(client, db_session):
    owner = create_operator(db_session, email="rbac-owner-admin@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="RBAC Admin Org", slug="rbac-admin-org")
    project = create_project(client, owner_session, organization["id"], name="Admin Project")

    admin = create_operator(db_session, email="rbac-org-admin@acme.test")
    _add_org_member(db_session, organization_id=organization["id"], user_id=admin.id, role="org_admin")
    _add_project_member(db_session, project_id=project["id"], user_id=owner.id, role="engineer")
    admin_session = sign_in(client, email=admin.email)

    response = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(admin_session))

    assert response.status_code == 200


def test_viewer_can_read_but_cannot_mutate_project_resources(client, db_session):
    owner = create_operator(db_session, email="rbac-owner-viewer@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="RBAC Viewer Org", slug="rbac-viewer-org")
    project = create_project(client, owner_session, organization["id"], name="Viewer Project")

    viewer = create_operator(db_session, email="rbac-viewer@acme.test")
    _add_org_member(db_session, organization_id=organization["id"], user_id=viewer.id, role="viewer")
    _add_project_member(db_session, project_id=project["id"], user_id=viewer.id, role="viewer")
    viewer_session = sign_in(client, email=viewer.email)

    read_response = client.get(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(viewer_session),
    )
    write_response = client.post(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(viewer_session),
        json={"name": "staging", "type": "staging"},
    )

    assert read_response.status_code == 200
    assert write_response.status_code == 403


def test_engineer_can_mutate_and_environment_creation_is_audited(client, db_session):
    owner = create_operator(db_session, email="rbac-owner-audit@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="RBAC Audit Org", slug="rbac-audit-org")
    project = create_project(client, owner_session, organization["id"], name="Audit Project")

    engineer = create_operator(db_session, email="rbac-project-engineer@acme.test")
    _add_org_member(db_session, organization_id=organization["id"], user_id=engineer.id, role="engineer")
    _add_project_member(db_session, project_id=project["id"], user_id=engineer.id, role="engineer")
    engineer_session = sign_in(client, email=engineer.email)

    response = client.post(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(engineer_session),
        json={"name": "staging", "type": "staging"},
    )

    assert response.status_code == 201
    audit_row = db_session.query(AuditLog).filter(AuditLog.action == "environment_created").one()
    assert str(audit_row.organization_id) == organization["id"]
    assert audit_row.user_id == engineer.id
    assert audit_row.resource_type == "environment"
    assert audit_row.metadata_json["project_id"] == project["id"]
    assert audit_row.metadata_json["name"] == "staging"


def test_environment_filter_rejects_environment_outside_authorized_project(client, db_session):
    owner = create_operator(db_session, email="rbac-owner-env@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="RBAC Env Org", slug="rbac-env-org")
    first_project = create_project(client, owner_session, organization["id"], name="Primary Project")
    second_project = create_project(client, owner_session, organization["id"], name="Secondary Project")

    created = client.post(
        f"/api/v1/projects/{second_project['id']}/environments",
        headers=auth_headers(owner_session),
        json={"name": "staging", "type": "staging"},
    )
    assert created.status_code == 201

    response = client.get(
        f"/api/v1/projects/{first_project['id']}/timeline?environment=staging",
        headers=auth_headers(owner_session),
    )

    assert response.status_code == 404


def test_workos_group_mapping_updates_single_membership_role(db_session, monkeypatch):
    operator = create_operator(db_session, email="rbac-workos@acme.test")
    user = db_session.get(User, operator.id)
    assert user is not None
    organization_id = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    db_session.add(
        OrganizationMember(
            organization_id=organization_id,
            user_id=user.id,
            auth_user_id=str(user.id),
            role="viewer",
        )
    )
    db_session.commit()

    monkeypatch.setattr(
        "app.services.auth_workos._decode_token",
        lambda token: {"sub": "wos_user_123", "groups": ["Reliai-Admins"]},
    )
    monkeypatch.setattr(
        "app.services.auth_workos._get_workos_client",
        lambda: SimpleNamespace(
            user_management=SimpleNamespace(
                get_user=lambda user_id: SimpleNamespace(email="rbac-workos@acme.test")
            )
        ),
    )

    context = authenticate_workos_token(db_session, "header.payload.signature")

    assert context.operator.workos_user_id == "wos_user_123"
    assert context.memberships[0].role == "admin"
