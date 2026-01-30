import type { DatabaseAdapter, HealthStatus } from '../database/types.js';

export interface HealthOutput {
  server: string;
  version: string;
  database: HealthStatus;
  timestamp: string;
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
  };
}
