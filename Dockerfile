# Multi-stage Dockerfile for Railway
# This builds both API and Web services

# --- API Service ---
FROM python:3.12-slim AS api-base
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /api
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./apps/api/
COPY infra/db/migrations/ ./infra/db/migrations/

WORKDIR /api/apps/api
ENV PYTHONPATH=/api/apps/api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
