FROM node:22-alpine AS base
RUN corepack enable pnpm

# ── Builder: install deps and compile ──────────────────────────────────────
FROM base AS builder
WORKDIR /monorepo

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace packages (web depends on @reliai/types)
COPY packages/ ./packages/

# Copy web app source
COPY apps/web/ ./apps/web/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build the web app (outputs to apps/web/.next/standalone via output: 'standalone')
RUN pnpm --filter web build

# ── Runner: lean production image ──────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone output contains everything needed to run the app
COPY --from=builder /monorepo/apps/web/.next/standalone ./
# Static assets and public files must be copied separately
COPY --from=builder /monorepo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /monorepo/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
