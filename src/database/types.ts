/**
 * Database adapter interface for GLEIF MCP
 * Supports both read and write operations
 */

export interface LEIRecord {
  lei: string;
  legal_name: string;
  legal_name_lower: string;
  registration_status: string;
  jurisdiction: string | null;
  category: string | null;

  // Legal Address
  legal_address_line1: string | null;
  legal_address_line2: string | null;
  legal_address_city: string | null;
  legal_address_region: string | null;
  legal_address_country: string | null;
  legal_address_postal_code: string | null;

  // Headquarters Address
  hq_address_line1: string | null;
  hq_address_line2: string | null;
  hq_address_city: string | null;
  hq_address_region: string | null;
  hq_address_country: string | null;
  hq_address_postal_code: string | null;

  // Registration Details
  initial_registration_date: string | null;
  last_update_date: string | null;
  next_renewal_date: string | null;
  managing_lou: string | null;

  entity_status: string | null;
  entity_category: string | null;
}

export interface SearchResult {
  results: LEIRecord[];
  total: number;
}

export interface SyncLogEntry {
  id: number;
  sync_type: 'full' | 'delta';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failed';
  records_added: number;
  records_updated: number;
  records_deleted: number;
  error_message: string | null;
  source_url: string | null;
}

export interface HealthStatus {
  entity_count: number;
  last_sync: string | null;
  data_age_hours: number | null;
  freshness_status: 'current' | 'stale' | 'critical' | 'never_synced';
  sync_enabled: boolean;
  database_version: string;
}

/**
 * Database adapter interface
 */
export interface DatabaseAdapter {
  /**
   * Verify a single LEI and return its record
   */
  verifyLEI(lei: string): LEIRecord | null;

  /**
   * Search entities by name (full-text search)
   */
  searchEntity(name: string, limit?: number): SearchResult;

  /**
   * Get database health and freshness status
   */
  getHealth(): HealthStatus;

  /**
   * Get recent sync history
   */
  getSyncHistory(limit?: number): SyncLogEntry[];

  /**
   * Close database connection
   */
  close(): void;

  /**
   * Database type identifier
   */
  readonly type: 'sqlite';
}
