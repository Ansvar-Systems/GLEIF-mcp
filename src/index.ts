#!/usr/bin/env node

/**
 * GLEIF MCP Server - Stdio Entry Point
 *
 * This provides stdio transport for local Claude Desktop usage.
 * Use src/http-server.ts for remote/Docker deployment.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Database from '@ansvar/mcp-sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { registerTools } from './tools/registry.js';
import { createSqliteAdapter } from './database/sqlite-adapter.js';
import type { DatabaseAdapter } from './database/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - look for gleif.db in data folder
const DB_PATH = process.env.GLEIF_DB_PATH || join(__dirname, '..', 'data', 'gleif.db');

let db: DatabaseAdapter;

function getDatabase(): DatabaseAdapter {
  if (!db) {
    try {
      const sqliteDb = new Database(DB_PATH, { readonly: true });
      db = createSqliteAdapter(sqliteDb);
    } catch (error) {
      throw new Error(`Failed to open database at ${DB_PATH}: ${error}`);
    }
  }
  return db;
}

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
registerTools(server, getDatabase());

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GLEIF MCP server started (stdio)');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
