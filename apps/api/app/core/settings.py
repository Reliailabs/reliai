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
    slack_webhook_default: str | None = None
    alert_delivery_cooldown_minutes: int = 60
    slack_alert_max_attempts: int = 3
    slack_alert_retry_backoff_seconds: str = "60,300"
    api_key_hash_secret: str = "change-me"
    auth_session_hash_secret: str = "change-me-session-secret"
    auth_session_days: int = 14
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
