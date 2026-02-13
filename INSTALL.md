# GLEIF MCP - Installation Guide

## Prerequisites
- Node.js 18+
- npm
- (Optional) Docker / Docker Compose

## Local Setup

```bash
cd /Users/jeffreyvonrotz/Projects/GLEIF-mcp
npm install
npm run build
```

## Database Options

### Option A: Production database (recommended)

```bash
npm run build:db
```

Builds `data/gleif.db` from GLEIF Golden Copy data.

### Option B: Test database (development only)

```bash
node --import tsx scripts/create-test-db.ts
```

Creates a 10-row sample DB. By default, the server will refuse to start with this DB unless you set:

```bash
export GLEIF_ALLOW_INCOMPLETE_DB=true
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gleif": {
      "command": "node",
      "args": ["/Users/jeffreyvonrotz/Projects/GLEIF-mcp/dist/index.js"],
      "env": {
        "GLEIF_DB_PATH": "/Users/jeffreyvonrotz/Projects/GLEIF-mcp/data/gleif.db"
      }
    }
  }
}
```

Restart Claude Desktop after changes.

## Docker Deployment

```bash
docker-compose up -d
```

Service endpoint: `http://localhost:8303`

## Sync and Maintenance

Manual sync check/rebuild:

```bash
npm run sync
```

Behavior:
- Checks latest publish metadata when reachable
- Rebuilds when a newer publish is available
- Rebuilds when local completeness/readiness checks fail

## Validation

Run production checks:

```bash
npm test
```

Expected outcomes:
- `get_health` shows `production_ready: true`
- `entity_count` is in the 3.2M range
- `freshness_status` is `current` (when recently synced)

## Troubleshooting

### Server fails with "Database is not production-ready"
This means DB is too small/incomplete for production.

Fix:
```bash
npm run build:db
```

Temporary local override only:
```bash
export GLEIF_ALLOW_INCOMPLETE_DB=true
```

### Sync metadata fetch fails in restricted networks
If internet egress is blocked, sync still validates local completeness but cannot compare to latest publish metadata.

### Verify row count quickly

```bash
sqlite3 data/gleif.db "SELECT COUNT(*) FROM entities;"
```

## Support
- Repo: https://github.com/Ansvar-Systems/GLEIF-mcp
- GLEIF data docs: https://goldencopy.gleif.org/api/v2/docs
