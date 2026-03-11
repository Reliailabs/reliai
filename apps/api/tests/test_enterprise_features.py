from types import SimpleNamespace
from uuid import UUID

from app.models.audit_log import AuditLog
from app.models.customer_export import CustomerExport
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.services.customer_exports import run_customer_export_for_session

from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    def incrby(self, key: str, amount: int) -> int:
        self.values[key] = self.values.get(key, 0) + amount
        return self.values[key]

    def expire(self, key: str, seconds: int) -> bool:
        return True


def test_public_api_key_can_query_project_traces(client, db_session):
    operator = create_operator(db_session, email="platform-owner@acme.test")
    session = sign_in(client, email=operator.email)
    organization = create_organization(client, session, name="Acme Platform", slug="acme-platform")
    project = create_project(client, session, organization["id"])
    project_key = create_api_key(client, session, project["id"])

    ingest_trace(
        client,
        project_key["api_key"],
        {
            "request_id": "req-public-1",
            "timestamp": "2026-03-10T12:00:00+00:00",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v1",
            "input_text": "hello",
            "output_text": "{}",
            "latency_ms": 120,
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_cost_usd": 0.01,
            "success": True,
            "metadata_json": {},
            "environment": "production",
        },
    )

    public_key_response = client.post(
        "/api/v1/api-keys",
        headers=auth_headers(session),
        json={"organization_id": organization["id"], "name": "Warehouse read"},
    )
    assert public_key_response.status_code == 201
    public_key = public_key_response.json()["api_key"]

    traces_response = client.get(
        f"/api/v1/projects/{project['id']}/traces",
        headers={"x-api-key": public_key},
    )

    assert traces_response.status_code == 200
    assert traces_response.json()["items"][0]["request_id"] == "req-public-1"


def test_public_api_key_cannot_cross_tenants(client, db_session):
    first = create_operator(db_session, email="owner-one@acme.test")
    first_session = sign_in(client, email=first.email)
    first_org = create_organization(client, first_session, name="Org One", slug="org-one")
    first_project = create_project(client, first_session, first_org["id"])

    second = create_operator(db_session, email="owner-two@beta.test")
    second_session = sign_in(client, email=second.email)
    second_org = create_organization(client, second_session, name="Org Two", slug="org-two")

    public_key_response = client.post(
        "/api/v1/api-keys",
        headers=auth_headers(second_session),
        json={"organization_id": second_org["id"], "name": "Tenant two"},
    )
    public_key = public_key_response.json()["api_key"]

    response = client.get(
        f"/api/v1/projects/{first_project['id']}/traces",
        headers={"x-api-key": public_key},
    )

    assert response.status_code == 403


def test_trace_quota_enforced_on_ingest(client, db_session, monkeypatch):
    from app.services import rate_limiter as rate_limiter_service

    fake_redis = FakeRedis()
    monkeypatch.setattr(rate_limiter_service, "get_redis", lambda: fake_redis)

    operator = create_operator(db_session, email="quota-owner@acme.test")
    session = sign_in(client, email=operator.email)
    organization = create_organization(client, session, name="Quota Org", slug="quota-org")
    project = create_project(client, session, organization["id"])
    quota_response = client.put(
        f"/api/v1/organizations/{organization['id']}/usage-quota",
        headers=auth_headers(session),
        json={"max_traces_per_day": 1, "max_processors": 5, "max_api_requests": 100},
    )
    assert quota_response.status_code == 200

    project_key = create_api_key(client, session, project["id"])
    payload = {
        "timestamp": "2026-03-10T12:00:00+00:00",
        "model_name": "gpt-4.1",
        "model_provider": "openai",
        "prompt_version": "v1",
        "input_text": "hello",
        "output_text": "{}",
        "latency_ms": 120,
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_cost_usd": 0.01,
        "success": True,
        "metadata_json": {},
        "environment": "production",
    }
    first = client.post("/api/v1/ingest/traces", headers={"x-api-key": project_key["api_key"]}, json={**payload, "request_id": "quota-1"})
    second = client.post("/api/v1/ingest/traces", headers={"x-api-key": project_key["api_key"]}, json={**payload, "request_id": "quota-2"})

    assert first.status_code == 202
    assert second.status_code == 429


