import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import type { DatabaseAdapter } from '../database/types.js';

import { verifyLEI, type VerifyLEIInput } from './verify-lei.js';
import { searchEntity, type SearchEntityInput } from './search-entity.js';
import { getHealth } from './health.js';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (db: DatabaseAdapter, args: any) => Promise<any>;
}

/**
 * Centralized registry of all GLEIF MCP tools.
 * Single source of truth for both stdio and HTTP servers.
 */
export const TOOLS: ToolDefinition[] = [
  {
    name: 'verify_lei',
    description:
      'Verify a Legal Entity Identifier (LEI) against the local GLEIF Golden Copy database (3.2M+ entities, ISO 17442). Returns full entity details: legal name, legal and headquarters addresses, registration status (ISSUED/LAPSED/RETIRED/ANNULLED), jurisdiction, managing LOU, and registration dates.\n\nUse this tool when you have a specific 20-character LEI code and need to confirm it is valid and retrieve entity information. Do NOT use this tool to search by company name — use search_entity instead.\n\nReturns { found: true, lei, entity } on match, or { found: false, message } if the LEI is invalid or not in the database. Data is sourced from the GLEIF Golden Copy (updated daily, CC0 licensed).',
    inputSchema: {
      type: 'object',
      properties: {
        lei: {
          type: 'string',
          description: 'The 20-character LEI code to verify (e.g., "549300XQFX8FNB77HY47")',
          pattern: '^[A-Za-z0-9]{20}$',
          minLength: 20,
          maxLength: 20,
        },
      },
      required: ['lei'],
    },
    handler: async (db, args) => {
      const input = args as unknown as VerifyLEIInput;
      return await verifyLEI(db, input);
    },
  },
  {
    name: 'search_entity',
    description:
      'Search for legal entities by name using full-text search across 3.2M+ LEI records. Returns matching entities ranked by relevance with their LEI codes, legal names, addresses, registration status, and jurisdiction.\n\nUse this tool when you know a company or organization name (or partial name) and need to find their LEI. Supports prefix matching — e.g., "Deutsche" will match "Deutsche Bank". For exact LEI lookups, use verify_lei instead.\n\nReturns { results: LEIRecord[], total: number }. Results are ranked by FTS5 relevance. Default limit is 10, maximum 100. Returns empty results (not an error) if no matches found.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_name: {
          type: 'string',
          description: 'The entity name or partial name to search for (e.g., "Apple Inc", "Deutsche Bank")',
          minLength: 1,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 100)',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['entity_name'],
    },
    handler: async (db, args) => {
      const input = args as unknown as SearchEntityInput;
      return await searchEntity(db, input);
    },
  },
  {
    name: 'get_health',
    description:
      'Get GLEIF MCP server health status including database statistics, data freshness, and sync status. Returns entity count, expected count, coverage ratio, production readiness flag, last sync timestamp, data age in hours, freshness status (current/stale/critical/never_synced), and database version.\n\nUse this tool to check whether the local GLEIF database is up-to-date and production-ready before relying on verify_lei or search_entity results. A freshness_status of "stale" or "critical" means data may be outdated.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (db, _args) => {
      return await getHealth(db);
    },
  },
];

/**
 * Register all tools with an MCP server instance.
 * Use this for both stdio and HTTP servers to ensure parity.
 */
export function registerTools(server: Server, db: DatabaseAdapter): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;
    const tool = TOOLS.find(t => t.name === name);

    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      const result = await tool.handler(db, args || {});
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });
}
