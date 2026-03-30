import json

from app.services import ai_incident_summary

from .test_api import auth_headers
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_ai_summary_endpoint_returns_summary(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    def fake_call_openai_compatible(*_args, **_kwargs):
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "summary": "Failure rate increased after the latest prompt rollout.",
                                "recommended_next_step": "Revert to the previous prompt version and monitor.",
                                "evidence_used": [
                                    "Metric delta (success rate current 0.20 vs baseline 0.95)",
                                    "Root cause signal (Prompt update, 71% confidence)",
                                ],
                            }
                        )
                    }
                }
            ]
        }

    monkeypatch.setattr(ai_incident_summary, "_call_openai_compatible", fake_call_openai_compatible)

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["summary"] == "Failure rate increased after the latest prompt rollout."
    assert payload["recommended_next_step"] == "Revert to the previous prompt version and monitor."

    events = client.get(
        f"/api/v1/incidents/{incident.id}/events", headers=auth_headers(owner_session)
    )
    assert events.status_code == 200
    assert any(item["event_type"] == "ai_summary_generated" for item in events.json()["items"])


def test_ai_summary_insufficient_evidence(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    monkeypatch.setattr(
        ai_incident_summary,
        "_build_evidence",
        lambda *_args, **_kwargs: ai_incident_summary.EvidenceBundle(
            lines=["Incident opened"], refs=[]
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-summary",
        headers=auth_headers(owner_session),
        json={},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "insufficient_evidence"
