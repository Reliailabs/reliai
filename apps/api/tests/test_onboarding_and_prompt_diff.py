from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.models.deployment_simulation import DeploymentSimulation
from app.models.incident import Incident
from app.models.prompt_version import PromptVersion
from app.models.trace import Trace
from app.services import onboarding_simulations as onboarding_simulations_service
from .conftest import BorrowedSession
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_operator_project(client, db_session, *, email: str, slug: str):
    operator = create_operator(db_session, email=email)
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug=slug)
    project = create_project(client, session_payload, organization["id"], name="Support Copilot")
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, project, api_key


def _seed_prompt_versions_for_diff(client, db_session):
    session_payload, project, api_key = _seed_operator_project(
        client,
        db_session,
        email="prompt-diff-owner@acme.test",
        slug="prompt-diff-org",
    )

    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "prompt_diff_seed_v17",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v17",
            "success": True,
            "output_text": "{\"ok\": true}",
            "metadata_json": {"expected_output_format": "json"},
        },
    )
    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:05:00Z",
            "request_id": "prompt_diff_seed_v18",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v18",
            "success": False,
            "error_type": "provider_error",
            "output_text": "refusal",
            "metadata_json": {"expected_output_format": "json"},
        },
    )

    v17 = db_session.query(PromptVersion).filter(PromptVersion.project_id == UUID(project["id"]), PromptVersion.version == "v17").one()
    v18 = db_session.query(PromptVersion).filter(PromptVersion.project_id == UUID(project["id"]), PromptVersion.version == "v18").one()
    v17.notes = "System: assist users\nAnswer directly."
    v18.notes = "System: strict policy checks\nPrefer refusal when uncertain."
    db_session.add(v17)
    db_session.add(v18)
    db_session.commit()
    return session_payload, v17, v18


