from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.core.settings import get_settings
from app.models.incident import Incident
from app.schemas.ai import (
    AiRootCauseExplanationModelInfo,
    AiRootCauseExplanationRequest,
    AiRootCauseExplanationResponse,
)
from app.services.ai_provider import (
    call_anthropic,
    call_openai_compatible,
    extract_anthropic_content,
    extract_openai_content,
    parse_json_content,
)
from app.services.auth import OperatorContext
from app.services.incident_command_center import get_incident_command_center
from app.services.incidents import (
    INCIDENT_EVENT_AI_ROOT_CAUSE_EXPLANATION_GENERATED,
    append_incident_event,
)
from app.services.rate_limiter import enforce_rate_limit


@dataclass(frozen=True)
class EvidenceBundle:
    lines: list[str]
    refs: list[str]


@dataclass(frozen=True)
class PromptBundle:
    system_prompt: str
    user_prompt: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_evidence(command) -> EvidenceBundle:
    evidence_lines: list[str] = []
    evidence_refs: list[str] = []

    root_cause = command.root_cause_report
    if root_cause.root_cause_probabilities:
        top = root_cause.root_cause_probabilities[0]
        probability = top.get("probability")
        label = top.get("label") or "root cause"
        if isinstance(probability, (int, float)):
            evidence_lines.append(f"Root cause signal ({label}, {round(probability * 100)}% confidence)")
        else:
            evidence_lines.append(f"Root cause signal ({label})")
        evidence_refs.append("root_cause")

    if root_cause.recommended_fix and root_cause.recommended_fix.get("summary"):
        evidence_lines.append(f"Recommended fix ({root_cause.recommended_fix.get('summary')})")
        evidence_refs.append("recommended_fix")

    trace_compare = command.trace_compare
    if trace_compare is not None:
        evidence_lines.append("Trace comparison (failing vs baseline trace)")
        evidence_refs.append("trace_comparison")
        failing_prompt = trace_compare.trace.prompt_version
        baseline_prompt = trace_compare.baseline_trace.prompt_version if trace_compare.baseline_trace else None
        if failing_prompt and baseline_prompt and failing_prompt != baseline_prompt:
            evidence_lines.append(f"Prompt diff ({baseline_prompt} → {failing_prompt})")
            evidence_refs.append("prompt_diff")

    return EvidenceBundle(lines=evidence_lines, refs=list(dict.fromkeys(evidence_refs)))


def _build_prompt(*, command, evidence: EvidenceBundle) -> PromptBundle:
    incident = command.incident
    root_cause = command.root_cause_report
    top = root_cause.root_cause_probabilities[0] if root_cause.root_cause_probabilities else {}

    system_prompt = (
        "You are an incident response assistant. Explain the current deterministic root-cause evidence "
        "in plain operator language. Do not invent causes or metrics. Do not override confidence. "
        "Return JSON with keys: explanation, what_to_check_next."
    )

    user_prompt = {
        "incident_title": incident.title,
        "incident_type": incident.incident_type,
        "top_root_cause_label": top.get("label"),
        "recommended_fix": root_cause.recommended_fix,
        "evidence_lines": evidence.lines,
    }

    return PromptBundle(system_prompt=system_prompt, user_prompt=json.dumps(user_prompt, default=str))


