# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Install deps first (layer-cached unless lockfile changes)
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

RUN bun run build

# The Vite SSR build (vite.config.ts has nitro: false) externalizes node_modules
# as bare imports rather than bundling them, so the runtime needs real packages
# present. Prune dev dependencies down to production-only for a lean runtime tree.
RUN bun install --production --frozen-lockfile

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

# Copy built output, migration + server scripts, and the production node_modules.
# The server (scripts/node-server.mjs) and migrate.mjs both load deps (pg, sharp,
# jsdom via isomorphic-dompurify, @tanstack/*, react, …) from node_modules at
# runtime, since the build keeps them external.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
