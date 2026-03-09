from collections.abc import Generator

from redis import Redis
from rq import Queue
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import get_settings
from app.db import base  # noqa: F401

settings = get_settings()

engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def get_queue() -> Queue:
    return Queue(name=settings.rq_queue_name, connection=get_redis())
