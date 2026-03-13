FROM oven/bun:1.3.10-slim

WORKDIR /app

# Copy package files
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/docs/package.json apps/docs/
COPY apps/mobile/package.json apps/mobile/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY apps/web/ apps/web/

# Build
RUN bun run build --filter=web

# Create data directory for SQLite
RUN mkdir -p /app/apps/web/data

EXPOSE 3000

ENV DATABASE_URL=/app/apps/web/data/sqlite.db
ENV BETTER_AUTH_URL=http://localhost:3000
ENV NODE_ENV=production

WORKDIR /app/apps/web
CMD ["bun", "run", "start"]
