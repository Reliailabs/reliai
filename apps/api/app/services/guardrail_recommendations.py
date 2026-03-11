from __future__ import annotations

from app.services.reliability_pattern_mining import (
    FAILURE_HALLUCINATION,
    FAILURE_LATENCY,
)
def recommend_guardrails_from_patterns(
    *,
    pattern_risk: dict[str, object],
    graph_recommendations: list[dict[str, object]] | None = None,
) -> list[dict[str, str | float]]:
    recommendations: list[dict[str, str | float]] = []
    for item in pattern_risk.get("matched_patterns", []):
        failure_type = str(item.get("failure_type"))
        failure_probability = float(item.get("failure_probability", 0.0))
        if failure_probability < 0.2:
            continue
        if failure_type == FAILURE_HALLUCINATION:
            recommendations.append(
                {
                    "policy_type": "hallucination",
                    "recommended_action": "retry",
                    "title": "Add hallucination guardrail coverage",
                    "description": "Warehouse patterns show retrieval-backed hallucination risk for this traffic shape.",
                    "failure_probability": round(failure_probability, 4),
                }
            )
        elif failure_type == FAILURE_LATENCY:
            recommendations.append(
                {
                    "policy_type": "latency_retry",
                    "recommended_action": "retry",
                    "title": "Add latency retry guardrail",
                    "description": "Warehouse patterns show repeated latency pressure for this deployment shape.",
                    "failure_probability": round(failure_probability, 4),
                }
            )
    unique: list[dict[str, str | float]] = []
    seen: set[str] = set()
    for item in recommendations:
        key = str(item["policy_type"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    for item in graph_recommendations or []:
        key = str(item["policy_type"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(
            {
                "policy_type": key,
                "recommended_action": str(item["recommended_action"]),
                "title": str(item["title"]),
                "description": str(item["description"]),
                "failure_probability": round(float(item.get("confidence", 0.0)), 4),
            }
        )
    return unique
