# GLEIF MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io)

**Offline-first MCP server for Legal Entity Identifier (LEI) verification.**

Self-contained SQLite database with 2.1M+ LEI records from GLEIF. Zero runtime external dependencies. Built for banking compliance.

## Features

✅ **2.1M+ LEI records** stored locally in SQLite
✅ **Daily auto-sync** from GLEIF Golden Copy API
✅ **Works offline** with last-synced data
✅ **Full-text search** via FTS5 indexes
✅ **HTTP/SSE transport** for Docker deployment
✅ **Audit trail** for data freshness tracking

## Architecture

```
┌─────────────────────────────────────────────┐
│         GLEIF MCP Container                 │
│                                             │
│  HTTP Server ──▶ SQLite Database            │
│  (Port 3000)     (2.1M LEI records)        │
│                         ▲                   │
│  MCP Tools          Sync Scheduler          │
│  - verify_lei       (Daily at 3 AM)        │
│  - search_entity                           │
│  - get_health                              │
│                         │                   │
└─────────────────────────┼───────────────────┘
                          │ (When online)
                          ▼
              GLEIF Golden Copy API
           (Bulk data + Delta files)
```

## Quick Start

### 1. Build Database

Download and process 2.1M LEI records from GLEIF (takes ~10-15 minutes):

```bash
npm install
npm run build:db
```

This creates `data/gleif.db` (~800MB).

### 2. Start Server

**Local (stdio):**
```bash
npm run dev
```

**HTTP Server:**
```bash
npm run dev:http
# Server runs on http://localhost:3000
```

**Docker:**
```bash
docker-compose up -d
# Available at http://localhost:8303
```

### 3. Test

```bash
# Health check
curl http://localhost:3000/health

# Example MCP request (via Claude Desktop or MCP client)
```

## MCP Tools

### `verify_lei`

Verify a Legal Entity Identifier and return full entity details.

```json
{
  "lei": "549300XQFX8FNB77HY47"
}
```

**Response:**
```json
{
  "found": true,
  "lei": "549300XQFX8FNB77HY47",
  "entity": {
    "lei": "549300XQFX8FNB77HY47",
    "legal_name": "Apple Inc.",
    "registration_status": "ISSUED",
    "legal_address_country": "US",
    "legal_address_city": "Cupertino",
    ...
  }
}
```

### `search_entity`

Search for entities by name (full-text search).

```json
{
  "entity_name": "Deutsche Bank",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "lei": "...",
      "legal_name": "Deutsche Bank AG",
      ...
    }
  ],
  "total": 3
}
```

### `get_health`

Get server and database health status.

```json
{}
```

**Response:**
```json
{
  "server": "gleif-mcp",
  "version": "1.0.0",
  "database": {
    "entity_count": 2100000,
    "last_sync": "2024-01-30T03:00:00Z",
    "data_age_hours": 12.5,
    "freshness_status": "current",
    "sync_enabled": true,
    "database_version": "1.0.0"
  },
  "timestamp": "2024-01-30T15:30:00Z"
}
```

## Sync

The database automatically syncs daily at 3 AM UTC (in Docker).

**Manual sync:**
```bash
npm run sync
```

**Disable auto-sync:**
```sql
UPDATE metadata SET value = 'false' WHERE key = 'sync_enabled';
```

## Database Schema

- **entities**: 2.1M LEI records with full details
- **entities_fts**: FTS5 full-text search index
- **sync_log**: Audit trail of all sync operations
- **metadata**: System state (sync_enabled, last_sync, etc.)

## Configuration

### Environment Variables

- `PORT` - HTTP server port (default: 3000)
- `GLEIF_DB_PATH` - Database file path (default: ./data/gleif.db)
- `NODE_ENV` - Environment (production/development)

### Docker Volumes

- `gleif-data`: Persists database across restarts
- `gleif-logs`: Sync operation logs

## Banking Compliance

**Why Offline-First?**

Banks require self-contained systems. External API dependencies raise security/compliance questions during vendor assessments. This MCP server:

- ✅ No runtime external API calls
- ✅ Data freshness monitoring
- ✅ Full audit trail in sync_log
- ✅ Works offline with last-synced data

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Clean build artifacts
npm run clean
```

## Integration with Ansvar Platform

Add to `Ansvar_platform/.mcp.config.local`:

```json
{
  "name": "gleif",
  "repo": "https://github.com/Ansvar-Systems/GLEIF-MCP.git",
  "port": 8303,
  "sources": ["GLEIF", "LEI"],
  "fail_fast": true,
  "base_url": "http://ansvar-gleif-mcp:3000",
  "comment": "TIER 1: Offline-first with SQLite, daily GLEIF sync"
}
```

## Data Source

- **GLEIF Golden Copy API**: https://goldencopy.gleif.org/api/v2/docs
- **Update Frequency**: Daily delta files
- **Data Volume**: ~2.1M active LEI records
- **Database Size**: ~800MB compressed

## License

Apache-2.0 - see [LICENSE](LICENSE) file.

## Support

- Issues: https://github.com/Ansvar-Systems/GLEIF-MCP/issues
- GLEIF Documentation: https://www.gleif.org/en/lei-data/gleif-concatenated-file/

---

**Built by [Ansvar Systems](https://ansvar.eu)** for banking compliance workflows.
