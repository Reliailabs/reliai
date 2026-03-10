from uuid import UUID

from sqlalchemy import select

from app.models.regression_snapshot import RegressionSnapshot
from app.services.incidents import (
    build_cohort_pivots,
    build_trace_diff_blocks,
    derive_dimension_summaries,
    derive_root_cause_hints,
    get_incident_compare_traces,
    get_incident_representative_traces,
)
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
    assert compare["current_representative_traces"]
    assert compare["baseline_representative_traces"]
    assert compare["trace_compare_path"] == f"/incidents/{incident.id}/compare"


def test_incident_trace_compare_endpoint_is_tenant_safe(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pairs"]
    assert payload["current_traces"]
    assert payload["baseline_traces"]

    outsider = create_operator(db_session, email="compare-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 404


def test_regression_compare_endpoint_is_tenant_safe(client, db_session, fake_queue):
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
        f"/api/v1/regressions/{regression.id}/compare",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["comparison_scope"] == "regression"
    assert payload["source_id"] == str(regression.id)
    assert payload["pairs"]
    assert payload["dimension_summaries"]
    assert payload["cohort_pivots"]

    outsider = create_operator(db_session, email="regression-compare-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/regressions/{regression.id}/compare",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 403


def test_representative_trace_selection_behavior(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    representative_traces = get_incident_representative_traces(db_session, incident)

    assert representative_traces
    assert len(representative_traces) <= 5
    assert any(trace.success is False for trace in representative_traces)


def test_deterministic_hint_generation(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    current_traces, baseline_traces = get_incident_compare_traces(db_session, incident)

    hints = derive_root_cause_hints(
        incident=incident,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )

    assert hints
    hint_types = {hint["hint_type"] for hint in hints}
    assert "failure_cluster" in hint_types or "time_cluster" in hint_types


def test_focused_diff_block_generation(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    current_traces, baseline_traces = get_incident_compare_traces(db_session, incident)

    diff_blocks = build_trace_diff_blocks(current_traces[0], baseline_traces[0])
    block_types = {block["block_type"] for block in diff_blocks}
    assert {
        "model_prompt",
        "outcome",
        "performance",
        "structured_output",
        "retrieval",
        "metadata_scalar",
    }.issubset(block_types)
    assert any(block["changed"] for block in diff_blocks)


def test_dimension_summary_generation(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    current_traces, baseline_traces = get_incident_compare_traces(db_session, incident)

    summaries = derive_dimension_summaries(
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )
    summary_types = {summary["summary_type"] for summary in summaries}
    assert "top_prompt_version" in summary_types
    assert "top_model_name" in summary_types
    assert "structured_output_failure_concentration" in summary_types


def test_cohort_pivot_query_construction(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    current_traces, _ = get_incident_compare_traces(db_session, incident)
    summary = incident.summary_json

    pivots = build_cohort_pivots(
        project_id=incident.project_id,
        scope_type=summary.get("scope_type"),
        scope_id=summary.get("scope_id"),
        current_window_start=None,
        current_window_end=None,
        anchor_time=incident.started_at,
        current_traces=current_traces,
    )

    assert pivots
    assert all(pivot["path"].startswith("/traces?") for pivot in pivots)
    assert any(pivot["pivot_type"] == "failing_current_window" for pivot in pivots)


def test_regression_detail_enhanced_payload(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    response = client.get(
        f"/api/v1/incidents/{incident.id}",
        headers=auth_headers(owner_session),
    )
    regression_id = response.json()["compare"]["regressions"][0]["id"]

    detail = client.get(
        f"/api/v1/regressions/{regression_id}",
        headers=auth_headers(owner_session),
    )
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["current_representative_traces"]
    assert payload["baseline_representative_traces"]
    assert payload["dimension_summaries"]
    assert payload["cohort_pivots"]
    assert payload["prompt_version_contexts"]
    assert payload["model_version_contexts"]
    assert payload["trace_compare_path"] == f"/regressions/{regression_id}/compare"


def test_trace_detail_and_compare_enriched_payload(client, db_session, fake_queue):
    owner_session, _, _, latest_trace_id = _seed_success_rate_regression(client, db_session)

    trace_detail = client.get(
        f"/api/v1/traces/{latest_trace_id}",
        headers=auth_headers(owner_session),
    )
    assert trace_detail.status_code == 200
    detail_payload = trace_detail.json()
    assert detail_payload["prompt_version_record"] is not None
    assert detail_payload["model_version_record"] is not None
    assert detail_payload["registry_pivots"]
    assert detail_payload["compare_path"] == f"/traces/{latest_trace_id}/compare"

    trace_compare = client.get(
        f"/api/v1/traces/{latest_trace_id}/compare",
        headers=auth_headers(owner_session),
    )
    assert trace_compare.status_code == 200
    compare_payload = trace_compare.json()
    assert compare_payload["comparison_scope"] == "trace"
    assert compare_payload["pairs"]
    assert compare_payload["prompt_version_contexts"]
    assert compare_payload["model_version_contexts"]