def _seed_incident_compare_case(
    client,
    db_session,
    *,
    email: str,
    slug: str,
    baseline_versions: list[str | None],
    current_versions: list[str | None],
):
    session_payload, project, api_key = _seed_operator_project(
        client,
        db_session,
        email=email,
        slug=slug,
    )

    baseline_start = datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc)
    current_start = datetime(2026, 3, 9, 13, 0, tzinfo=timezone.utc)
    accepted_trace_ids: list[UUID] = []

    for index, version in enumerate(baseline_versions):
        accepted = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"incident_compare_baseline_{slug}_{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": version,
                "success": True,
                "output_text": "{\"ok\": true}",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        accepted_trace_ids.append(UUID(accepted["trace_id"]))

    for index, version in enumerate(current_versions):
        accepted = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (current_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"incident_compare_current_{slug}_{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": version,
                "success": index >= 2,
                "error_type": None if index >= 2 else "provider_error",
                "output_text": "refusal" if index < 2 else "{\"ok\": true}",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        accepted_trace_ids.append(UUID(accepted["trace_id"]))

    for prompt_version in set(version for version in [*baseline_versions, *current_versions] if version):
        record = (
            db_session.query(PromptVersion)
            .filter(PromptVersion.project_id == UUID(project["id"]), PromptVersion.version == prompt_version)
            .one()
        )
        record.notes = f"System prompt for {prompt_version}\nPolicy mode {prompt_version}"
        db_session.add(record)
    db_session.commit()

    first_trace = db_session.get(Trace, accepted_trace_ids[0])
    assert first_trace is not None
    incident = Incident(
        organization_id=first_trace.organization_id,
        project_id=first_trace.project_id,
        environment_id=first_trace.environment_id,
        deployment_id=None,
        incident_type="success_rate_drop",
        severity="high",
        title="Seeded incident compare regression",
        status="open",
        fingerprint=f"incident-compare:{slug}",
        summary_json={
            "metric_name": "success_rate",
            "scope_type": "project",
            "scope_id": project["id"],
            "current_window_start": current_start.isoformat(),
            "current_window_end": (current_start + timedelta(minutes=30)).isoformat(),
            "baseline_window_start": baseline_start.isoformat(),
            "baseline_window_end": (baseline_start + timedelta(minutes=30)).isoformat(),
            "sample_trace_ids": [str(trace_id) for trace_id in accepted_trace_ids[:5]],
        },
        started_at=current_start + timedelta(minutes=25),
        updated_at=current_start + timedelta(minutes=25),
        resolved_at=None,
        acknowledged_at=None,
        acknowledged_by_operator_user_id=None,
        owner_operator_user_id=None,
    )
    db_session.add(incident)
    db_session.commit()
    db_session.refresh(incident)
    return session_payload, incident


def test_prompt_diff_endpoint_returns_line_level_diff(client, db_session, fake_queue):
    session_payload, from_version, to_version = _seed_prompt_versions_for_diff(client, db_session)

    response = client.get(
        f"/api/v1/prompts/diff?fromVersionId={from_version.id}&toVersionId={to_version.id}",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["from_version"]["id"] == str(from_version.id)
    assert payload["to_version"]["id"] == str(to_version.id)
    assert isinstance(payload["diff"], list)
    assert any(row["type"] in {"added", "removed"} for row in payload["diff"])


def test_prompt_diff_endpoint_returns_404_for_missing_versions(client, db_session, fake_queue):
    session_payload, _, _ = _seed_prompt_versions_for_diff(client, db_session)
    missing_id = uuid4()

    response = client.get(
        f"/api/v1/prompts/diff?fromVersionId={missing_id}&toVersionId={missing_id}",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Prompt versions not found"


def test_onboarding_simulation_create_endpoint_creates_record(client, db_session, fake_queue, monkeypatch):
    session_payload, _, _ = _seed_operator_project(
        client,
        db_session,
        email="simulation-owner@acme.test",
        slug="simulation-org",
    )
    monkeypatch.setattr("app.api.v1.routes.run_onboarding_simulation", lambda simulation_id: None)

    response = client.post(
        "/api/v1/onboarding/simulations",
        headers=auth_headers(session_payload),
        json={
            "project_name": "Quickstart Project",
            "model_name": "gpt-4.1-mini",
            "prompt_type": "support_triage",
            "simulation_type": "refusal_spike",
        },
    )

    assert response.status_code == 200
    simulation_id = UUID(response.json()["simulation_id"])
    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None
    assert simulation.analysis_json["status"] == "pending"
    assert simulation.analysis_json["model_name"] == "gpt-4.1-mini"
    assert simulation.analysis_json["prompt_type"] == "support_triage"


def test_onboarding_simulation_status_endpoint_returns_contract(client, db_session, fake_queue, monkeypatch):
    session_payload, _, _ = _seed_operator_project(
        client,
        db_session,
        email="simulation-status-owner@acme.test",
        slug="simulation-status-org",
    )
    monkeypatch.setattr("app.api.v1.routes.run_onboarding_simulation", lambda simulation_id: None)

    create_response = client.post(
        "/api/v1/onboarding/simulations",
        headers=auth_headers(session_payload),
        json={"simulation_type": "refusal_spike"},
    )
    simulation_id = UUID(create_response.json()["simulation_id"])
    incident_id = uuid4()

    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None
    simulation.analysis_json = {
        "status": "complete",
        "progress": 100,
        "stage": "complete",
        "incident_id": str(incident_id),
    }
    db_session.add(simulation)
    db_session.commit()

    status_response = client.get(
        f"/api/v1/onboarding/simulations/{simulation_id}/status",
        headers=auth_headers(session_payload),
    )

    assert status_response.status_code == 200
    payload = status_response.json()
    assert payload["simulation_id"] == str(simulation_id)
    assert payload["status"] == "complete"
    assert payload["progress"] == 100
    assert payload["stage"] == "complete"
    assert payload["incident_id"] == str(incident_id)


def test_onboarding_simulation_runner_marks_failed_when_incident_and_fallback_missing(
    client,
    db_session,
    fake_queue,
    monkeypatch,
):
    session_payload, _, _ = _seed_operator_project(
        client,
        db_session,
        email="simulation-fail-owner@acme.test",
        slug="simulation-fail-org",
    )
    monkeypatch.setattr("app.api.v1.routes.run_onboarding_simulation", lambda simulation_id: None)

    create_response = client.post(
        "/api/v1/onboarding/simulations",
        headers=auth_headers(session_payload),
        json={"simulation_type": "refusal_spike"},
    )
    simulation_id = UUID(create_response.json()["simulation_id"])

    monkeypatch.setattr(onboarding_simulations_service, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(onboarding_simulations_service, "run_trace_regression_detection", lambda trace_id: None)
    monkeypatch.setattr(
        onboarding_simulations_service,
        "_create_fallback_incident",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("fallback unavailable")),
    )

    onboarding_simulations_service.run_onboarding_simulation(simulation_id)

    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None
    assert simulation.analysis_json["status"] == "failed"
    assert simulation.analysis_json["stage"] == "failed"
    assert "fallback" in simulation.analysis_json["error"].lower()


def test_onboarding_simulation_runner_creates_fallback_incident_when_detection_misses(
    client,
    db_session,
    fake_queue,
    monkeypatch,
):
    session_payload, _, _ = _seed_operator_project(
        client,
        db_session,
        email="simulation-fallback-owner@acme.test",
        slug="simulation-fallback-org",
    )
    monkeypatch.setattr("app.api.v1.routes.run_onboarding_simulation", lambda simulation_id: None)

    create_response = client.post(
        "/api/v1/onboarding/simulations",
        headers=auth_headers(session_payload),
        json={"simulation_type": "refusal_spike"},
    )
    simulation_id = UUID(create_response.json()["simulation_id"])

    monkeypatch.setattr(onboarding_simulations_service, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(onboarding_simulations_service, "run_trace_regression_detection", lambda trace_id: None)

    onboarding_simulations_service.run_onboarding_simulation(simulation_id)

    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None
    assert simulation.analysis_json["status"] == "complete"
    fallback_incident_id = simulation.analysis_json.get("incident_id")
    assert fallback_incident_id is not None

    fallback_incident = db_session.get(Incident, UUID(str(fallback_incident_id)))
    assert fallback_incident is not None
    assert fallback_incident.summary_json.get("source") == "onboarding_simulation_fallback"


def test_incident_compare_returns_prompt_contexts_when_traces_have_prompt_version_ids(client, db_session, fake_queue):
    session_payload, incident = _seed_incident_compare_case(
        client,
        db_session,
        email="incident-compare-prompts-owner@acme.test",
        slug="incident-compare-prompts",
        baseline_versions=["v17", "v17", "v17"],
        current_versions=["v18", "v18", "v18"],
    )

    response = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    contexts = payload["prompt_version_contexts"]
    assert [context["version"] for context in contexts[:2]] == ["v18", "v17"]


def test_incident_compare_falls_back_gracefully_when_only_one_prompt_version_exists(client, db_session, fake_queue):
    session_payload, incident = _seed_incident_compare_case(
        client,
        db_session,
        email="incident-compare-single-owner@acme.test",
        slug="incident-compare-single",
        baseline_versions=["v18", "v18", "v18"],
        current_versions=["v18", "v18", "v18"],
    )

    response = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["prompt_version_contexts"]) == 1
    assert payload["prompt_version_contexts"][0]["version"] == "v18"


def test_incident_compare_returns_empty_prompt_contexts_when_evidence_is_insufficient(client, db_session, fake_queue):
    session_payload, incident = _seed_incident_compare_case(
        client,
        db_session,
        email="incident-compare-empty-owner@acme.test",
        slug="incident-compare-empty",
        baseline_versions=[None, None, None],
        current_versions=[None, None, None],
    )

    response = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    assert response.json()["prompt_version_contexts"] == []


def test_onboarding_simulation_incident_compare_includes_prompt_contexts(client, db_session, fake_queue, monkeypatch):
    session_payload, _, _ = _seed_operator_project(
        client,
        db_session,
        email="simulation-compare-owner@acme.test",
        slug="simulation-compare-org",
    )
    monkeypatch.setattr("app.api.v1.routes.run_onboarding_simulation", lambda simulation_id: None)

    create_response = client.post(
        "/api/v1/onboarding/simulations",
        headers=auth_headers(session_payload),
        json={"simulation_type": "refusal_spike"},
    )
    simulation_id = UUID(create_response.json()["simulation_id"])

    def _fake_regression_detection(trace_id: str) -> None:
        simulation_row = db_session.get(DeploymentSimulation, simulation_id)
        assert simulation_row is not None
        incident = Incident(
            organization_id=simulation_row.project.organization_id,
            project_id=simulation_row.project_id,
            environment_id=simulation_row.environment_id,
            deployment_id=None,
            incident_type="success_rate_drop",
            severity="high",
            title="Onboarding simulation incident",
            status="open",
            fingerprint=f"simulation:{simulation_id}",
            summary_json={"metric_name": "success_rate"},
            started_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            resolved_at=None,
            acknowledged_at=None,
            acknowledged_by_operator_user_id=None,
            owner_operator_user_id=None,
        )
        db_session.add(incident)
        db_session.commit()

    monkeypatch.setattr(onboarding_simulations_service, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(onboarding_simulations_service, "run_trace_regression_detection", _fake_regression_detection)

    onboarding_simulations_service.run_onboarding_simulation(simulation_id)

    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None
    incident_id = simulation.analysis_json.get("incident_id")
    assert incident_id is not None

    response = client.get(
        f"/api/v1/incidents/{incident_id}/compare",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert [context["version"] for context in payload["prompt_version_contexts"][:2]] == ["v18", "v17"]


def test_prompt_diff_inputs_remain_compatible_with_incident_compare_output(client, db_session, fake_queue):
    session_payload, incident = _seed_incident_compare_case(
        client,
        db_session,
        email="incident-compare-diff-owner@acme.test",
        slug="incident-compare-diff",
        baseline_versions=["v17", "v17", "v17"],
        current_versions=["v18", "v18", "v18"],
    )

    compare_response = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(session_payload),
    )
    assert compare_response.status_code == 200
    compare_payload = compare_response.json()
    prompt_contexts = compare_payload["prompt_version_contexts"]
    assert len(prompt_contexts) >= 2

    diff_response = client.get(
        f"/api/v1/prompts/diff?fromVersionId={prompt_contexts[1]['id']}&toVersionId={prompt_contexts[0]['id']}",
        headers=auth_headers(session_payload),
    )

    assert diff_response.status_code == 200
    diff_payload = diff_response.json()
    assert diff_payload["from_version"]["id"] == prompt_contexts[1]["id"]
    assert diff_payload["to_version"]["id"] == prompt_contexts[0]["id"]


def test_onboarding_simulation_runner_triggers_regression_and_completes(client, db_session, fake_queue, monkeypatch):
    session_payload, _, _ = _seed_operator_project(
        client,
        db_session,
        email="simulation-complete-owner@acme.test",
        slug="simulation-complete-org",
    )
    monkeypatch.setattr("app.api.v1.routes.run_onboarding_simulation", lambda simulation_id: None)

    create_response = client.post(
        "/api/v1/onboarding/simulations",
        headers=auth_headers(session_payload),
        json={"simulation_type": "refusal_spike"},
    )
    simulation_id = UUID(create_response.json()["simulation_id"])

    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None

    observed = {"triggered_trace_id": None}

    def _fake_regression_detection(trace_id: str) -> None:
        observed["triggered_trace_id"] = trace_id
        simulation_row = db_session.get(DeploymentSimulation, simulation_id)
        assert simulation_row is not None
        incident = Incident(
            organization_id=simulation_row.project.organization_id,
            project_id=simulation_row.project_id,
            environment_id=simulation_row.environment_id,
            deployment_id=None,
            incident_type="success_rate_drop",
            severity="high",
            title="Onboarding simulation incident",
            status="open",
            fingerprint=f"simulation:{simulation_id}",
            summary_json={"metric_name": "success_rate"},
            started_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            resolved_at=None,
            acknowledged_at=None,
            acknowledged_by_operator_user_id=None,
            owner_operator_user_id=None,
        )
        db_session.add(incident)
        db_session.commit()

    monkeypatch.setattr(onboarding_simulations_service, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(onboarding_simulations_service, "run_trace_regression_detection", _fake_regression_detection)

    onboarding_simulations_service.run_onboarding_simulation(simulation_id)

    simulation = db_session.get(DeploymentSimulation, simulation_id)
    assert simulation is not None
    assert observed["triggered_trace_id"] is not None
    assert simulation.analysis_json["status"] == "complete"
    assert simulation.analysis_json["stage"] == "complete"
    assert simulation.analysis_json.get("incident_id")
