# Multi-stage Dockerfile for Railway
# Services: api (API), web (Frontend), worker (Background jobs)

# --- Base Python stage (shared by API and Worker) ---
FROM python:3.12-slim AS python-base

# Install curl for healthchecks and redis-tools for redis-cli
RUN apt-get update && apt-get install -y --no-install-recommends curl redis-tools \
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

# Set PYTHONPATH to support imports from both apps/api and infra
ENV PYTHONPATH=/app/apps/api:/app


# --- API Service ---
FROM python-base AS api

WORKDIR /app/apps/api

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["sh", "-c", "/usr/local/bin/wait-for-redis && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]


# --- Worker Service ---
FROM python-base AS worker

WORKDIR /app/apps/api

# Worker uses RQ for job queue processing
CMD ["sh", "-c", "/usr/local/bin/wait-for-redis && exec python -m app.scripts.rq_worker"]


# --- Web Service (Next.js) ---
FROM node:20-alpine AS web-base

WORKDIR /build
COPY apps/web/package*.json ./apps/web/
RUN cd apps/web && npm install --frozen-lockfile

COPY apps/web/ ./apps/web/
COPY packages/ ./packages/

WORKDIR /build/apps/web
RUN npm run build

# Production web server (Next.js standalone mode)
FROM node:20-alpine AS web

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=web-base /build/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=web-base /build/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-base /build/apps/web/public ./apps/web/public

EXPOSE 3000

WORKDIR /app/apps/web/.next/standalone
CMD ["node", "apps/web/server.js"]


# --- Production target (API) ---
FROM api AS production
