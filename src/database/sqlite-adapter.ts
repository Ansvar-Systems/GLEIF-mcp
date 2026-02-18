import type Database from '@ansvar/mcp-sqlite';
import type {
  DatabaseAdapter,
  LEIRecord,
  SearchResult,
  HealthStatus,
  SyncLogEntry,
} from './types.js';

const MIN_PRODUCTION_ENTITY_COUNT = Number.parseInt(process.env.GLEIF_MIN_ENTITY_COUNT || '1000000', 10);
const MIN_COMPLETENESS_RATIO = 0.98;

function parseExpectedEntityCount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

const FTS5_KEYWORDS = new Set(['AND', 'OR', 'NOT', 'NEAR']);

export function buildFtsPrefixQuery(input: string): string {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(token => token.length > 0)
    .filter(token => !FTS5_KEYWORDS.has(token.toUpperCase()));

  if (tokens.length === 0) {
    const sanitized = input.replace(/[^\p{L}\p{N}\s]+/gu, '').trim();
    if (sanitized.length === 0) return '""';
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return tokens.map(token => `"${token}"*`).join(' ');
}

/**
 * SQLite adapter for GLEIF MCP
 * Provides read-only access to local LEI database
 */
export function createSqliteAdapter(db: InstanceType<typeof Database>): DatabaseAdapter {
  return {
    type: 'sqlite' as const,

    verifyLEI(lei: string): LEIRecord | null {
      const normalizedLei = lei.toUpperCase().trim();

      const stmt = db.prepare(`
        SELECT * FROM entities WHERE lei = ?
      `);

      const row = stmt.get(normalizedLei);

      return row ? (row as LEIRecord) : null;
    },

    searchEntity(name: string, limit: number = 10): SearchResult {
      const searchQuery = name.trim();
      const safeLimit = Math.max(1, Math.min(100, limit));

      if (!searchQuery) {
        return { results: [], total: 0 };
      }

      const ftsQuery = buildFtsPrefixQuery(searchQuery);

      try {
        const stmt = db.prepare(`
          SELECT e.*
          FROM entities_fts fts
          INNER JOIN entities e ON e.rowid = fts.rowid
          WHERE fts.legal_name MATCH ?
          ORDER BY rank
          LIMIT ?
        `);

        const totalStmt = db.prepare(`
          SELECT COUNT(*) as count
          FROM entities_fts
          WHERE legal_name MATCH ?
        `);

        const rows = stmt.all(ftsQuery, safeLimit);
        const totalRow = totalStmt.get(ftsQuery) as { count: number };

        return {
          results: rows as LEIRecord[],
          total: totalRow.count,
        };
      } catch {
        // Fallback for user queries containing unsupported FTS syntax characters.
        const likeQuery = `%${searchQuery.toLowerCase()}%`;
        const fallbackStmt = db.prepare(`
          SELECT *
          FROM entities
          WHERE legal_name_lower LIKE ?
          ORDER BY legal_name ASC
          LIMIT ?
        `);
        const fallbackCountStmt = db.prepare(`
          SELECT COUNT(*) as count
          FROM entities
          WHERE legal_name_lower LIKE ?
        `);

        const rows = fallbackStmt.all(likeQuery, safeLimit);
        const totalRow = fallbackCountStmt.get(likeQuery) as { count: number };

        return {
          results: rows as LEIRecord[],
          total: totalRow.count,
        };
      }
    },

    getHealth(): HealthStatus {
      // Get total entity count
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM entities');
      const countRow = countStmt.get() as { count: number };
      const entityCount = countRow.count;

      // Get last successful sync
      const syncStmt = db.prepare(`
        SELECT completed_at FROM sync_log
        WHERE status = 'success'
        ORDER BY completed_at DESC
        LIMIT 1
      `);
      const syncRow = syncStmt.get() as { completed_at: string } | undefined;

      // Calculate data age
      let dataAgeHours: number | null = null;
      let freshnessStatus: 'current' | 'stale' | 'critical' | 'never_synced' = 'never_synced';

      if (syncRow?.completed_at) {
        const lastSyncDate = new Date(syncRow.completed_at);
        const now = new Date();
        dataAgeHours = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60);

        if (dataAgeHours < 24) {
          freshnessStatus = 'current';
        } else if (dataAgeHours < 72) {
          freshnessStatus = 'stale';
        } else {
          freshnessStatus = 'critical';
        }
      }

      // Get metadata
      const metadataStmt = db.prepare('SELECT key, value FROM metadata');
      const metadataRows = metadataStmt.all() as Array<{ key: string; value: string }>;
      const metadata = Object.fromEntries(
        metadataRows.map(row => [row.key, row.value])
      );

      const expectedEntityCount = parseExpectedEntityCount(metadata.expected_entities);
      const coverageRatio = expectedEntityCount ? entityCount / expectedEntityCount : null;

      let dataQualityStatus: 'ok' | 'incomplete' | 'unknown' = 'unknown';
      let productionReady = false;

      if (expectedEntityCount) {
        const completeEnough = coverageRatio !== null && coverageRatio >= MIN_COMPLETENESS_RATIO;
        productionReady = completeEnough && entityCount >= MIN_PRODUCTION_ENTITY_COUNT;
        dataQualityStatus = productionReady ? 'ok' : 'incomplete';
      } else if (entityCount >= MIN_PRODUCTION_ENTITY_COUNT) {
        productionReady = true;
        dataQualityStatus = 'ok';
      }

      return {
        entity_count: entityCount,
        expected_entity_count: expectedEntityCount,
        coverage_ratio: coverageRatio,
        production_ready: productionReady,
        data_quality_status: dataQualityStatus,
        last_sync: syncRow?.completed_at || null,
        data_age_hours: dataAgeHours,
        freshness_status: freshnessStatus,
        sync_enabled: metadata.sync_enabled === 'true',
        database_version: metadata.database_version || '1.0.0',
      };
    },

    getSyncHistory(limit: number = 10): SyncLogEntry[] {
      const stmt = db.prepare(`
        SELECT * FROM sync_log
        ORDER BY started_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(limit);
      return rows as SyncLogEntry[];
    },

    close(): void {
      db.close();
    },
  };
}
