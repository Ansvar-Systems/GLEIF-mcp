# GLEIF MCP - Implementation Handover

## Summary
The server is now hardened for production TPRM usage in Ansvar Platform.

Key improvements implemented:
- Replaced placeholder sync logic with working metadata-aware sync/rebuild flow.
- Added ingestion completeness checks during DB build.
- Added startup readiness guard to block incomplete/test databases in production.
- Extended health output with completeness/readiness indicators.
- Improved search robustness with safer FTS query handling and SQL fallback.
- Aligned Docker runtime to execute daily sync correctly.

## Current Architecture

### Runtime entrypoints
- Stdio: `src/index.ts`
- HTTP: `src/http-server.ts`

Both entrypoints enforce production DB readiness unless:
- `GLEIF_ALLOW_INCOMPLETE_DB=true`

### Database
Schema: `src/database/schema.sql`

Core tables:
- `entities`
- `entities_fts`
- `sync_log`
- `metadata`

Important metadata keys:
- `total_entities`
- `expected_entities`
- `last_full_sync`
- `source_publish_date`
- `sync_enabled`

### Sync strategy
Script: `scripts/sync-gleif.ts`

Behavior:
- Reads current local DB state
- Fetches latest publish metadata when available
- Triggers full rebuild when:
  - DB missing
  - DB below production threshold
  - completeness below threshold
  - newer publish date detected

Builder: `scripts/build-db.ts`
- Streams CSV into SQLite
- Handles multiline CSV records
- Stores expected vs loaded counts
- Fails build if completeness is too low

## Health output
`get_health` now includes:
- `entity_count`
- `expected_entity_count`
- `coverage_ratio`
- `production_ready`
- `data_quality_status`
- `last_sync`
- `data_age_hours`
- `freshness_status`

## Docker
Dockerfile runs:
- HTTP server (`dist/http-server.js`)
- Daily cron sync via `npm run sync`

## Validation checklist
Run before release:

```bash
npm run build
npm test
npm run sync
```

Expected:
- build passes
- production tests pass
- sync exits cleanly
- `get_health` indicates `production_ready: true`

## Operational guidance
- Use production DB for TPRM workflows.
- Do not set `GLEIF_ALLOW_INCOMPLETE_DB=true` in production.
- If network-restricted, sync still validates local completeness even if metadata fetch fails.

## Source of truth docs
- `README.md`
- `INSTALL.md`
