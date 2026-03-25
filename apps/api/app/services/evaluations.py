import json
import re
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation
from app.models.trace import Trace
from app.services.custom_metrics import (
    custom_metric_eval_type,
    evaluate_custom_metric_on_text,
    list_enabled_project_custom_metrics,
)
from app.services.reliability_graph import sync_trace_evaluation

STRUCTURED_VALIDITY_EVAL_TYPE = "structured_validity"
REFUSAL_DETECTION_EVAL_TYPE = "refusal_detection"
EVALUATOR_PROVIDER = "reliai"
EVALUATOR_MODEL = "structured-output-validator"
EVALUATOR_VERSION = "v1"
DEFAULT_REFUSAL_PATTERNS = (
    r"\bi\s+cannot\s+help\s+with\s+that\b",
    r"\bi[\s\u2019']?m\s+unable\s+to\s+assist\b",
    r"\bi\s+can[\s\u2019']?t\s+provide\s+that\s+information\b",
    r"\bi\s+cannot\s+comply\s+with\s+that\b",
    r"\bi\s+cannot\s+assist\s+with\s+that\b",
)


def _expects_json(trace: Trace) -> bool:
    if not trace.metadata_json:
        return False
    return (
        trace.metadata_json.get("expected_output_format") == "json"
        or trace.metadata_json.get("structured_output") is True
        or trace.metadata_json.get("structured_output_schema") is not None
    )


def _normalized_output_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.lower().split())


def _matches_refusal_pattern(output_text: str | None) -> tuple[bool, str | None]:
    normalized = _normalized_output_text(output_text)
    if not normalized:
        return False, None
    for pattern in DEFAULT_REFUSAL_PATTERNS:
        if re.search(pattern, normalized, flags=re.IGNORECASE):
            return True, pattern
    return False, None


def trace_refusal_detected(trace: Trace) -> bool | None:
    evaluations = getattr(trace, "evaluations", [])
    refusal_eval = next(
        (item for item in evaluations if item.eval_type == REFUSAL_DETECTION_EVAL_TYPE),
        None,
    )
    if refusal_eval is None:
        return None
    raw = refusal_eval.raw_result_json or {}
    value = raw.get("result_value")
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    return refusal_eval.label == "fail"


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


def run_refusal_detection_evaluation(db: Session, trace_id: UUID) -> Evaluation | None:
    trace = db.get(Trace, trace_id)
    if trace is None:
        return None

    refusal_detected, matched_pattern = _matches_refusal_pattern(trace.output_text)
    evaluation = upsert_evaluation(
        db,
        trace=trace,
        eval_type=REFUSAL_DETECTION_EVAL_TYPE,
        score=Decimal("100.00") if refusal_detected else Decimal("0.00"),
        label="fail" if refusal_detected else "pass",
        explanation=(
            "Output matched refusal phrasing."
            if refusal_detected
            else "Output did not match refusal phrasing."
        ),
        raw_result_json={
            "status": "ok",
            "result_value": refusal_detected,
            "matched_pattern": matched_pattern,
            "normalized_output_preview": _normalized_output_text(trace.output_text)[:200],
        },
    )
    db.commit()
    db.refresh(evaluation)
    return evaluation


def run_project_custom_metric_evaluations(db: Session, trace_id: UUID) -> list[Evaluation]:
    trace = db.get(Trace, trace_id)
    if trace is None:
        return []

    metrics = list_enabled_project_custom_metrics(db, project_id=trace.project_id)
    evaluations: list[Evaluation] = []
    for metric in metrics:
        result = evaluate_custom_metric_on_text(metric=metric, output_text=trace.output_text)
        if result.status == "invalid_pattern":
            evaluation = upsert_evaluation(
                db,
                trace=trace,
                eval_type=custom_metric_eval_type(metric),
                score=None,
                label="warning",
                explanation=f"Custom metric '{metric.name}' skipped due to invalid pattern.",
                raw_result_json={
                    "status": result.status,
                    "error": result.error,
                    "metric_key": metric.metric_key,
                    "metric_name": metric.name,
                    "metric_type": metric.metric_type,
                    "value_mode": metric.value_mode,
                },
            )
            evaluations.append(evaluation)
            continue

        raw_value = bool(result.value > 0) if metric.value_mode == "boolean" else result.value
        score = Decimal("100.00") if (metric.value_mode == "boolean" and result.value > 0) else Decimal("0.00")
        if metric.value_mode == "count":
            score = Decimal(str(result.value)).quantize(Decimal("0.01"))
        evaluation = upsert_evaluation(
            db,
            trace=trace,
            eval_type=custom_metric_eval_type(metric),
            score=score,
            label="hit" if result.matched else "miss",
            explanation=(
                f"Custom metric '{metric.name}' matched {result.match_count} occurrence(s)."
                if result.matched
                else f"Custom metric '{metric.name}' had no matches."
            ),
            raw_result_json={
                "status": result.status,
                "metric_key": metric.metric_key,
                "metric_name": metric.name,
                "metric_type": metric.metric_type,
                "value_mode": metric.value_mode,
                "result_value": raw_value,
                "match_count": result.match_count,
            },
        )
        evaluations.append(evaluation)

    if evaluations:
        db.commit()
        for evaluation in evaluations:
            db.refresh(evaluation)
    return evaluations