def generate_ai_root_cause_explanation(
    *,
    db,
    operator: OperatorContext,
    incident_id: str,
    request: AiRootCauseExplanationRequest,
) -> AiRootCauseExplanationResponse:
    command = get_incident_command_center(db, operator, incident_id)
    incident: Incident = command.incident
    settings = get_settings()
    summary_json = dict(incident.summary_json or {})
    cached = summary_json.get("ai_root_cause_explanation")
    cached_provider = cached.get("model", {}).get("provider") if isinstance(cached, dict) else None
    if (
        not request.regenerate
        and isinstance(cached, dict)
        and cached.get("status") == "ok"
        and cached_provider == settings.ai_provider
    ):
        generated_at = datetime.fromisoformat(cached.get("generated_at"))
        is_stale = bool(incident.updated_at and generated_at < incident.updated_at)
        return AiRootCauseExplanationResponse(
            explanation=cached.get("explanation"),
            what_to_check_next=cached.get("what_to_check_next"),
            evidence_used=cached.get("evidence_used", []),
            generated_at=generated_at,
            model=AiRootCauseExplanationModelInfo(
                provider=cached.get("model", {}).get("provider", "openai"),
                model=cached.get("model", {}).get("model", settings.openai_model),
            ),
            status=cached.get("status", "ok"),
            is_stale=is_stale,
        )

    enforce_rate_limit(
        scope="ai_root_cause_explanation",
        key=str(incident.id),
        limit=3,
        window_seconds=600,
    )

    evidence = _build_evidence(command)
    root_cause = command.root_cause_report
    top_probability = (
        root_cause.root_cause_probabilities[0].get("probability")
        if root_cause.root_cause_probabilities
        else None
    )
    if not root_cause.root_cause_probabilities or len(evidence.lines) < 2 or top_probability is None:
        response = AiRootCauseExplanationResponse(
            explanation=None,
            what_to_check_next=None,
            evidence_used=evidence.lines,
            generated_at=_now(),
            model=None,
            status="insufficient_evidence",
            is_stale=False,
        )
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_AI_ROOT_CAUSE_EXPLANATION_GENERATED,
            actor_operator_user_id=operator.operator.id,
            metadata_json={
                "status": "insufficient_evidence",
                "evidence_refs": evidence.refs,
                "regeneration": request.regenerate,
            },
        )
        db.commit()
        return response

    try:
        prompt = _build_prompt(command=command, evidence=evidence)
    except Exception as exc:  # pragma: no cover - defensive guard
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI explanation request failed",
        ) from exc
    provider = settings.ai_provider.lower().strip()
    if provider == "openai":
        model_name = settings.openai_model
        data = call_openai_compatible(
            base_url=settings.openai_api_base,
            api_key=settings.openai_api_key,
            model=model_name,
            messages=[
                {"role": "system", "content": prompt.system_prompt},
                {"role": "user", "content": prompt.user_prompt},
            ],
            use_json_mode=True,
        )
        content = extract_openai_content(data)
        model = AiRootCauseExplanationModelInfo(provider="openai", model=model_name)
    elif provider == "deepseek":
        model_name = settings.deepseek_model
        data = call_openai_compatible(
            base_url=settings.deepseek_api_base,
            api_key=settings.deepseek_api_key,
            model=model_name,
            messages=[
                {"role": "system", "content": prompt.system_prompt},
                {"role": "user", "content": prompt.user_prompt},
            ],
            use_json_mode=True,
        )
        content = extract_openai_content(data)
        model = AiRootCauseExplanationModelInfo(provider="deepseek", model=model_name)
    elif provider == "anthropic":
        model_name = settings.anthropic_model
        data = call_anthropic(
            base_url=settings.anthropic_api_base,
            api_key=settings.anthropic_api_key,
            model=model_name,
            system_prompt=prompt.system_prompt,
            user_prompt=prompt.user_prompt,
            version=settings.anthropic_version,
        )
        content = extract_anthropic_content(data)
        model = AiRootCauseExplanationModelInfo(provider="anthropic", model=model_name)
    else:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI provider is not configured")

    if not content:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI explanation returned empty content")
    parsed = parse_json_content(content)

    explanation = parsed.get("explanation") if isinstance(parsed.get("explanation"), str) else None
    what_to_check_next = parsed.get("what_to_check_next") if isinstance(parsed.get("what_to_check_next"), str) else None
    if explanation:
        explanation = explanation.strip()[:900]
    if what_to_check_next:
        what_to_check_next = what_to_check_next.strip()[:400]
    if not explanation:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI explanation returned empty content")

    generated_at = _now()
    is_stale = bool(incident.updated_at and generated_at < incident.updated_at)
    response = AiRootCauseExplanationResponse(
        explanation=explanation,
        what_to_check_next=what_to_check_next,
        evidence_used=evidence.lines,
        generated_at=generated_at,
        model=model,
        status="ok",
        is_stale=is_stale,
    )

    summary_json["ai_root_cause_explanation"] = {
        "explanation": response.explanation,
        "what_to_check_next": response.what_to_check_next,
        "evidence_used": response.evidence_used,
        "generated_at": response.generated_at.isoformat(),
        "model": {"provider": model.provider, "model": model.model},
        "status": response.status,
    }
    incident.summary_json = summary_json
    db.add(incident)
    append_incident_event(
        db,
        incident=incident,
        event_type=INCIDENT_EVENT_AI_ROOT_CAUSE_EXPLANATION_GENERATED,
        actor_operator_user_id=operator.operator.id,
        metadata_json={
            "status": response.status,
            "model": model.model,
            "evidence_refs": evidence.refs,
            "regeneration": request.regenerate,
        },
    )
    db.commit()
    return response
