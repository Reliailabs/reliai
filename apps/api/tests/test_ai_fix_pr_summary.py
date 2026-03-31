import json

from app.services import ai_fix_pr_summary
from app.services.incidents import INCIDENT_EVENT_CONFIG_APPLIED

from .test_api import auth_headers
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def _patch_settings_openai(monkeypatch):
    """Force ai_provider=openai so tests exercise the openai code path."""
    import types

    fake_settings = types.SimpleNamespace(
        ai_provider="openai",
        openai_model="gpt-4.1-mini",
        openai_api_base="https://api.openai.com/v1",
        openai_api_key="test-key",
    )
    monkeypatch.setattr(ai_fix_pr_summary, "get_settings", lambda: fake_settings)


def _add_fix_event(db_session, incident):
    """Attach a config_applied event to the incident."""
    from app.models.incident_event import IncidentEvent

    event = IncidentEvent(
        incident_id=incident.id,
        event_type=INCIDENT_EVENT_CONFIG_APPLIED,
        metadata_json={"reason": "Reverted prompt v42 to v41"},
    )
    db_session.add(event)
    db_session.commit()
    return event


def _fake_openai_response(title: str, summary: str, change_applied: str, impact_observed: str):
    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "title": title,
                            "summary": summary,
                            "change_applied": change_applied,
                            "impact_observed": impact_observed,
                            "evidence_used": ["fake injected evidence"],
                        }
                    )
                }
            }
        ]
    }


def test_ai_fix_pr_summary_uses_deterministic_evidence(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    _add_fix_event(db_session, incident)
    _patch_settings_openai(monkeypatch)

    monkeypatch.setattr(
        ai_fix_pr_summary,
        "call_openai_compatible",
        lambda *_a, **_kw: _fake_openai_response(
            "Fix: reverted prompt",
            "Incident resolved by prompt rollback.",
            "Reverted prompt v42 to v41.",
            "Failure rate reduced.",
        ),
    )
    monkeypatch.setattr(
        ai_fix_pr_summary,
        "_build_evidence",
        lambda *_a, **_kw: ai_fix_pr_summary.EvidenceBundle(
            lines=[
                "Fix applied: Reverted prompt v42 to v41",
                "Root cause signal: Prompt update",
                "Resolution impact: success rate improved from 0.20 to 0.91",
            ],
            refs=["fix_event", "root_cause", "resolution_impact"],
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    # evidence_used must be from deterministic evidence, never from LLM output
    assert payload["evidence_used"] == [
        "Fix applied: Reverted prompt v42 to v41",
        "Root cause signal: Prompt update",
        "Resolution impact: success rate improved from 0.20 to 0.91",
    ]
    assert "fake injected evidence" not in payload["evidence_used"]
    assert payload["title"] == "Fix: reverted prompt"
    assert payload["summary"] == "Incident resolved by prompt rollback."


def test_ai_fix_pr_summary_insufficient_evidence_no_fix_event(client, db_session, monkeypatch):
    """Without a config_applied/undone event the service must return insufficient_evidence."""
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    # deliberately do NOT add a fix event

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "insufficient_evidence"
    assert payload["title"] is None
    assert payload["summary"] is None


def test_ai_fix_pr_summary_insufficient_evidence_weak_bundle(client, db_session, monkeypatch):
    """A fix event exists but evidence bundle is below minimum threshold."""
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    _add_fix_event(db_session, incident)

    monkeypatch.setattr(
        ai_fix_pr_summary,
        "_build_evidence",
        lambda *_a, **_kw: ai_fix_pr_summary.EvidenceBundle(
            lines=["Fix applied: config update"],
            refs=["fix_event"],
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "insufficient_evidence"


def test_ai_fix_pr_summary_omits_impact_when_missing(client, db_session, monkeypatch):
    """When resolution impact is absent the LLM must say impact is not verified."""
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    _add_fix_event(db_session, incident)
    _patch_settings_openai(monkeypatch)

    monkeypatch.setattr(
        ai_fix_pr_summary,
        "call_openai_compatible",
        lambda *_a, **_kw: _fake_openai_response(
            "Fix applied",
            "Config update applied.",
            "Prompt rolled back.",
            "post-fix impact not yet verified",
        ),
    )
    monkeypatch.setattr(
        ai_fix_pr_summary,
        "_build_evidence",
        lambda *_a, **_kw: ai_fix_pr_summary.EvidenceBundle(
            lines=[
                "Fix applied: Reverted prompt",
                "Root cause signal: Prompt update",
            ],
            refs=["fix_event", "root_cause"],
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "verified" in (payload["impact_observed"] or "").lower()


def test_ai_fix_pr_summary_output_length_caps(client, db_session, monkeypatch):
    """Title, summary, change_applied, and impact_observed must be capped."""
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    _add_fix_event(db_session, incident)
    _patch_settings_openai(monkeypatch)

    monkeypatch.setattr(
        ai_fix_pr_summary,
        "call_openai_compatible",
        lambda *_a, **_kw: _fake_openai_response(
            "t" * 200,
            "s" * 700,
            "c" * 500,
            "i" * 500,
        ),
    )
    monkeypatch.setattr(
        ai_fix_pr_summary,
        "_build_evidence",
        lambda *_a, **_kw: ai_fix_pr_summary.EvidenceBundle(
            lines=["Fix applied: x", "Root cause: y"],
            refs=["fix_event", "root_cause"],
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["title"]) <= 120
    assert len(payload["summary"]) <= 600
    assert len(payload["change_applied"]) <= 400
    assert len(payload["impact_observed"]) <= 400


def test_ai_fix_pr_summary_regenerate_bypasses_cache(client, db_session, monkeypatch):
    """regenerate=True must bypass the cache and call the AI provider."""
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    _add_fix_event(db_session, incident)
    _patch_settings_openai(monkeypatch)

    call_count = {"n": 0}

    def fake_call(*_a, **_kw):
        call_count["n"] += 1
        return _fake_openai_response("Title", "Summary.", "Change.", "Impact.")

    monkeypatch.setattr(ai_fix_pr_summary, "call_openai_compatible", fake_call)
    monkeypatch.setattr(
        ai_fix_pr_summary,
        "_build_evidence",
        lambda *_a, **_kw: ai_fix_pr_summary.EvidenceBundle(
            lines=["Fix applied: x", "Root cause: y"],
            refs=["fix_event", "root_cause"],
        ),
    )

    client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    client.post(
        f"/api/v1/incidents/{incident.id}/ai-fix-summary",
        headers=auth_headers(owner_session),
        json={"regenerate": True},
    )
    assert call_count["n"] == 2
