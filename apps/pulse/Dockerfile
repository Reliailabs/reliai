FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/pulse ./apps/pulse/
COPY packages ./packages

RUN pnpm install --frozen-lockfile
WORKDIR /build/apps/pulse
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005
ENV HOSTNAME=0.0.0.0

COPY --from=builder /build/apps/pulse/.next/standalone ./apps/pulse/.next/standalone

WORKDIR /app/apps/pulse/.next/standalone
COPY --from=builder /build/apps/pulse/.next/static ./apps/pulse/.next/static
COPY --from=builder /build/apps/pulse/public ./apps/pulse/public

EXPOSE 3005

CMD ["node", "apps/pulse/server.js"]
