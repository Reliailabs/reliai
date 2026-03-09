ROOT_DIR := $(abspath .)
PYTHON_BOOTSTRAP ?= python3
PYTHON ?= $(ROOT_DIR)/.venv/bin/python
PIP ?= $(ROOT_DIR)/.venv/bin/pip
PNPM ?= pnpm

export DATABASE_URL
export REDIS_URL
export API_KEY_HASH_SECRET
export AUTH_SESSION_HASH_SECRET

.PHONY: install dev worker test test-integration lint format db-up db-migrate seed

install:
	test -d .venv || $(PYTHON_BOOTSTRAP) -m venv .venv
	$(PIP) install -r apps/api/requirements.txt
	$(PNPM) install

dev:
	cd apps/api && $(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

worker:
	cd apps/api && PYTHONPATH=$(ROOT_DIR)/apps/api $(ROOT_DIR)/.venv/bin/rq worker default

test:
	cd apps/api && $(PYTHON) -m pytest tests

test-integration:
	cd apps/api && $(PYTHON) -m pytest tests/test_postgres_integration.py

lint:
	cd apps/api && $(PYTHON) -m ruff check app tests
	$(PNPM) --filter web lint

format:
	cd apps/api && $(PYTHON) -m ruff format app tests
	$(PNPM) --filter web format

db-up:
	docker compose up -d postgres redis

db-migrate:
	cd apps/api && PYTHONPATH=$(ROOT_DIR)/apps/api $(ROOT_DIR)/.venv/bin/alembic -c alembic.ini upgrade head

seed:
	cd apps/api && $(PYTHON) -m app.scripts.seed
