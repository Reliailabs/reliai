from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "Reliai API"
    app_version: str = "0.1.0"
    app_url: str = "http://localhost:3000"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite+pysqlite:///./reliai.db"
    redis_url: str = "redis://localhost:6379/0"
    rq_queue_name: str = "default"
    log_level: str = "INFO"
    trace_warehouse_url: str | None = None
    clickhouse_database: str = "reliai"
    clickhouse_migrations_dir: str = str(ROOT_DIR / "infra" / "clickhouse" / "migrations")
    event_stream_brokers: str | None = None
    event_stream_topic_traces: str = "trace_events"
    event_stream_topic_traces_dlq: str | None = "trace_events_dlq"
    event_stream_consumer_timeout_ms: int = 1000
    enabled_processors: str = "evaluation,warehouse,reliability_metrics,regression,automation,reliability_graph"
    slack_webhook_default: str | None = None
    alert_delivery_cooldown_minutes: int = 60
    slack_alert_max_attempts: int = 3
    slack_alert_retry_backoff_seconds: str = "60,300"
    reliability_stale_telemetry_minutes: int = 30
    api_key_hash_secret: str = "change-me"
    auth_session_hash_secret: str = "change-me-session-secret"
    auth_session_days: int = 14
    workos_api_key: str | None = None
    workos_client_id: str | None = None
    workos_redirect_uri: str | None = None
    workos_logout_redirect_uri: str | None = None
    workos_cookie_password: str | None = None
    workos_scim_webhook_secret: str | None = None
    workos_dev_auth_enabled: bool = True
    public_api_rate_limit_per_minute: int = 120
    ingest_rate_limit_per_minute: int = 600
    processor_dispatch_rate_limit_per_minute: int = 300
    max_traces_per_second: int = 250
    max_project_ingest_rate: int = 120
    scheduler_enabled: bool = True
    scheduler_timezone: str = "UTC"
    warehouse_archive_dir: str = str(ROOT_DIR / "data" / "warehouse-archive")
    trace_input_text_max_chars: int = 20000
    trace_output_text_max_chars: int = 20000
    trace_metadata_max_bytes: int = 16384

    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env",),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
