from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models.environment import Environment
from app.models.evaluation import Evaluation
from app.models.trace import Trace
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE
from app.tests.test_api import (
    auth_headers,
    create_operator,
    create_organization,
    create_project,
    sign_in,
)


def _create_trace(db_session, *, organization_id: UUID, project_id: UUID, environment: Environment, timestamp: datetime):
    trace = Trace(
        organization_id=organization_id,
        project_id=project_id,
        environment_id=environment.id,
        environment=environment.name,
        timestamp=timestamp,
        request_id=str(uuid4()),
        trace_id=str(uuid4()),
        span_id=str(uuid4()),
        model_name="gpt-4.1",
        success=True,
    )
    db_session.add(trace)
    db_session.flush()
    return trace


def _create_evaluation(db_session, *, trace: Trace, project_id: UUID, created_at: datetime):
    evaluation = Evaluation(
        trace_id=trace.id,
        project_id=project_id,
        eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
        score=Decimal("1.0"),
        label="pass",
        created_at=created_at,
    )
    db_session.add(evaluation)


def test_org_evaluation_usage_counts_daily(client, db_session):
    operator = create_operator(db_session, email="eval-usage-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)

    organization = create_organization(client, session_payload, name="Eval Usage Org", slug="eval-usage-org")
    project = create_project(client, session_payload, organization["id"], name="Eval Usage Project")

    environment = db_session.scalar(
        select(Environment).where(Environment.project_id == UUID(project["id"]))
    )
    assert environment is not None

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    today = now
    yesterday = now - timedelta(days=1)

    trace_today = _create_trace(
        db_session,
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment=environment,
        timestamp=today,
    )
    _create_evaluation(db_session, trace=trace_today, project_id=UUID(project["id"]), created_at=today)
    _create_evaluation(db_session, trace=trace_today, project_id=UUID(project["id"]), created_at=today)

    trace_yesterday = _create_trace(
        db_session,
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment=environment,
        timestamp=yesterday,
    )
    _create_evaluation(db_session, trace=trace_yesterday, project_id=UUID(project["id"]), created_at=yesterday)

    other_operator = create_operator(db_session, email="eval-usage-owner-2@acme.test")
    other_session = sign_in(client, email=other_operator.email)
    other_org = create_organization(client, other_session, name="Other Org", slug="other-eval-org")
    other_project = create_project(client, other_session, other_org["id"], name="Other Project")
    other_environment = db_session.scalar(
        select(Environment).where(Environment.project_id == UUID(other_project["id"]))
    )
    assert other_environment is not None

    other_trace = _create_trace(
        db_session,
        organization_id=UUID(other_org["id"]),
        project_id=UUID(other_project["id"]),
        environment=other_environment,
        timestamp=today,
    )
    _create_evaluation(
        db_session,
        trace=other_trace,
        project_id=UUID(other_project["id"]),
        created_at=today,
    )

    db_session.commit()

    response = client.get(
        f"/api/v1/organizations/{organization['id']}/evaluation-usage?window_days=2",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["window_days"] == 2
    assert payload["total"] == 3
    assert payload["used_today"] == 2
    assert payload["limit"] is None
    assert payload["percent_used"] is None

    daily = payload["daily"]
    assert len(daily) == 2
    assert daily[0]["date"] == (yesterday.date().isoformat())
    assert daily[0]["count"] == 1
    assert daily[1]["date"] == (today.date().isoformat())
    assert daily[1]["count"] == 2
