import type { DatabaseAdapter, SearchResult } from '../database/types.js';

export interface SearchEntityInput {
  entity_name: string;
  limit?: number;
}

/**
 * Search for entities by legal name (full-text search)
 */
export async function searchEntity(
  db: DatabaseAdapter,
  input: SearchEntityInput
): Promise<SearchResult> {
  const { entity_name, limit = 10 } = input;

  if (!entity_name || entity_name.trim().length === 0) {
    return {
      results: [],
      total: 0,
    };
  }

  // Validate limit
  const safeLimit = Math.min(Math.max(1, limit), 100); // Between 1 and 100

  return db.searchEntity(entity_name, safeLimit);
}
