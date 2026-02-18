# CLAUDE.md — GLEIF MCP Server

## Project Overview

Offline-first MCP server for Legal Entity Identifier (LEI) verification. Self-contained SQLite database with 3.2M+ LEI records from the GLEIF Golden Copy, daily sync via cron.

## Architecture

- **Transport**: Dual — stdio (npm/Claude Desktop) and Streamable HTTP (Docker)
- **Database**: SQLite with FTS5 full-text search, read-only at runtime
- **Data source**: GLEIF Golden Copy (CC0 license), refreshed daily at 03:00 UTC
- **Language**: TypeScript (strict mode), ESM modules, Node 18+

## Git Workflow

- **Never commit directly to `main`.** Always create a feature branch and open a Pull Request.
- Branch protection requires: verified signatures, PR review, and status checks to pass.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.

## Key Conventions

### Code Style
- Strict TypeScript with `noEmit` checks
- ESM imports with `.js` extensions (TypeScript module resolution: bundler)
- All database queries use parameterized statements — never string interpolation
- FTS5 queries are sanitized via `buildFtsPrefixQuery()` — tokens are quoted and keywords filtered

### Tool Definitions
- All tools defined in `src/tools/registry.ts` (single source of truth)
- Tool descriptions must be LLM-optimized: include when to use, when NOT to use, output semantics, and edge cases
- Input schemas must include `pattern`, `minLength`, `maxLength`, `minimum`, `maximum` where applicable
- Error responses use MCP error codes (`McpError` with `ErrorCode.*`)

### HTTP Transport
- Each HTTP session gets its own `Server` instance to prevent cross-session data leaks
- Sessions tracked by `mcp-session-id` header
- Health endpoint at `/health` returns simple JSON (not MCP protocol)

### Testing
- `test-production.mjs` — production database validation (requires gleif.db)
- `test-all-tools.mjs` — comprehensive tool behavior tests
- `fixtures/golden-tests.json` — contract tests for data accuracy
- `fixtures/golden-hashes.json` — drift detection against upstream GLEIF data

### Database
- Schema in `src/database/schema.sql`
- Production readiness: ≥1M entities AND ≥98% coverage ratio
- Bypass with `GLEIF_ALLOW_INCOMPLETE_DB=true` for local testing only

## Build Commands

```bash
npm run build        # TypeScript compilation
npm run build:db     # Download and build GLEIF database (10-15 min)
npm run sync         # Check for updates and rebuild if needed
npm run dev          # Start stdio server (development)
npm run dev:http     # Start HTTP server (development)
npm test             # Run production tests
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GLEIF_DB_PATH` | `./data/gleif.db` | Database file path |
| `GLEIF_MIN_ENTITY_COUNT` | `1000000` | Minimum entities for production |
| `GLEIF_ALLOW_INCOMPLETE_DB` | `false` | Allow incomplete DB (testing only) |
| `PORT` | `3000` | HTTP server port |

## Security

6-layer scanning: CodeQL, Semgrep, Trivy, Gitleaks, Socket Security, OSSF Scorecard.
All SARIF results upload to GitHub Security tab.
