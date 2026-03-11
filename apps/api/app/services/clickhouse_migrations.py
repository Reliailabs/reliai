from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.core.settings import get_settings


@dataclass(frozen=True)
class ClickHouseMigration:
    version: str
    sql: str


def _migrations_dir() -> Path:
    return Path(get_settings().clickhouse_migrations_dir)


def _migration_files() -> list[Path]:
    directory = _migrations_dir()
    if not directory.exists():
        return []
    return sorted(path for path in directory.glob("*.sql") if path.is_file())


def _post_sql(sql: str) -> str:
    settings = get_settings()
    if not settings.trace_warehouse_url:
        return ""
    response = httpx.post(
        settings.trace_warehouse_url.rstrip("/"),
        params={"database": settings.clickhouse_database, "query": sql},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.text


def _load_migrations() -> list[ClickHouseMigration]:
    result: list[ClickHouseMigration] = []
    for path in _migration_files():
        version = path.name.split("_", 1)[0]
        result.append(ClickHouseMigration(version=version, sql=path.read_text(encoding="utf-8")))
    return result


def ensure_migration_table() -> None:
    _post_sql(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations
        (
            version String,
            applied_at DateTime64(3, 'UTC')
        )
        ENGINE = MergeTree
        ORDER BY version
        """
    )


def get_current_version() -> str | None:
    settings = get_settings()
    if not settings.trace_warehouse_url:
        return None
    ensure_migration_table()
    text = _post_sql("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1 FORMAT TSV")
    value = text.strip()
    return value or None


def apply_migrations() -> list[str]:
    settings = get_settings()
    if not settings.trace_warehouse_url:
        return []
    ensure_migration_table()
    applied_rows = _post_sql("SELECT version FROM schema_migrations FORMAT TSV")
    applied = {line.strip() for line in applied_rows.splitlines() if line.strip()}
    executed: list[str] = []
    for migration in _load_migrations():
        if migration.version in applied:
            continue
        _post_sql(migration.sql)
        applied_at = datetime.now(timezone.utc).isoformat()
        _post_sql(
            "INSERT INTO schema_migrations FORMAT Values "
            f"('{migration.version}', parseDateTime64BestEffort('{applied_at}'))"
        )
        executed.append(migration.version)
    return executed
