import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["API_KEY_HASH_SECRET"] = "test-secret"

from app.db.session import get_db
from app.main import app
from app.models.base import Base
from app.services import traces as trace_services


class FakeQueue:
    def __init__(self) -> None:
        self.jobs: list[tuple[object, tuple[object, ...]]] = []

    def enqueue(self, func, *args, **kwargs):
        self.jobs.append((func, args))
        return {"func": func, "args": args, "kwargs": kwargs}


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def fake_queue(monkeypatch: pytest.MonkeyPatch) -> FakeQueue:
    queue = FakeQueue()
    monkeypatch.setattr(trace_services, "get_queue", lambda: queue)
    return queue
