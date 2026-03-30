import json

from app.services import ai_root_cause_explanation

from .test_api import auth_headers
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_ai_root_cause_explanation_returns_explanation(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    def fake_call_openai_compatible(*_args, **_kwargs):
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "explanation": "Trace evidence points to a prompt change that shifted outputs.",
                                "what_to_check_next": "Review the diff between baseline and failing prompts.",
                                "evidence_used": ["this should be ignored"],
                            }
                        )
                    }
                }
            ]
        }

    monkeypatch.setattr(ai_root_cause_explanation, "call_openai_compatible", fake_call_openai_compatible)
    monkeypatch.setattr(
        ai_root_cause_explanation,
        "_build_evidence",
        lambda *_args, **_kwargs: ai_root_cause_explanation.EvidenceBundle(
            lines=[
                "Root cause signal (Prompt update, 71% confidence)",
                "Prompt diff (v42 → v41)",
            ],
            refs=["root_cause", "prompt_diff"],
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-root-cause",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["explanation"] == "Trace evidence points to a prompt change that shifted outputs."
    assert payload["what_to_check_next"] == "Review the diff between baseline and failing prompts."
    assert payload["evidence_used"] == [
        "Root cause signal (Prompt update, 71% confidence)",
        "Prompt diff (v42 → v41)",
    ]

    events = client.get(
        f"/api/v1/incidents/{incident.id}/events", headers=auth_headers(owner_session)
    )
    assert events.status_code == 200
    assert any(item["event_type"] == "ai_root_cause_explanation_generated" for item in events.json()["items"])


def test_ai_root_cause_explanation_insufficient_evidence(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    monkeypatch.setattr(
        ai_root_cause_explanation,
        "_build_evidence",
        lambda *_args, **_kwargs: ai_root_cause_explanation.EvidenceBundle(
            lines=["Root cause signal (Prompt update, 71% confidence)"], refs=["root_cause"]
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-root-cause",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "insufficient_evidence"
