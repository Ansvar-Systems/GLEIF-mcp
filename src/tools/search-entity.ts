import type { DatabaseAdapter, LEIRecord } from '../database/types.js';
import { buildMeta, buildCitation, type MetaBlock, type CitationBlock } from './meta.js';

export interface SearchEntityInput {
  entity_name: string;
  limit?: number;
}

export interface SearchEntityResult extends LEIRecord {
  _citation: CitationBlock;
}

export interface SearchEntityOutput {
  results: SearchEntityResult[];
  total: number;
  _meta: MetaBlock;
}

/**
 * Search for entities by legal name (full-text search)
 */
export async function searchEntity(
  db: DatabaseAdapter,
  input: SearchEntityInput
): Promise<SearchEntityOutput> {
  const { entity_name, limit = 10 } = input;

  if (!entity_name || String(entity_name).trim().length === 0) {
    return {
      results: [],
      total: 0,
      _meta: buildMeta(),
    };
  }

  // Validate limit
  const safeLimit = Math.min(Math.max(1, limit), 100); // Between 1 and 100

  const { results, total } = db.searchEntity(String(entity_name), safeLimit);

  return {
    results: results.map(record => ({
      ...record,
      _citation: buildCitation(record.lei, record.legal_name),
    })),
    total,
    _meta: buildMeta(),
  };
}
