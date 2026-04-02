# GLEIF MCP Server — Deploy Strategy A (bundled DB)
#
# Three-stage build:
#   1. builder  — compile TypeScript
#   2. data     — download GLEIF Golden Copy and build SQLite DB (~1.6 GB)
#   3. runtime  — minimal production image with bundled DB
#
# Data is baked into the image at build time. No runtime downloads,
# no volume dependencies, no cron. Rebuild the image to refresh data.
# GHCR build runs on push to main; Watchtower auto-pulls every 6h.

# ── Stage 1: Build TypeScript ───────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN npm run build

# ── Stage 2: Build database ────────────────────────────────────
FROM node:20-alpine AS data

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY --from=builder /app/dist ./dist

# Download GLEIF Golden Copy and build SQLite DB (~15 min, ~1.6 GB)
ENV GLEIF_MIN_ENTITY_COUNT=0
RUN mkdir -p /app/data && node --import tsx scripts/build-db.ts

# ── Stage 3: Production runtime ────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY src/database/schema.sql ./src/database/schema.sql

# Copy bundled database from data stage
COPY --from=data /app/data/gleif.db ./data/gleif.db

RUN chown -R nodejs:nodejs /app

ENV NODE_ENV=production
ENV PORT=3000
ENV GLEIF_DB_PATH=/app/data/gleif.db

EXPOSE 3000
USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)throw r;process.exit(0)}).catch(()=>process.exit(1))"

CMD ["node", "dist/http-server.js"]
