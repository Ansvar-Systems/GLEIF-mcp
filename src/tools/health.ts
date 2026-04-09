import type { DatabaseAdapter, HealthStatus } from '../database/types.js';
import { buildMeta, type MetaBlock } from './meta.js';

export interface HealthOutput {
  server: string;
  version: string;
  database: HealthStatus;
  timestamp: string;
  _meta: MetaBlock;
}

/**
 * Get server and database health status
 */
export async function getHealth(db: DatabaseAdapter): Promise<HealthOutput> {
  const health = db.getHealth();

  return {
    server: 'gleif-mcp',
    version: '1.0.0',
    database: health,
    timestamp: new Date().toISOString(),
    _meta: buildMeta(health.data_age_hours),
  };
}
