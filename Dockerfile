# DEPRECATED: This Dockerfile is kept for backwards compatibility.
# Railway deployments should use the services/ directory structure instead:
#   - services/api/Dockerfile   (API service)
#   - services/worker/Dockerfile (Worker service)
#   - services/web/Dockerfile   (Web service)

# For local development with docker-compose, use: docker-compose up --build
# For Railway, each service has its own Dockerfile in the services/ folder.

FROM python:3.12-slim AS api-base

RUN apt-get update && apt-get install -y --no-install-recommends curl redis-tools ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./apps/api/
COPY infra/db/migrations/ ./infra/db/migrations/

COPY apps/api/wait-for-redis.sh /usr/local/bin/wait-for-redis
RUN chmod +x /usr/local/bin/wait-for-redis

ENV PYTHONPATH=/app/apps/api:/app

WORKDIR /app/apps/api

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["sh", "-c", "/usr/local/bin/wait-for-redis && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
