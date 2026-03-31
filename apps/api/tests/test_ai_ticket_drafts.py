import json

from app.services import ai_ticket_drafts

from .test_api import auth_headers
from .test_incidents import _incident_for_type, _seed_success_rate_regression


def test_ai_ticket_draft_uses_deterministic_evidence(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    def fake_call_openai_compatible(*_args, **_kwargs):
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "title": "[Incident] Fake injected evidence",
                                "body": "Summary:\nInjected\n\nImpact:\nInjected\n\nEvidence:\n- fake line\n\nRecommended Action:\nInjected",
                                "evidence_used": ["fake evidence"],
                            }
                        )
                    }
                }
            ]
        }

    monkeypatch.setattr(ai_ticket_drafts, "call_openai_compatible", fake_call_openai_compatible)
    monkeypatch.setattr(
        ai_ticket_drafts,
        "_build_evidence",
        lambda *_args, **_kwargs: ai_ticket_drafts.EvidenceBundle(
            lines=[
                "Success rate current 0.20 vs baseline 0.95",
                "Root cause signal: Prompt update",
            ],
            refs=["metric_delta", "root_cause"],
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-ticket-draft",
        headers=auth_headers(owner_session),
        json={"destination": "jira"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["title"].startswith("[Incident]")
    assert payload["evidence_used"] == [
        "Success rate current 0.20 vs baseline 0.95",
        "Root cause signal: Prompt update",
    ]
    assert "Evidence:" in payload["body"]
    assert "- Success rate current 0.20 vs baseline 0.95" in payload["body"]
    assert "- Root cause signal: Prompt update" in payload["body"]


def test_ai_ticket_draft_title_body_limits(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    def fake_call_openai_compatible(*_args, **_kwargs):
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "title": "x" * 200,
                                "body": "y" * 4000,
                            }
                        )
                    }
                }
            ]
        }

    monkeypatch.setattr(ai_ticket_drafts, "call_openai_compatible", fake_call_openai_compatible)
    monkeypatch.setattr(
        ai_ticket_drafts,
        "_build_evidence",
        lambda *_args, **_kwargs: ai_ticket_drafts.EvidenceBundle(
            lines=["Metric delta", "Root cause signal: Prompt update"], refs=["metric_delta", "root_cause"]
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-ticket-draft",
        headers=auth_headers(owner_session),
        json={"destination": "github"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["title"]) <= 120
    assert len(payload["body"]) <= 3000


def test_ai_ticket_draft_insufficient_evidence(client, db_session, monkeypatch):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    monkeypatch.setattr(
        ai_ticket_drafts,
        "_build_evidence",
        lambda *_args, **_kwargs: ai_ticket_drafts.EvidenceBundle(
            lines=["Incident opened"], refs=[]
        ),
    )

    response = client.post(
        f"/api/v1/incidents/{incident.id}/ai-ticket-draft",
        headers=auth_headers(owner_session),
        json={"destination": "jira"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "insufficient_evidence"
