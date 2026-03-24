# GLEIF MCP Server
# Multi-stage build for production deployment
#
# Data refresh: rebuild the image or run `npm run sync` via docker exec.
# In-container cron was removed because compose security hardening
# (cap_drop: ALL, no-new-privileges, user: nodejs) prevents crond.

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Clean up npm cache
RUN npm cache clean --force

# Security: create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Copy database schema (needed for initial build)
COPY src/database/schema.sql ./src/database/schema.sql

# Create data directory
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

ENV NODE_ENV=production
ENV PORT=3000
ENV GLEIF_DB_PATH=/app/data/gleif.db

EXPOSE 3000

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)throw r;process.exit(0)}).catch(()=>process.exit(1))"

CMD ["node", "dist/http-server.js"]
