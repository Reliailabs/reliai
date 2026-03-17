FROM python:3.12-slim

# Install curl for healthchecks
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY apps/api/ ./apps/api/

# Copy Alembic migrations (alembic.ini references ../../infra/db/migrations from apps/api/)
COPY infra/db/migrations/ ./infra/db/migrations/

# Set working directory and Python path to match local dev setup
WORKDIR /app/apps/api
ENV PYTHONPATH=/app/apps/api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
