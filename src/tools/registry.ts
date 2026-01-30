import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
      'Verify a Legal Entity Identifier (LEI) and return full entity details including legal name, addresses, registration status, and managing LOU. Returns NOT_FOUND if LEI does not exist in the local database.',
    inputSchema: {
      type: 'object',
      properties: {
        lei: {
          type: 'string',
          description: 'The 20-character LEI code to verify (e.g., "549300XQFX8FNB77HY47")',
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
      'Search for legal entities by name using full-text search. Returns matching entities with their LEI codes and basic information. Useful for finding the LEI of a company when you only know the name.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_name: {
          type: 'string',
          description: 'The entity name or partial name to search for (e.g., "Apple Inc", "Deutsche Bank")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 100)',
          default: 10,
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
      'Get GLEIF MCP server health status including database freshness, entity count, last sync time, and data age. Use this to check if the local database is up-to-date.',
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
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
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
