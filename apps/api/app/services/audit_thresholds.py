from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable


@dataclass(frozen=True)
class ThresholdContext:
    audit_type: str | None = None
    policy_profile: str | None = None
    environment: str | None = None
    project_criticality: str | None = None


@dataclass(frozen=True)
class CertificationAtRiskThresholds:
    critical_incidents_unresolved: int
    regressions: int
    guardrail_blocks: int


@dataclass(frozen=True)
class CertificationAtRiskEvaluation:
    at_risk: bool
    reason: str | None
    reasons: list[str]


DEFAULT_THRESHOLDS = CertificationAtRiskThresholds(
    critical_incidents_unresolved=2,
    regressions=5,
    guardrail_blocks=20,
)


def resolve_thresholds(context: ThresholdContext) -> CertificationAtRiskThresholds:
    # Deterministic resolution order (shallow in this pass):
    # global defaults -> audit_type -> policy_profile -> environment -> project_criticality.
    # Currently returns defaults; structure exists for future refinement.
    _ = context
    return DEFAULT_THRESHOLDS


def evaluate_certification_at_risk(
    *,
    certification_effective_at: datetime | None,
    thresholds: CertificationAtRiskThresholds,
    critical_incident_count: int,
    regression_count: int,
    guardrail_block_count: int,
) -> CertificationAtRiskEvaluation:
    if certification_effective_at is None:
        return CertificationAtRiskEvaluation(at_risk=False, reason=None, reasons=[])

    reasons: list[str] = []
    if critical_incident_count >= thresholds.critical_incidents_unresolved:
        reasons.append("Multiple unresolved critical incidents were detected after certification.")
    if regression_count >= thresholds.regressions:
        reasons.append("Repeated regression events exceeded the post-certification threshold.")
    if guardrail_block_count >= thresholds.guardrail_blocks:
        reasons.append("Guardrail block/reject events spiked above the post-certification threshold.")

    if not reasons:
        return CertificationAtRiskEvaluation(at_risk=False, reason=None, reasons=[])
    return CertificationAtRiskEvaluation(at_risk=True, reason=reasons[0], reasons=reasons)