from uuid import UUID

from app.schemas.upgrade_prompt import UpgradeRequiredResponse
from app.services.entitlements import has_feature
from app.services.rbac import has_required_role
from app.services.usage_quotas import get_usage_status
from app.services.upgrade_prompts import get_upgrade_prompt
from apps.api.tests.test_api import auth_headers, create_operator, sign_in
from app.models.organization import Organization
from app.models.usage_quota import UsageQuota


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


def test_has_required_role_hierarchy():
    assert has_required_role("owner", "admin") is True
    assert has_required_role("admin", "member") is True
    assert has_required_role("member", "viewer") is True
    assert has_required_role("viewer", "member") is False


def test_has_feature_by_plan():
    assert has_feature("free", "basic_tracing") is True
    assert has_feature("free", "collaboration") is False
    assert has_feature("team", "collaboration") is True
    assert has_feature("production", "dashboards") is True
    assert has_feature("enterprise", "slos") is True


def test_get_usage_status_thresholds(db_session):
    org = Organization(name="Acme", slug="acme", plan="free")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    quota = UsageQuota(organization_id=org.id, max_traces_per_day=100)
    db_session.add(quota)
    db_session.commit()

    org.monthly_traces = 2200
    db_session.add(org)
    db_session.commit()
    status = get_usage_status(db_session, organization_id=org.id)
    assert status["status"] == "warning"


def test_get_upgrade_prompt_payload():
    prompt = get_upgrade_prompt("team_invite")
    assert prompt["plan"] == "team"
    assert "Upgrade" in prompt["cta"]


def test_free_plan_blocks_second_member(client, db_session):
    owner = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Acme", slug="acme")
    org_record = db_session.get(Organization, UUID(org["id"]))
    org_record.plan = "free"
    db_session.add(org_record)
    db_session.commit()

    new_user = create_operator(db_session, email="member@acme.test")
    response = client.post(
        f"/api/v1/organizations/{org['id']}/members",
        headers=auth_headers(session_payload),
        json={"user_id": str(new_user.id), "role": "member"},
    )
    assert response.status_code == 403
    payload = UpgradeRequiredResponse.model_validate(response.json())
    assert payload.upgrade_prompt.plan == "team"


def test_viewer_role_requires_production(client, db_session):
    owner = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Acme", slug="acme")
    org_record = db_session.get(Organization, UUID(org["id"]))
    org_record.plan = "team"
    db_session.add(org_record)
    db_session.commit()

    new_user = create_operator(db_session, email="viewer@acme.test")
    response = client.post(
        f"/api/v1/organizations/{org['id']}/members",
        headers=auth_headers(session_payload),
        json={"user_id": str(new_user.id), "role": "viewer"},
    )
    assert response.status_code == 403
    payload = UpgradeRequiredResponse.model_validate(response.json())
    assert payload.upgrade_prompt.plan == "production"


def test_production_allows_viewer_role(client, db_session):
    owner = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Acme", slug="acme")
    org_record = db_session.get(Organization, UUID(org["id"]))
    org_record.plan = "production"
    db_session.add(org_record)
    db_session.commit()

    new_user = create_operator(db_session, email="viewer@acme.test")
    response = client.post(
        f"/api/v1/organizations/{org['id']}/members",
        headers=auth_headers(session_payload),
        json={"user_id": str(new_user.id), "role": "viewer"},
    )
    assert response.status_code == 201


def test_system_admin_bypass_org_role(client, db_session):
    owner = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    org = _create_org(client, session_payload, name="Acme", slug="acme")

    sys_admin = create_operator(db_session, email="admin@acme.test", is_system_admin=True)
    sys_session = sign_in(client, email=sys_admin.email)
    response = client.get(
        f"/api/v1/organizations/{org['id']}/members",
        headers=auth_headers(sys_session),
    )
    assert response.status_code == 200
