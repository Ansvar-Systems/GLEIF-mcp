import type Database from 'better-sqlite3';
import type {
  DatabaseAdapter,
  LEIRecord,
  SearchResult,
  HealthStatus,
  SyncLogEntry,
} from './types.js';

/**
 * SQLite adapter for GLEIF MCP
 * Provides read-only access to local LEI database
 */
export function createSqliteAdapter(db: Database.Database): DatabaseAdapter {
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
      // Use FTS5 for full-text search
      const searchQuery = name.trim();

      if (!searchQuery) {
        return { results: [], total: 0 };
      }

      // FTS5 MATCH query with ranking
      const stmt = db.prepare(`
        SELECT e.*
        FROM entities_fts fts
        INNER JOIN entities e ON e.rowid = fts.rowid
        WHERE fts.legal_name MATCH ?
        ORDER BY rank
        LIMIT ?
      `);

      const rows = stmt.all(searchQuery, limit);

      return {
        results: rows as LEIRecord[],
        total: rows.length,
      };
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

      return {
        entity_count: entityCount,
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
