#!/usr/bin/env node

/**
 * GLEIF MCP Server - HTTP Entry Point
 *
 * This provides Streamable HTTP transport for Docker/remote deployment.
 * Use src/index.ts for local stdio-based usage.
 */

import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import Database from '@ansvar/mcp-sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

import { registerTools } from './tools/registry.js';
import { createSqliteAdapter } from './database/sqlite-adapter.js';
import { assertProductionReadyDatabase } from './database/readiness.js';
import type { DatabaseAdapter } from './database/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - look for gleif.db in data folder
const DB_PATH = process.env.GLEIF_DB_PATH || join(__dirname, '..', 'data', 'gleif.db');

// HTTP server port
const PORT = parseInt(process.env.PORT || '3000', 10);

// Maximum concurrent MCP sessions
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '100', 10);
const SESSION_IDLE_TTL_MS = parseInt(process.env.SESSION_IDLE_TTL_MS || '900000', 10);

let db: DatabaseAdapter;

interface SessionState {
  transport: StreamableHTTPServerTransport;
  lastSeenAt: number;
}

function getDatabase(): DatabaseAdapter {
  if (!db) {
    try {
      const sqliteDb = new Database(DB_PATH, { readonly: true });
      assertProductionReadyDatabase(sqliteDb);
      db = createSqliteAdapter(sqliteDb);
    } catch (error) {
      throw new Error(`Failed to open database at ${DB_PATH}: ${error}`);
    }
  }
  return db;
}

// Create MCP server instance
function createMcpServer(): Server {
  const db = getDatabase();
  const server = new Server(
    {
      name: 'gleif-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools using shared registry
  registerTools(server, db);

  return server;
}

// Start HTTP server with Streamable HTTP transport
async function main() {
  // Map to store transports by session ID
  const sessions = new Map<string, SessionState>();

  const closeSession = async (sessionId: string, session: SessionState) => {
    sessions.delete(sessionId);

    const closableTransport = session.transport as StreamableHTTPServerTransport & {
      close?: () => Promise<void> | void;
    };

    try {
      await closableTransport.close?.();
    } catch (error) {
      console.error(`Failed to close idle MCP session ${sessionId}:`, error);
    }
  };

  const pruneIdleSessions = async () => {
    if (sessions.size === 0) {
      return;
    }

    const cutoff = Date.now() - SESSION_IDLE_TTL_MS;
    const staleSessions = [...sessions.entries()].filter(([, session]) => session.lastSeenAt < cutoff);

    for (const [sessionId, session] of staleSessions) {
      await closeSession(sessionId, session);
    }

    if (staleSessions.length > 0) {
      console.error(`Pruned ${staleSessions.length} idle MCP sessions`);
    }
  };

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      try {
        const health = getDatabase().getHealth();
        const status = health.freshness_status === 'critical' ? 'degraded'
          : health.freshness_status === 'stale' ? 'stale'
          : 'ok';
        const httpStatus = status === 'degraded' ? 503 : 200;
        res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status,
          server: 'gleif-mcp',
          version: '1.0.0',
          database: {
            entity_count: health.entity_count,
            production_ready: health.production_ready,
            freshness_status: health.freshness_status,
            data_age_hours: health.data_age_hours,
            last_sync: health.last_sync,
          },
          timestamp: new Date().toISOString(),
        }));
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', server: 'gleif-mcp', error: 'Database unavailable' }));
      }
      return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
      await pruneIdleSessions();

      // Get or create session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      let transport: StreamableHTTPServerTransport;
      const now = Date.now();

      if (sessionId && sessions.has(sessionId)) {
        // Reuse existing transport for this session
        const session = sessions.get(sessionId)!;
        session.lastSeenAt = now;
        transport = session.transport;
      } else {
        // Reject if session limit reached
        if (sessions.size >= MAX_SESSIONS) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Too many sessions' }));
          return;
        }

        // Create a new MCP server instance per session for isolation
        const mcpServer = createMcpServer();
        // Create new transport with session ID generator
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        // Connect MCP server to transport
        await mcpServer.connect(transport);

        // Store transport by session ID once it's assigned
        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };
      }

      // Handle the request
      await transport.handleRequest(req, res);

      // Store transport if new session was created
      if (transport.sessionId) {
        const existingSession = sessions.get(transport.sessionId);
        if (existingSession) {
          existingSession.lastSeenAt = now;
        } else {
          sessions.set(transport.sessionId, { transport, lastSeenAt: now });
        }
      }

      return;
    }

    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  httpServer.listen(PORT, () => {
    console.error(`GLEIF MCP server (HTTP) listening on port ${PORT}`);
    console.error(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.error(`Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down...');
    httpServer.close(() => {
      if (db) db.close();
      process.exit(0);
    });
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
