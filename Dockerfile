# Multi-stage Dockerfile for Railway
# This builds the API service

FROM python:3.12-slim AS api-base

# Install curl for healthchecks and redis-tools for redis-cli
RUN apt-get update && apt-get install -y --no-install-recommends curl redis-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /api

# Install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./apps/api/
COPY infra/db/migrations/ ./infra/db/migrations/

# Copy wait-for-redis script
COPY apps/api/wait-for-redis.sh /usr/local/bin/wait-for-redis
RUN chmod +x /usr/local/bin/wait-for-redis

WORKDIR /api/apps/api
ENV PYTHONPATH=/api/apps/api

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Wait for Redis before starting the API
CMD ["sh", "-c", "/usr/local/bin/wait-for-redis && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
