# Deploying Reliai to Railway

This guide covers deploying Reliai to Railway with managed PostgreSQL, Redis, and auto-scaling.

## Prerequisites

- A [Railway account](https://railway.app/)
- Railway CLI (`npm install -g @railway/cli`)
- Git repository (optional, for GitHub integration)

## Deployment Methods

### Method 1: Using Railway CLI (Recommended)

1. **Login to Railway**:
```bash
cd /path/to/reliai
railway login
```

2. **Create a new project**:
```bash
railway init
# Choose "Create a new project" and name it "reliai"
```

3. **Set environment variables**:
```bash
railway variables set API_KEY_HASH_SECRET=$(openssl rand -base64 32)
railway variables set AUTH_SESSION_HASH_SECRET=$(openssl rand -base64 32)
railway variables set APP_URL=https://your-app.railway.app
```

4. **Deploy services**:
```bash
railway up
```

5. **Get your URLs**:
```bash
railway open
railway services
```

### Method 2: GitHub Integration

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Connect your GitHub repository
4. Railway will auto-detect the `railfile.yml`
5. Add environment variables in the Variables tab
6. Click "Deploy"

### Method 3: Using `railway.json`

If you prefer the JSON format:
```bash
railway new --json railway.json
railway variables set API_KEY_HASH_SECRET=your-secret
railway variables set AUTH_SESSION_HASH_SECRET=your-secret
railway up
```

## Managed Services

Railway will automatically provision:

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL 16 (10GB storage) |
| redis | 6379 | Redis 7 |

Connection strings are automatically injected into your services.

## Environment Variables

Required variables (set via Railway CLI or UI):

```bash
API_KEY_HASH_SECRET=generate-with-openssl  # 32+ chars
AUTH_SESSION_HASH_SECRET=generate-with-openssl  # 32+ chars
APP_URL=https://your-app.railway.app
```

Optional (for production auth with WorkOS):

```bash
WORKOS_API_KEY=your-workos-key
WORKOS_CLIENT_ID=your-workos-client-id
WORKOS_REDIRECT_URI=https://your-app.railway.app/api/auth/callback
```

## Service URLs

After deployment, Railway assigns URLs in this format:

- **Web**: `https://web.railway.app` (port 3000)
- **API**: `https://api.railway.app` (port 8000)

The web service is your main entry point.

## Post-Deployment

1. Run database migrations:
```bash
railway variables set PYTHONPATH=/app/apps/api
railway run -- python -m alembic -c alembic.ini upgrade head
```

2. Seed initial data:
```bash
railway run -- python -m app.scripts.seed
```

3. Verify health:
```bash
curl https://api.railway.app/api/v1/health
```

## Scaling

Railway auto-scales based on traffic. To configure manual scaling:

```bash
# Set minimum instances (default: 1)
railway scale --min-instances 1

# Set memory (default: 4096 MB)
railway scale --memory 4096
```

## Cost Estimate

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 | $5 monthly credit |
| Pro | $5/mo | $5 credit + more resources |
| Scale | $25/mo | $25 credit |

For a small Reliai deployment (API + Web + DB + Redis), expect **$5-10/month**.

## Troubleshooting

### Service won't start
Check logs: `railway logs -s api` or `railway logs -s web`

### Database connection failed
Verify the `DATABASE_URL` environment variable is set correctly. Railway auto-injects it, but you can override in the Variables tab.

### Port already in use
Ensure your Dockerfile exposes the correct port (8000 for API, 3000 for Web).

## Maintenance

### Running migrations
```bash
railway run -- python -m alembic -c alembic.ini upgrade head
```

### Restarting services
```bash
railway restart -s api
railway restart -s web
```

### View metrics
```bash
railway metrics
```

## Cleaning Up

To delete the deployment:
```bash
railway destroy
# Or delete via Railway Dashboard → Project → Settings → Destroy
```
