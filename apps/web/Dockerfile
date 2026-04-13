FROM node:22-alpine AS base
RUN corepack enable pnpm

# ── Builder: install deps and compile ──────────────────────────────────────
FROM base AS builder
WORKDIR /build

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace packages
COPY packages/ ./packages/

# Copy web app source
COPY apps/web/ ./apps/web/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build the web app
RUN pnpm --filter web build

# ── Runner: lean production image ──────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy entire built app structure
COPY --from=builder /build/apps/web/.next/standalone ./standalone
COPY --from=builder /build/apps/web/.next/static ./static
COPY --from=builder /build/apps/web/public ./public

EXPOSE 3000

CMD ["node", "standalone/apps/web/server.js"]
