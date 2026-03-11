from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.global_reliability_pattern import GlobalReliabilityPattern
from app.models.reliability_graph_edge import ReliabilityGraphEdge
from app.models.reliability_graph_node import ReliabilityGraphNode
from app.models.reliability_pattern import ReliabilityPattern
from app.processors.reliability_graph_processor import process_reliability_graph_event
from app.services.deployment_risk_engine import calculate_deployment_risk
from app.workers.reliability_graph_mining import run_reliability_graph_mining_for_session

from .test_api import auth_headers
from .test_incidents import _run_signal_pipeline
from .test_reliability_intelligence import _seed_intelligence_project


def _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse):
    class BorrowedSession:
        def __init__(self, session):
            self._session = session

        def __getattr__(self, name):
            return getattr(self._session, name)

        def close(self):
            return None

    import app.processors.reliability_graph_processor as reliability_graph_processor_module

    reliability_graph_processor_module.SessionLocal = lambda: BorrowedSession(db_session)
    session_payload, project, _, prompt_version, model_version = _seed_intelligence_project(client, db_session)
    from app.models.trace import Trace
    from app.models.incident import Incident

    for trace in db_session.scalars(select(Trace).where(Trace.project_id == UUID(project["id"]))).all():
        process_reliability_graph_event(
            {
                "trace_id": str(trace.id),
                "project_id": str(trace.project_id),
                "timestamp": trace.timestamp.isoformat(),
                "metadata": trace.metadata_json or {},
            },
            event_type="trace_ingested",
        )
        process_reliability_graph_event(
            {
                "trace_id": str(trace.id),
                "project_id": str(trace.project_id),
                "timestamp": trace.timestamp.isoformat(),
                "metadata": trace.metadata_json or {},
            },
            event_type="trace_evaluated",
        )
        _run_signal_pipeline(db_session, trace.id)

    incidents = db_session.scalars(select(Incident).where(Incident.project_id == UUID(project["id"]))).all()
    for incident in incidents:
        process_reliability_graph_event(
            {
                "incident_id": str(incident.id),
                "project_id": str(incident.project_id),
                "organization_id": str(incident.organization_id),
                "environment_id": str(incident.environment_id),
                "incident_type": incident.incident_type,
                "severity": incident.severity,
                "started_at": incident.started_at.isoformat(),
                "metadata": incident.summary_json or {},
            },
            event_type="incident_created",
        )
    return session_payload, project, prompt_version, model_version


def test_reliability_graph_creates_nodes_and_edges(client, db_session, fake_queue, fake_trace_warehouse):
    _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)

    nodes = db_session.scalars(select(ReliabilityGraphNode)).all()
    edges = db_session.scalars(select(ReliabilityGraphEdge)).all()

    assert any(node.node_type == "model_family" for node in nodes)
    assert any(node.node_type == "prompt_version" for node in nodes)
    assert any(edge.relationship_type == "model_to_prompt" for edge in edges)


def test_reliability_graph_mining_persists_patterns(client, db_session, fake_queue, fake_trace_warehouse):
    _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)

    run_reliability_graph_mining_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc).isoformat(),
    )

    pattern = db_session.scalar(
        select(ReliabilityPattern).where(ReliabilityPattern.pattern_type == "graph_correlation")
    )
    assert pattern is not None
    assert pattern.failure_probability > 0


def test_graph_patterns_endpoint_and_guardrail_recommendations(client, db_session, fake_queue, fake_trace_warehouse):
    session_payload, _, _, _ = _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)
    run_reliability_graph_mining_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc).isoformat(),
    )

    patterns = client.get("/api/v1/intelligence/high-risk-patterns", headers=auth_headers(session_payload))
    recommendations = client.get(
        "/api/v1/intelligence/guardrail-recommendations",
        headers=auth_headers(session_payload),
    )

    assert patterns.status_code == 200
    assert recommendations.status_code == 200
    assert patterns.json()["items"]
    assert recommendations.json()["items"]


def test_graph_integration_affects_deployment_risk(client, db_session, fake_queue, fake_trace_warehouse):
    session_payload, project, prompt_version, model_version = _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)
    run_reliability_graph_mining_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc).isoformat(),
    )

    response = client.post(
        f"/api/v1/projects/{project['id']}/deployments",
        headers=auth_headers(session_payload),
        json={
            "environment": "production",
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "deployed_by": "graph-test",
            "deployed_at": datetime(2026, 3, 10, 16, 0, tzinfo=timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 201
    risk = calculate_deployment_risk(db_session, deployment_id=UUID(response.json()["id"]))

    assert risk.analysis_json["graph_risk"]["risk_score"] >= 0
    assert "graph_risk" in risk.analysis_json


def test_system_global_intelligence_requires_admin(client, db_session, fake_queue, fake_trace_warehouse):
    session_payload, _, _, _ = _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)
    run_reliability_graph_mining_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc).isoformat(),
    )
    db_session.add(
        GlobalReliabilityPattern(
            pattern_id="global-test-pattern",
            pattern_type="model_failure",
            conditions_json={"model_family": "gpt-4.1-mini", "failure_type": "request_failure"},
            impact_metrics_json={
                "description": "gpt-4.1-mini shows elevated request failure patterns",
                "impact": "10 matching failures across 2 organizations with 40% average failure probability",
                "recommended_guardrails": ["structured_output"],
            },
            occurrence_count=10,
            organizations_affected=2,
            confidence_score=0.61,
            created_at=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc),
        )
    )
    db_session.commit()
    from .test_api import create_operator, sign_in

    operator = create_operator(db_session, email="system-admin@acme.test", is_system_admin=True)
    admin_session = sign_in(client, email=operator.email)

    forbidden = client.get("/api/v1/system/global-intelligence", headers=auth_headers(session_payload))
    allowed = client.get("/api/v1/system/global-intelligence", headers=auth_headers(admin_session))

    assert forbidden.status_code == 403
    assert allowed.status_code == 200
    assert allowed.json()["items"]
