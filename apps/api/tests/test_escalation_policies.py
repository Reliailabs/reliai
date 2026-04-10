from uuid import UUID

from app.models.org_escalation_policy import OrgEscalationPolicy, OrgEscalationPolicyStep

from .test_api import auth_headers, create_operator, create_organization, sign_in


def test_escalation_policies_endpoint(client, db_session):
    operator = create_operator(db_session, email="policy-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Policy Org", slug="policy-org")

    policy = OrgEscalationPolicy(
        organization_id=UUID(organization["id"]),
        name="Default Policy",
        description="Notify primary on-call",
        trigger_severity="all",
        unacknowledged_after_minutes=0,
        enabled=True,
    )
    db_session.add(policy)
    db_session.flush()
    step = OrgEscalationPolicyStep(
        policy_id=policy.id,
        step_number=1,
        delay_minutes=0,
        action="notify",
        channel="slack",
        target="#on-call",
    )
    db_session.add(step)
    db_session.commit()

    response = client.get(
        f"/api/v1/organizations/{organization['id']}/escalation-policies",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert payload["items"][0]["name"] == "Default Policy"


def test_escalation_policies_isolated(client, db_session):
    owner_one = create_operator(db_session, email="policy-owner-one@acme.test")
    owner_one_session = sign_in(client, email=owner_one.email)
    _ = create_organization(client, owner_one_session, name="Policy Org One", slug="policy-org-one")

    owner_two = create_operator(db_session, email="policy-owner-two@beta.test")
    owner_two_session = sign_in(client, email=owner_two.email)
    org_two = create_organization(client, owner_two_session, name="Policy Org Two", slug="policy-org-two")

    response = client.get(
        f"/api/v1/organizations/{org_two['id']}/escalation-policies",
        headers=auth_headers(owner_one_session),
    )

    assert response.status_code == 403
