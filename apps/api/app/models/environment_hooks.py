import uuid

from sqlalchemy import event

from app.models.deployment import Deployment
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.deployment_simulation import DeploymentSimulation
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.trace import Trace
from app.services.environments import infer_environment_id_for_insert


def _set_environment_id(mapper, connection, target) -> None:
    del mapper
    environment_id = infer_environment_id_for_insert(connection, target)
    if environment_id is not None:
        target.environment_id = environment_id


def _set_trace_id(mapper, connection, target: Trace) -> None:
    del mapper
    del connection
    fallback = target.trace_id or target.span_id or target.id or uuid.uuid4()
    if not target.trace_id:
        target.trace_id = str(fallback)
    if not target.span_id:
        target.span_id = str(fallback)


for _model in (
    Trace,
    Incident,
    Deployment,
    GuardrailPolicy,
    GuardrailRuntimeEvent,
    DeploymentSimulation,
    DeploymentRiskScore,
):
    event.listen(_model, "before_insert", _set_environment_id)

event.listen(Trace, "before_insert", _set_trace_id)
