-- GLEIF MCP Database Schema
-- Stores 2.1M Legal Entity Identifier (LEI) records locally

-- Core entities table - LEI records
CREATE TABLE IF NOT EXISTS entities (
  lei TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  legal_name_lower TEXT NOT NULL,
  registration_status TEXT NOT NULL,
  jurisdiction TEXT,
  category TEXT,

  -- Legal Address
  legal_address_line1 TEXT,
  legal_address_line2 TEXT,
  legal_address_city TEXT,
  legal_address_region TEXT,
  legal_address_country TEXT,
  legal_address_postal_code TEXT,

  -- Headquarters Address
  hq_address_line1 TEXT,
  hq_address_line2 TEXT,
  hq_address_city TEXT,
  hq_address_region TEXT,
  hq_address_country TEXT,
  hq_address_postal_code TEXT,

  -- Registration Details
  initial_registration_date TEXT,
  last_update_date TEXT,
  next_renewal_date TEXT,
  managing_lou TEXT,

  -- Additional metadata
  entity_status TEXT,
  entity_category TEXT
);

-- Index for fast name lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_legal_name_lower ON entities(legal_name_lower);

-- Index for country lookups
CREATE INDEX IF NOT EXISTS idx_legal_address_country ON entities(legal_address_country);

-- Index for registration status
CREATE INDEX IF NOT EXISTS idx_registration_status ON entities(registration_status);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  lei,
  legal_name,
  content='entities',
  content_rowid='rowid'
);

-- FTS5 triggers to keep search index in sync
CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, lei, legal_name)
  VALUES (new.rowid, new.lei, new.legal_name);
END;

CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, lei, legal_name)
  VALUES('delete', old.rowid, old.lei, old.legal_name);
END;

CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, lei, legal_name)
  VALUES('delete', old.rowid, old.lei, old.legal_name);
  INSERT INTO entities_fts(rowid, lei, legal_name)
  VALUES (new.rowid, new.lei, new.legal_name);
END;

-- Sync log for audit trail
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL CHECK(sync_type IN ('full', 'delta')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  source_url TEXT
);

-- Index for recent sync lookups
CREATE INDEX IF NOT EXISTS idx_sync_log_completed ON sync_log(completed_at DESC);

-- Metadata table for system state
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initialize metadata
INSERT OR IGNORE INTO metadata (key, value) VALUES ('sync_enabled', 'true');
INSERT OR IGNORE INTO metadata (key, value) VALUES ('last_full_sync', '');
INSERT OR IGNORE INTO metadata (key, value) VALUES ('total_entities', '0');
INSERT OR IGNORE INTO metadata (key, value) VALUES ('expected_entities', '0');
INSERT OR IGNORE INTO metadata (key, value) VALUES ('source_publish_date', '');
INSERT OR IGNORE INTO metadata (key, value) VALUES ('database_version', '1.0.0');
