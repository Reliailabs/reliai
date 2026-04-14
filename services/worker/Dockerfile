# Worker Service Dockerfile for Railway
FROM python:3.12-slim

# Install curl for healthchecks, redis-tools for redis-cli, and ca-certificates for TLS
RUN apt-get update && apt-get install -y --no-install-recommends curl redis-tools ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY apps/api/ ./apps/api/
COPY infra/db/migrations/ ./infra/db/migrations/

# Copy wait-for-redis script
COPY apps/api/wait-for-redis.sh /usr/local/bin/wait-for-redis
RUN chmod +x /usr/local/bin/wait-for-redis

# Set PYTHONPATH
ENV PYTHONPATH=/app/apps/api:/app

WORKDIR /app/apps/api

EXPOSE 8000

CMD ["sh", "-c", "/usr/local/bin/wait-for-redis && exec python -m app.scripts.rq_worker"]
