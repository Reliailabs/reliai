from __future__ import annotations

from fastapi import HTTPException, status

PLAN_ORDER = ["free", "team", "production", "enterprise"]


def normalize_plan(plan: str | None) -> str:
    value = (plan or "free").strip().lower()
    if value == "pilot":
        return "team"
    if value == "growth":
        return "production"
    return value if value in PLAN_ORDER else "free"


def has_required_plan(plan: str | None, required_plan: str) -> bool:
    return PLAN_ORDER.index(normalize_plan(plan)) >= PLAN_ORDER.index(normalize_plan(required_plan))


def require_plan(plan: str | None, required_plan: str) -> None:
    if not has_required_plan(plan, required_plan):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Upgrade required")
