from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ReportNarrative:
    decision: str
    risk_level: str
    blocker_status: str
    required_next_action: str
    top_blockers: list[str]
    required_remediation: list[str]
    recommended_improvements: list[str]
    evidence_impact_summary: str
    next_step_guidance: str
    summary: str


def _risk_level_from_score(score: float | None) -> str:
    if score is None:
        return "pending"
    if score >= 80:
        return "low"
    if score >= 60:
        return "moderate"
    if score >= 40:
        return "high"
    return "critical"


def build_report_narrative(
    *,
    certification_status: str,
    risk_score: float | None,
    blocker_titles: list[str],
    production_evidence_included: bool,
) -> ReportNarrative:
    risk_level = _risk_level_from_score(risk_score)
    has_blockers = len(blocker_titles) > 0
    blocker_status = "blockers present" if has_blockers else "no open blockers"
    decision = certification_status.replace("_", " ")

    if certification_status == "pending":
        required_next_action = "Complete downstream stages to restore a fresh certification decision."
        next_step_guidance = "Resume the run from the current stage and re-run certification after validation."
    elif has_blockers:
        required_next_action = "Remediate open blockers and re-run certification."
        next_step_guidance = "Address blocker findings first, then verify remediation in a follow-up run."
    else:
        required_next_action = "Maintain controls and continue monitoring."
        next_step_guidance = "Schedule a periodic re-audit to confirm reliability remains stable."

    evidence_impact_summary = (
        "Production evidence snapshot was included in certification analysis."
        if production_evidence_included
        else "Certification decision is based on audit inputs only; no production snapshot was included."
    )

    required_remediation = (
        [f"Resolve blocker: {title}" for title in blocker_titles[:3]]
        if has_blockers
        else ["No blocker remediation required at this time."]
    )
    recommended_improvements = [
        "Expand monitoring on validated risk surfaces.",
        "Document mitigation ownership and target dates.",
        "Run a follow-up audit after major workflow or model changes.",
    ]

    summary = (
        f"Decision: {decision}. Risk level: {risk_level}. "
        f"{'Blockers require remediation before full readiness.' if has_blockers else 'No open blockers in current decision set.'}"
    )

    return ReportNarrative(
        decision=decision,
        risk_level=risk_level,
        blocker_status=blocker_status,
        required_next_action=required_next_action,
        top_blockers=blocker_titles[:3],
        required_remediation=required_remediation,
        recommended_improvements=recommended_improvements,
        evidence_impact_summary=evidence_impact_summary,
        next_step_guidance=next_step_guidance,
        summary=summary,
    )

