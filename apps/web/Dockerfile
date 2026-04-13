# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable pnpm

# ── Builder: install deps and compile ──────────────────────────────────────
FROM base AS builder
WORKDIR /build

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages first
COPY packages/ ./packages/

# Copy web app source
COPY apps/web/ ./apps/web/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build the web app with standalone output
WORKDIR /build/apps/web
RUN pnpm build

# ── Runner: lean production image ──────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy all build outputs
COPY --from=builder /build/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder /build/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /build/apps/web/public ./apps/web/public

EXPOSE 3000

# Use the standalone server.js
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
