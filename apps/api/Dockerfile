FROM python:3.12-slim

# Install curl for healthchecks and redis-tools for redis-cli
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl redis-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY apps/api/ ./apps/api/

# Copy Alembic migrations (alembic.ini references ../../infra/db/migrations from apps/api/)
COPY infra/db/migrations/ ./infra/db/migrations/

# Copy wait-for-redis script
COPY apps/api/wait-for-redis.sh /usr/local/bin/wait-for-redis
RUN chmod +x /usr/local/bin/wait-for-redis

# Set working directory and Python path to match local dev setup
WORKDIR /app/apps/api
ENV PYTHONPATH=/app/apps/api

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Default command for API - wait for Redis before starting
CMD ["sh", "-c", "/usr/local/bin/wait-for-redis && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