def test_scim_provision_and_deprovision(client, db_session, monkeypatch):
    monkeypatch.setattr("app.api.v1.routes.get_settings", lambda: SimpleNamespace(workos_scim_webhook_secret="scim-secret"))
    monkeypatch.setattr(
        "app.services.auth_workos._get_workos_client",
        lambda: SimpleNamespace(
            user_management=SimpleNamespace(
                get_user=lambda user_id: SimpleNamespace(email="scim-user@acme.test")
            )
        ),
    )

    provision = client.post(
        "/api/v1/auth/workos/scim",
        headers={"Authorization": "Bearer scim-secret"},
        json={
            "event_type": "user_provisioned",
            "email": "scim-user@acme.test",
            "workos_user_id": "wos_user_scim",
            "groups": ["Reliai-Viewers"],
        },
    )
    assert provision.status_code == 204

    user = db_session.query(User).filter(User.email == "scim-user@acme.test").one()
    assert user.is_active is True

    deprovision = client.post(
        "/api/v1/auth/workos/scim",
        headers={"Authorization": "Bearer scim-secret"},
        json={
            "event_type": "user_deprovisioned",
            "workos_user_id": "wos_user_scim",
        },
    )
    assert deprovision.status_code == 204
    db_session.refresh(user)
    assert user.is_active is False


def test_customer_export_and_audit_log(client, db_session, fake_queue, monkeypatch):
    monkeypatch.setattr("app.services.customer_exports.get_queue", lambda: fake_queue)

    operator = create_operator(db_session, email="export-owner@acme.test")
    session = sign_in(client, email=operator.email)
    organization = create_organization(client, session, name="Export Org", slug="export-org")
    project = create_project(client, session, organization["id"])
    create_api_key_response = create_api_key(client, session, project["id"])
    ingest_trace(
        client,
        create_api_key_response["api_key"],
        {
            "request_id": "export-trace-1",
            "timestamp": "2026-03-10T12:00:00+00:00",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v1",
            "input_text": "hello",
            "output_text": "{}",
            "latency_ms": 120,
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_cost_usd": 0.01,
            "success": True,
            "metadata_json": {},
            "environment": "production",
        },
    )

    export_response = client.post(
        f"/api/v1/projects/{project['id']}/export",
        headers=auth_headers(session),
        json={"export_format": "json"},
    )
    assert export_response.status_code == 202
    export_id = export_response.json()["id"]

    run_customer_export_for_session(db_session, export_id=UUID(export_id))
    detail_response = client.get(f"/api/v1/exports/{export_id}", headers=auth_headers(session))

    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "completed"
    assert db_session.query(CustomerExport).count() == 1
    actions = {item.action for item in db_session.query(AuditLog).all()}
    assert "public_api_key_created" in actions or "customer_export_requested" in actions


def test_system_platform_and_debug_are_admin_only(client, db_session):
    admin = create_operator(db_session, email="admin@acme.test", is_system_admin=True)
    admin_session = sign_in(client, email=admin.email)
    operator = create_operator(db_session, email="viewer@acme.test")
    operator_session = sign_in(client, email=operator.email)

    organization = create_organization(client, admin_session, name="Debug Org", slug="debug-org")
    project = create_project(client, admin_session, organization["id"])
    db_session.add(
        OrganizationMember(
            organization_id=UUID(organization["id"]),
            user_id=operator.id,
            auth_user_id=str(operator.id),
            role="viewer",
        )
    )
    db_session.commit()

    denied = client.get("/api/v1/system/platform", headers=auth_headers(operator_session))
    allowed = client.get("/api/v1/system/platform", headers=auth_headers(admin_session))
    debug_allowed = client.get(f"/api/v1/system/debug/{project['id']}", headers=auth_headers(admin_session))

    assert denied.status_code == 403
    assert allowed.status_code == 200
    assert debug_allowed.status_code == 200
