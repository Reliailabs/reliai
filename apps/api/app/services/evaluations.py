import json
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation
from app.models.trace import Trace
from app.services.reliability_graph import sync_trace_evaluation

STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"
EVALUATOR_PROVIDER = "reliai"
EVALUATOR_MODEL = "structured-output-validator"
EVALUATOR_VERSION = "v1"


def _expects_json(trace: Trace) -> bool:
    if not trace.metadata_json:
        return False
    return (
        trace.metadata_json.get("expected_output_format") == "json"
        or trace.metadata_json.get("structured_output") is True
        or trace.metadata_json.get("structured_output_schema") is not None
    )


def upsert_evaluation(
    db: Session,
    *,
    trace: Trace,
    eval_type: str,
    score: Decimal | None,
    label: str | None,
    explanation: str | None,
    raw_result_json: dict | None,
) -> Evaluation:
    evaluation = db.scalar(
        select(Evaluation).where(
            Evaluation.trace_id == trace.id, Evaluation.eval_type == eval_type
        )
    )
    if evaluation is None:
        evaluation = Evaluation(
            trace_id=trace.id,
            project_id=trace.project_id,
            eval_type=eval_type,
        )

    evaluation.score = score
    evaluation.label = label
    evaluation.explanation = explanation
    evaluation.evaluator_provider = EVALUATOR_PROVIDER
    evaluation.evaluator_model = EVALUATOR_MODEL
    evaluation.evaluator_version = EVALUATOR_VERSION
    evaluation.raw_result_json = raw_result_json

    db.add(evaluation)
    db.flush()
    sync_trace_evaluation(db, evaluation=evaluation)
    return evaluation


def run_structured_output_validity_evaluation(db: Session, trace_id: UUID) -> Evaluation | None:
    trace = db.get(Trace, trace_id)
    if trace is None:
        return None

    if not _expects_json(trace):
        evaluation = upsert_evaluation(
            db,
            trace=trace,
            eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
            score=None,
            label="warning",
            explanation="Structured validity skipped because the trace did not declare JSON output.",
            raw_result_json={"status": "skipped", "reason": "not_applicable"},
        )
        db.commit()
        db.refresh(evaluation)
        return evaluation

    if not trace.output_text:
        evaluation = upsert_evaluation(
            db,
            trace=trace,
            eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
            score=Decimal("0.00"),
            label="fail",
            explanation="Expected JSON output but the trace has no output text.",
            raw_result_json={"status": "fail", "reason": "missing_output"},
        )
        db.commit()
        db.refresh(evaluation)
        return evaluation

    try:
        parsed = json.loads(trace.output_text)
    except json.JSONDecodeError as exc:
        evaluation = upsert_evaluation(
            db,
            trace=trace,
            eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
            score=Decimal("0.00"),
            label="fail",
            explanation="Output is not valid JSON.",
            raw_result_json={"status": "fail", "reason": "invalid_json", "error": exc.msg},
        )
        db.commit()
        db.refresh(evaluation)
        return evaluation

    evaluation = upsert_evaluation(
        db,
        trace=trace,
        eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
        score=Decimal("100.00"),
        label="pass",
        explanation="Output parsed as valid JSON.",
        raw_result_json={"status": "pass", "json_type": type(parsed).__name__},
    )
    db.commit()
    db.refresh(evaluation)
    return evaluation
