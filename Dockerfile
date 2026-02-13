# GLEIF MCP Server
# Multi-stage build for production deployment
# Includes cron for daily GLEIF sync at 3 AM UTC

# Build stage
FROM --platform=linux/amd64 node:20-alpine AS builder

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

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
FROM --platform=linux/amd64 node:20-alpine AS production

# Install runtime dependencies and cron
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    dcron \
    curl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Clean up build tools
RUN apk del python3 make g++ && \
    npm cache clean --force

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

# Set up cron job for daily sync (3 AM UTC)
RUN echo "0 3 * * * cd /app && /usr/local/bin/node dist/../scripts/sync-gleif.js >> /var/log/gleif-sync.log 2>&1" > /etc/crontabs/root

# Note: Running as root to allow crond to function
# This is acceptable for internal MCP servers in controlled Docker networks

ENV NODE_ENV=production
ENV PORT=3000
ENV GLEIF_DB_PATH=/app/data/gleif.db

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start cron in background and run HTTP server
CMD ["sh", "-c", "crond && node dist/http-server.js"]
