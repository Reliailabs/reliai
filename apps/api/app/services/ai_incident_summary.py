from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.settings import get_settings
from app.models.incident import Incident
from app.schemas.ai import AiIncidentSummaryModelInfo, AiIncidentSummaryRequest, AiIncidentSummaryResponse
from app.services.auth import OperatorContext
from app.services.incident_command_center import get_incident_command_center
from app.services.incidents import (
    INCIDENT_EVENT_AI_SUMMARY_GENERATED,
    _resolution_display_name,
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
    incident = command.incident
    summary = incident.summary_json or {}
    evidence_lines: list[str] = []
    evidence_refs: list[str] = []

    metric_name = summary.get("metric_name")
    current_value = summary.get("current_value")
    baseline_value = summary.get("baseline_value")
    if metric_name and current_value is not None and baseline_value is not None:
        display_name = _resolution_display_name(str(metric_name), summary)
        evidence_lines.append(
            f"Metric delta ({display_name} current {current_value} vs baseline {baseline_value})"
        )
        evidence_refs.append("metric_delta")

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

    trace_compare = command.trace_compare
    if trace_compare is not None:
        evidence_lines.append("Trace comparison (failing vs baseline trace)")
        evidence_refs.append("trace_comparison")
        failing_prompt = trace_compare.trace.prompt_version
        baseline_prompt = trace_compare.baseline_trace.prompt_version if trace_compare.baseline_trace else None
        if failing_prompt and baseline_prompt and failing_prompt != baseline_prompt:
            evidence_lines.append(f"Prompt diff ({baseline_prompt} → {failing_prompt})")
            evidence_refs.append("prompt_diff")

    if command.resolution_impact and command.resolution_impact.get("summary"):
        evidence_lines.append(f"Resolution impact ({command.resolution_impact.get('summary')})")
        evidence_refs.append("resolution_impact")

    return EvidenceBundle(lines=evidence_lines, refs=list(dict.fromkeys(evidence_refs)))


def _build_prompt(*, command, evidence: EvidenceBundle, request: AiIncidentSummaryRequest) -> PromptBundle:
    incident = command.incident
    summary = incident.summary_json or {}
    metric_name = summary.get("metric_name")
    display_name = _resolution_display_name(str(metric_name), summary) if metric_name else "metric"
    root_cause = command.root_cause_report
    recommended_fix = root_cause.recommended_fix.get("summary") if root_cause.recommended_fix else None

    system_prompt = (
        "You are an incident response assistant. Summarize only from the provided evidence. "
        "Do not invent metrics or causes. Separate facts from inference. "
        "Return JSON with keys: summary, recommended_next_step, evidence_used."
    )

    user_prompt = {
        "incident_title": incident.title,
        "incident_type": incident.incident_type,
        "metric_display_name": display_name,
        "metric_current_value": summary.get("current_value"),
        "metric_baseline_value": summary.get("baseline_value"),
        "metric_delta_percent": summary.get("delta_percent"),
        "root_cause_probabilities": root_cause.root_cause_probabilities,
        "recommended_fix": recommended_fix,
        "recommended_action_reason": root_cause.recommended_fix.get("reason") if root_cause.recommended_fix else None,
        "resolution_impact": command.resolution_impact,
        "evidence_lines": evidence.lines,
    }

    return PromptBundle(system_prompt=system_prompt, user_prompt=json.dumps(user_prompt))


def _call_openai_compatible(*, base_url: str, api_key: str | None, model: str | None, messages: list[dict[str, str]], use_json_mode: bool) -> dict[str, Any]:
    if not api_key or not model:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI provider is not configured")
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 800,
    }
    if use_json_mode:
        payload["response_format"] = {"type": "json_object"}
    try:
        response = httpx.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc


