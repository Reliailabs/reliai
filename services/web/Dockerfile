# Web Service Dockerfile for Railway
FROM node:20-alpine AS builder

WORKDIR /build

COPY apps/web/package*.json ./apps/web/
RUN cd apps/web && npm install --frozen-lockfile

COPY apps/web/ ./apps/web/
COPY packages/ ./packages/

WORKDIR /build/apps/web
RUN npm run build

# Production server
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /build/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder /build/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /build/apps/web/public ./apps/web/public

EXPOSE 3000

WORKDIR /app/apps/web/.next/standalone
CMD ["node", "apps/web/server.js"]
