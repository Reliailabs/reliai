from __future__ import annotations

from uuid import UUID

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.processors.base_processor import BaseProcessor
from app.services.deployment_gate import evaluate_deployment
from app.services.event_stream import (
    DEPLOYMENT_CREATED_EVENT,
    DeploymentGateResultEventPayload,
    publish_event,
)


class DeploymentProcessor(BaseProcessor):
    name = "deployment"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != DEPLOYMENT_CREATED_EVENT:
            return

        db = SessionLocal()
        try:
            deployment_id = UUID(str(event.payload["deployment_id"]))
            project_id = UUID(str(event.payload["project_id"]))
            gate = evaluate_deployment(db, project_id, deployment_id)
            publish_event(
                get_settings().event_stream_topic_traces,
                DeploymentGateResultEventPayload(
                    project_id=str(project_id),
                    environment_id=event.payload.get("environment_id"),
                    deployment_id=str(deployment_id),
                    decision=gate["decision"],
                    risk_score=gate["risk_score"],
                    explanations=gate["explanations"],
                    recommended_guardrails=gate["recommended_guardrails"],
                    metadata={"source_event_type": DEPLOYMENT_CREATED_EVENT},
                ).model_dump(mode="json"),
            )
        finally:
            db.close()
