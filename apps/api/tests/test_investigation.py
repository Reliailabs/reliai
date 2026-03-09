from uuid import UUID

from sqlalchemy import select

from app.models.regression_snapshot import RegressionSnapshot
from app.services.incidents import get_incident_representative_traces
from .test_api import auth_headers, create_operator, sign_in
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_regression_detail_reads_with_related_incident(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    regression = db_session.scalar(
        select(RegressionSnapshot).where(
            RegressionSnapshot.project_id == UUID(project["id"]),
            RegressionSnapshot.metric_name == "success_rate",
            RegressionSnapshot.scope_type == "project",
        )
    )
    assert regression is not None

    response = client.get(
        f"/api/v1/regressions/{regression.id}",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    assert response.json()["metric_name"] == "success_rate"
    assert response.json()["related_incident"] is not None


def test_tenant_safe_project_listing(client, db_session, fake_queue):
    owner_session, organization, project, _ = _seed_success_rate_regression(client, db_session)

    owner_projects = client.get(
        f"/api/v1/projects?organization_id={organization['id']}",
        headers=auth_headers(owner_session),
    )
    assert owner_projects.status_code == 200
    assert any(item["id"] == project["id"] for item in owner_projects.json()["items"])

    outsider = create_operator(db_session, email="project-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/projects?organization_id={organization['id']}",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 403


def test_incident_compare_data_shape(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    compare = response.json()["compare"]
    assert compare["regressions"]
    assert compare["rule_context"] is not None
    assert compare["current_window_start"] is not None
    assert compare["baseline_window_start"] is not None


def test_representative_trace_selection_behavior(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    representative_traces = get_incident_representative_traces(db_session, incident)

    assert representative_traces
    assert len(representative_traces) <= 5
    assert any(trace.success is False for trace in representative_traces)
