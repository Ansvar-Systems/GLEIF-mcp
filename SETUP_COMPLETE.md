# GLEIF MCP Server - Setup Status

## Current State
- Status: Production-ready
- Database: 3.2M+ LEI records
- Runtime guard: enabled (fails fast on incomplete DB)
- Sync mode: metadata-aware daily check with auto-rebuild when needed

## What Is Verified
- `verify_lei` works with real records
- `search_entity` returns production-scale results
- `get_health` reports completeness fields:
  - `expected_entity_count`
  - `coverage_ratio`
  - `production_ready`
  - `data_quality_status`

## Operational Commands

Build DB:
```bash
npm run build:db
```

Sync DB:
```bash
npm run sync
```

Run validation:
```bash
npm test
```

## Important Runtime Behavior
- If DB is incomplete (for example a 10-row test DB), server startup fails by default.
- Local-only bypass:
```bash
export GLEIF_ALLOW_INCOMPLETE_DB=true
```

## Docker
- Container health endpoint: `/health`
- Daily cron sync runs via `npm run sync` inside the container.

## Notes
For full installation and deployment steps, use `INSTALL.md` and `README.md` as source of truth.