def _call_anthropic(*, base_url: str, api_key: str | None, model: str | None, system_prompt: str, user_prompt: str, version: str) -> dict[str, Any]:
    if not api_key or not model:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI provider is not configured")
    endpoint = f"{base_url.rstrip('/')}/v1/messages"
    payload = {
        "model": model,
        "max_tokens": 800,
        "temperature": 0.2,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        response = httpx.post(
            endpoint,
            headers={
                "x-api-key": api_key,
                "anthropic-version": version,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider request failed",
        ) from exc


def _extract_openai_content(data: dict[str, Any]) -> str | None:
    return (data.get("choices") or [{}])[0].get("message", {}).get("content")


def _extract_anthropic_content(data: dict[str, Any]) -> str | None:
    content = data.get("content")
    if isinstance(content, list):
        parts = [item.get("text") for item in content if isinstance(item, dict) and item.get("type") == "text"]
        return "".join(part for part in parts if part)
    if isinstance(content, str):
        return content
    return None


def _parse_summary(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI summary returned invalid JSON",
        ) from exc


def generate_ai_incident_summary(
    *,
    db,
    operator: OperatorContext,
    incident_id: str,
    request: AiIncidentSummaryRequest,
) -> AiIncidentSummaryResponse:
    command = get_incident_command_center(db, operator, incident_id)
    incident: Incident = command.incident
    settings = get_settings()
    summary_json = dict(incident.summary_json or {})
    cached = summary_json.get("ai_summary")
    cached_provider = cached.get("model", {}).get("provider") if isinstance(cached, dict) else None
    if (
        not request.regenerate
        and isinstance(cached, dict)
        and cached.get("status") == "ok"
        and cached_provider == settings.ai_provider
    ):
        return AiIncidentSummaryResponse(
            summary=cached.get("summary"),
            recommended_next_step=cached.get("recommended_next_step"),
            evidence_used=cached.get("evidence_used", []),
            generated_at=datetime.fromisoformat(cached.get("generated_at")),
            model=AiIncidentSummaryModelInfo(
                provider=cached.get("model", {}).get("provider", "openai"),
                model=cached.get("model", {}).get("model", settings.openai_model),
            ),
            status=cached.get("status", "ok"),
        )

    enforce_rate_limit(
        scope="ai_summary",
        key=str(incident.id),
        limit=3,
        window_seconds=600,
    )

    evidence = _build_evidence(command)
    if len(evidence.lines) < 2:
        response = AiIncidentSummaryResponse(
            summary=None,
            recommended_next_step=None,
            evidence_used=evidence.lines,
            generated_at=_now(),
            model=None,
            status="insufficient_evidence",
        )
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_AI_SUMMARY_GENERATED,
            actor_operator_user_id=operator.operator.id,
            metadata_json={
                "status": "insufficient_evidence",
                "evidence_refs": evidence.refs,
                "regeneration": request.regenerate,
            },
        )
        db.commit()
        return response

    prompt = _build_prompt(command=command, evidence=evidence, request=request)
    provider = settings.ai_provider.lower().strip()
    if provider == "openai":
        model_name = settings.openai_model
        data = _call_openai_compatible(
            base_url=settings.openai_api_base,
            api_key=settings.openai_api_key,
            model=model_name,
            messages=[
                {"role": "system", "content": prompt.system_prompt},
                {"role": "user", "content": prompt.user_prompt},
            ],
            use_json_mode=True,
        )
        content = _extract_openai_content(data)
        model = AiIncidentSummaryModelInfo(provider="openai", model=model_name)
    elif provider == "deepseek":
        model_name = settings.deepseek_model
        data = _call_openai_compatible(
            base_url=settings.deepseek_api_base,
            api_key=settings.deepseek_api_key,
            model=model_name,
            messages=[
                {"role": "system", "content": prompt.system_prompt},
                {"role": "user", "content": prompt.user_prompt},
            ],
            use_json_mode=True,
        )
        content = _extract_openai_content(data)
        model = AiIncidentSummaryModelInfo(provider="deepseek", model=model_name)
    elif provider == "anthropic":
        model_name = settings.anthropic_model
        data = _call_anthropic(
            base_url=settings.anthropic_api_base,
            api_key=settings.anthropic_api_key,
            model=model_name,
            system_prompt=prompt.system_prompt,
            user_prompt=prompt.user_prompt,
            version=settings.anthropic_version,
        )
        content = _extract_anthropic_content(data)
        model = AiIncidentSummaryModelInfo(provider="anthropic", model=model_name)
    else:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI provider is not configured")
    if not content:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI summary returned empty content")
    parsed = _parse_summary(content)

    summary_text = parsed.get("summary") if isinstance(parsed.get("summary"), str) else None
    recommended_step = (
        parsed.get("recommended_next_step")
        if isinstance(parsed.get("recommended_next_step"), str)
        else None
    )
    if summary_text:
        summary_text = summary_text.strip()[:800]
    if recommended_step:
        recommended_step = recommended_step.strip()[:400]
    if not summary_text:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI summary returned empty content")

    response = AiIncidentSummaryResponse(
        summary=summary_text,
        recommended_next_step=recommended_step,
        evidence_used=evidence.lines,
        generated_at=_now(),
        model=model,
        status="ok",
    )

    summary_json["ai_summary"] = {
        "summary": response.summary,
        "recommended_next_step": response.recommended_next_step,
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
        event_type=INCIDENT_EVENT_AI_SUMMARY_GENERATED,
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
