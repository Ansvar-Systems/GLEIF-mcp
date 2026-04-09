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
import { buildMeta } from './meta.js';

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
      'Verify a Legal Entity Identifier (LEI) against the local GLEIF Golden Copy database (3.2M+ entities, ISO 17442). Returns full entity details: legal name, legal and headquarters addresses, registration status (ISSUED/LAPSED/RETIRED/ANNULLED), jurisdiction, managing LOU, and registration dates.\n\nUse this tool when you have a specific 20-character LEI code and need to confirm it is valid and retrieve entity information. Do NOT use this tool to search by company name — use search_entity instead.\n\nReturns { found: true, lei, entity, _meta, _citation } on match, or { found: false, message, _error_type, _meta } if the LEI is invalid or not in the database. Data is sourced from the GLEIF Golden Copy (updated daily, CC0 licensed).',
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
      'Search for legal entities by name using full-text search across 3.2M+ LEI records. Returns matching entities ranked by relevance with their LEI codes, legal names, addresses, registration status, and jurisdiction.\n\nUse this tool when you know a company or organization name (or partial name) and need to find their LEI. Supports prefix matching — e.g., "Deutsche" will match "Deutsche Bank". For exact LEI lookups, use verify_lei instead.\n\nReturns { results: SearchEntityResult[], total: number, _meta }. Each result includes a _citation block. Results are ranked by FTS5 relevance. Default limit is 10, maximum 100. Returns empty results (not an error) if no matches found.',
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
  {
    name: 'about',
    description:
      'Returns information about this MCP server: its purpose, data source, license, update schedule, and available tools. Use this tool when you need to understand what this server does, where its data comes from, or what tools are available.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_db, _args) => ({
      name: 'gleif-mcp',
      description:
        'Offline-first MCP server for Legal Entity Identifier (LEI) verification. Provides access to 3.2M+ LEI records from the GLEIF Golden Copy database (ISO 17442).',
      data_source: 'GLEIF Golden Copy',
      data_license: 'CC0 1.0 Universal (Public Domain)',
      source_url: 'https://www.gleif.org/en/lei-data/gleif-golden-copy',
      update_schedule: 'Daily at 03:00 UTC',
      tools: ['verify_lei', 'search_entity', 'get_health', 'about', 'list_sources', 'check_data_freshness'],
      repository: 'https://github.com/Ansvar-Systems/GLEIF-MCP',
      _meta: buildMeta(),
    }),
  },
  {
    name: 'list_sources',
    description:
      'Returns a list of data sources used by this MCP server, including provenance, license, and update frequency. Use this tool to understand the origin and reliability of the data returned by verify_lei and search_entity.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_db, _args) => ({
      sources: [
        {
          name: 'GLEIF Golden Copy',
          description:
            'Full daily snapshot of all registered Legal Entity Identifiers (LEIs) worldwide. Published by the Global Legal Entity Identifier Foundation (GLEIF).',
          url: 'https://www.gleif.org/en/lei-data/gleif-golden-copy',
          license: 'CC0 1.0 Universal (Public Domain)',
          update_frequency: 'Daily',
          record_count: '3.2M+',
          standard: 'ISO 17442',
          coverage: 'Global',
        },
      ],
      _meta: buildMeta(),
    }),
  },
  {
    name: 'check_data_freshness',
    description:
      'Check the freshness and completeness of the local GLEIF database. Returns data age, last sync timestamp, coverage ratio, and a freshness verdict. Use this tool before performing bulk lookups or when data currency is critical. Freshness statuses: "current" (<24h), "stale" (24-72h), "critical" (>72h), "never_synced".',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (db, _args) => {
      const health = db.getHealth();
      return {
        freshness_status: health.freshness_status,
        data_age_hours: health.data_age_hours,
        last_sync: health.last_sync,
        entity_count: health.entity_count,
        coverage_ratio: health.coverage_ratio,
        production_ready: health.production_ready,
        verdict:
          health.freshness_status === 'current'
            ? 'Data is current. Safe for lookups.'
            : health.freshness_status === 'stale'
              ? 'Data is stale (>24h). Results may not reflect recent changes.'
              : health.freshness_status === 'critical'
                ? 'Data is critically outdated (>72h). Use with caution.'
                : 'Database has never been synced. Run npm run build:db first.',
        _meta: buildMeta(health.data_age_hours),
      };
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
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              _error_type: 'tool_error',
            }),
          },
        ],
        isError: true,
      };
    }
  });
}
