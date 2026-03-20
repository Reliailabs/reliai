from __future__ import annotations


def get_upgrade_prompt(context: str, usage_status: dict | None = None) -> dict[str, str]:
    if context == "usage_warning":
        percent = int((usage_status or {}).get("percent_used", 0) * 100)
        return {
            "title": "Approaching trace limit",
            "message": f"You're using {percent}% of your daily traces.",
            "cta": "Upgrade to Team",
            "plan": "team",
        }
    if context == "usage_blocked":
        return {
            "title": "Trace limit reached",
            "message": "New traces are no longer being recorded.",
            "cta": "Upgrade to continue monitoring",
            "plan": "team",
        }
    if context == "team_invite":
        return {
            "title": "Work better as a team",
            "message": "Invite teammates to collaborate on incidents.",
            "cta": "Upgrade to Team",
            "plan": "team",
        }
    if context == "dashboard_share":
        return {
            "title": "Share the dashboard",
            "message": "Viewer access is available on production plans.",
            "cta": "Upgrade to Production",
            "plan": "production",
        }
    if context == "deployment_compare":
        return {
            "title": "Compare deployments",
            "message": "Deployment comparisons are available on Team.",
            "cta": "Upgrade to Team",
            "plan": "team",
        }
    if context == "slo_access":
        return {
            "title": "SLO access",
            "message": "SLO features are available on Production plans.",
            "cta": "Upgrade to Production",
            "plan": "production",
        }
    return {
        "title": "Upgrade required",
        "message": "Upgrade your plan to unlock this feature.",
        "cta": "Upgrade",
        "plan": "team",
    }
