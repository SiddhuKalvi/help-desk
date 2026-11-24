FROM oven/bun:1-alpine
WORKDIR /app

# manifests first for layer caching
COPY package.json bun.lock ./
COPY core/package.json core/
COPY server/package.json server/
COPY client/package.json client/
COPY e2e/package.json e2e/
RUN bun install --frozen-lockfile

# real source
COPY core core
COPY server server
COPY client client

# Vite bakes VITE_* into the bundle at build time. Same-origin deployment
# means the client can call a relative path, so this defaults to empty
# rather than needing to know the eventual public domain in advance.
ARG VITE_SERVER_URL=""
ARG VITE_SENTRY_DSN=""
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

WORKDIR /app/client
RUN bun run build

WORKDIR /app/server
RUN bunx prisma generate

EXPOSE 3001
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run seed:ai-agent && ([ -z \"$ADMIN_EMAIL\" ] || [ -z \"$ADMIN_PASSWORD\" ] || bun prisma/seed.ts) && bun run start"]
