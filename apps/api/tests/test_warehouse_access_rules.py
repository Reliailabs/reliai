from pathlib import Path
import re


ANALYTICS_SERVICE_FILES = [
    "apps/api/app/services/growth_metrics.py",
    "apps/api/app/services/cost_intelligence.py",
    "apps/api/app/services/customer_reliability_metrics.py",
    "apps/api/app/services/reliability_intelligence.py",
    "apps/api/app/services/reliability_pattern_mining.py",
    "apps/api/app/services/cohort_queries.py",
    "apps/api/app/services/trace_query_adapter.py",
    "apps/api/app/services/customer_exports.py",
]

FORBIDDEN_IMPORT_SNIPPETS = (
    "query_traces",
    "query_all_traces",
    "query_hourly_metrics",
    "query_daily_metrics",
    "aggregate_trace_metrics",
)


def test_analytics_services_do_not_import_public_trace_warehouse_query_helpers():
    repo_root = Path(__file__).resolve().parents[3]

    for relative_path in ANALYTICS_SERVICE_FILES:
        contents = (repo_root / relative_path).read_text()
        match = re.search(r"from app\.services\.trace_warehouse import\s*(\([^)]+\)|[^\n]+)", contents, re.MULTILINE)
        if match is None:
            continue
        imported_block = match.group(1)
        for snippet in FORBIDDEN_IMPORT_SNIPPETS:
            assert snippet not in imported_block, f"{relative_path} imports forbidden warehouse helper {snippet}"
