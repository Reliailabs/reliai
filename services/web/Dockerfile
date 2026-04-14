# Web Service Dockerfile for Railway
FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web ./apps/web/
COPY packages ./packages

RUN pnpm install --frozen-lockfile
WORKDIR /build/apps/web
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /build/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder /build/apps/web/.next/static ./apps/web/.next/standalone/apps/web/.next/static
COPY --from=builder /build/apps/web/public ./apps/web/.next/standalone/apps/web/public

EXPOSE 3000

WORKDIR /app/apps/web/.next/standalone
CMD ["node", "apps/web/server.js"]
