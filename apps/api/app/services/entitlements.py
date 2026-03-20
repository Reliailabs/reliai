from app.services.plans import normalize_plan

# NOTE:
# Do not introduce fine-grained permissions yet.
# This system is intentionally role-based for simplicity and scalability.

PLAN_FEATURES: dict[str, set[str]] = {
    "free": {"basic_tracing"},
    "team": {"basic_tracing", "collaboration", "deployment_compare", "root_cause"},
    "production": {
        "basic_tracing",
        "collaboration",
        "deployment_compare",
        "root_cause",
        "dashboards",
        "slos",
        "alerts",
        "audit_logs",
    },
    "enterprise": {"*"},
}


def has_feature(plan: str | None, feature: str) -> bool:
    normalized_plan = normalize_plan(plan)
    features = PLAN_FEATURES.get(normalized_plan, set())
    return "*" in features or feature in features


def require_feature(plan: str | None, feature: str) -> None:
    if not has_feature(plan, feature):
        raise PermissionError(f"Missing feature: {feature}")
