# GLEIF MCP Production Audit Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the GLEIF MCP server to A+ audit standard per `mcp-production-audit.md`

**Architecture:** Fix all gaps identified against the 6-phase audit standard. The worktree `claude/youthful-turing` contains a `sources.yml` and an improved `CLAUDE.md` that should be adopted. All other artifacts (golden tests, security workflows, tool hardening) must be created/fixed from scratch.

**Tech Stack:** TypeScript, SQLite/FTS5, MCP SDK, GitHub Actions

---

### Task 1: Create feature branch from main

**Files:**
- None (git operation)

**Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/production-audit-fixes main
```

**Step 2: Verify on correct branch**

```bash
git branch --show-current
# Expected: feat/production-audit-fixes
```

---

### Task 2: Adopt worktree CLAUDE.md and sources.yml

The worktree has a comprehensive `CLAUDE.md` and `sources.yml` that were prepared but never merged. Adopt them, merging the git workflow rules from main's CLAUDE.md.

**Files:**
- Modify: `CLAUDE.md`
- Create: `sources.yml`

**Step 1: Write the merged CLAUDE.md**

Combine the worktree's comprehensive CLAUDE.md (project overview, architecture, conventions, build commands, env vars, security) with main's git workflow rules. The worktree version references `fixtures/golden-tests.json` and `fixtures/golden-hashes.json` — keep those references since we'll create them in Task 5.

**Step 2: Copy sources.yml from worktree**

Copy `/Users/jeffreyvonrotz/Projects/GLEIF-mcp/.claude/worktrees/youthful-turing/sources.yml` to repo root.

**Step 3: Commit**

```bash
git add CLAUDE.md sources.yml
git commit -m "docs: adopt comprehensive CLAUDE.md and add sources.yml provenance"
```

---

### Task 3: Harden tool descriptions and input schemas (Phase 1.2)

Tool descriptions must be detailed enough for an LLM agent to decide WHEN and WHY to use each tool. Input schemas need constraints (`pattern`, `minLength`, `maxLength`, `minimum`, `maximum`).

**Files:**
- Modify: `src/tools/registry.ts`

**Step 1: Enhance `verify_lei` tool definition**

Update description to include: purpose, when to use, when NOT to use, output semantics, edge cases. Add `pattern: "^[A-Z0-9]{20}$"`, `minLength: 20`, `maxLength: 20` to the `lei` property.

Current description:
```
'Verify a Legal Entity Identifier (LEI) and return full entity details including legal name, addresses, registration status, and managing LOU. Returns NOT_FOUND if LEI does not exist in the local database.'
```

Target description (example):
```
'Verify a Legal Entity Identifier (LEI) against the local GLEIF Golden Copy database (3.2M+ entities, ISO 17442). Returns full entity details: legal name, legal and headquarters addresses, registration status (ISSUED/LAPSED/RETIRED/ANNULLED), jurisdiction, managing LOU, and registration dates.\n\nUse this tool when you have a specific 20-character LEI code and need to confirm it is valid and retrieve entity information. Do NOT use this tool to search by company name — use search_entity instead.\n\nReturns { found: true, lei, entity } on match, or { found: false, message } if the LEI is invalid or not in the database. Data is sourced from the GLEIF Golden Copy (updated daily, CC0 licensed).'
```

**Step 2: Enhance `search_entity` tool definition**

Add constraints to `entity_name`: `minLength: 1`. Add `minimum: 1, maximum: 100` to `limit`. Expand description with output semantics and guidance.

**Step 3: Enhance `get_health` tool definition**

Expand description to explain all returned fields and when an agent should use it.

**Step 4: Build and verify**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/tools/registry.ts
git commit -m "feat: harden tool descriptions and input schemas for LLM agent usability"
```

---

### Task 4: Fix HTTP health endpoint and session isolation (Phase 1.4, 3.3)

The HTTP `/health` endpoint currently returns only `{ status: "ok", server: "gleif-mcp" }` — it should return meaningful health data. Also, the HTTP server reuses a single MCP Server instance across sessions, which could leak state.

**Files:**
- Modify: `src/http-server.ts`

**Step 1: Enrich the /health endpoint**

Instead of a static response, call `db.getHealth()` and return a structured response with status (ok/stale/degraded), entity count, freshness, and database version. Pattern:

```typescript
if (url.pathname === '/health') {
  try {
    const health = getDatabase().getHealth();
    const status = health.freshness_status === 'critical' ? 'degraded'
      : health.freshness_status === 'stale' ? 'stale'
      : 'ok';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status,
      server: 'gleif-mcp',
      version: '1.0.0',
      database: {
        entity_count: health.entity_count,
        production_ready: health.production_ready,
        freshness_status: health.freshness_status,
        data_age_hours: health.data_age_hours,
        last_sync: health.last_sync,
      },
      timestamp: new Date().toISOString(),
    }));
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', server: 'gleif-mcp', error: 'Database unavailable' }));
  }
  return;
}
```

**Step 2: Fix session isolation**

Each HTTP session should get its own `Server` instance. Move `createMcpServer()` call into the per-session creation block instead of sharing one instance. This prevents cross-session data leaks as specified in the worktree's CLAUDE.md conventions.

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/http-server.ts
git commit -m "fix: enrich health endpoint and isolate HTTP sessions"
```

---

### Task 5: Create golden contract tests and drift detection (Phase 2.7)

The audit requires minimum 10 golden contract tests in `fixtures/golden-tests.json` and drift detection hashes in `fixtures/golden-hashes.json`. Also create a test runner.

**Files:**
- Create: `fixtures/golden-tests.json`
- Create: `fixtures/golden-hashes.json`
- Create: `test-golden.mjs`
- Modify: `package.json` (add test:golden script)

**Step 1: Create golden-tests.json**

This file contains known-good LEI records to validate against. Select 10+ real LEI records from the production database and snapshot their expected values. Include:
- 5 well-known financial institutions (e.g., Goldman Sachs, Deutsche Bank, JP Morgan, HSBC, BNP Paribas)
- 2 search tests (known phrases that should return specific results)
- 2 negative tests (invalid LEIs, non-existent entities)
- 1 edge case (entity with special characters in name)

Query the database to get real values:
```bash
node -e "
import Database from '@ansvar/mcp-sqlite';
const db = new Database('./data/gleif.db', { readonly: true });
// Get well-known entities
const entities = [
  '7H6GLXDRUGQFU57RNE97', // Deutsche Bank
  '549300DTUYXVMJXZNY75', // Goldman Sachs
  'IGJSJL3JD5P30I6NJZ34', // JP Morgan
  'MP6I5ZYZBEU3UXPYFY54', // HSBC
  'R0MUWSFPU8MPRO8K5P83', // BNP Paribas
];
entities.forEach(lei => {
  const row = db.prepare('SELECT lei, legal_name, registration_status, legal_address_country FROM entities WHERE lei = ?').get(lei);
  console.log(JSON.stringify(row));
});
db.close();
"
```

Use the actual values from the database to populate the fixture.

Format:
```json
{
  "version": "1.0.0",
  "generated_at": "2026-02-18T00:00:00Z",
  "tests": [
    {
      "id": "verify-deutsche-bank",
      "tool": "verify_lei",
      "input": { "lei": "7H6GLXDRUGQFU57RNE97" },
      "expected": {
        "found": true,
        "entity.legal_name": "Deutsche Bank Aktiengesellschaft",
        "entity.legal_address_country": "DE",
        "entity.registration_status": "ISSUED"
      }
    },
    ...
  ]
}
```

**Step 2: Create golden-hashes.json**

Hash critical data points for drift detection:
```json
{
  "version": "1.0.0",
  "generated_at": "2026-02-18T00:00:00Z",
  "hashes": {
    "entity_count_range": { "min": 3000000, "max": 4000000 },
    "schema_version": "1.0.0",
    "fts_table_exists": true,
    "known_lei_present": ["7H6GLXDRUGQFU57RNE97", "549300DTUYXVMJXZNY75"]
  }
}
```

**Step 3: Create test-golden.mjs test runner**

A Node.js script that:
1. Loads `fixtures/golden-tests.json`
2. Opens the database
3. Runs each test and compares against expected values
4. Reports PASS/FAIL with details
5. Loads `fixtures/golden-hashes.json` and validates drift checks

**Step 4: Add script to package.json**

Add `"test:golden": "node test-golden.mjs"` to scripts.

**Step 5: Run the golden tests**

```bash
npm run test:golden
```

**Step 6: Commit**

```bash
git add fixtures/ test-golden.mjs package.json
git commit -m "feat: add golden contract tests and drift detection fixtures"
```

---

### Task 6: Add FTS5 input sanitization hardening (Phase 3.4)

The existing `buildFtsPrefixQuery` strips non-alphanumeric characters but doesn't filter FTS5 keywords (AND, OR, NOT, NEAR). These can cause unexpected query behavior.

**Files:**
- Modify: `src/database/sqlite-adapter.ts`

**Step 1: Add FTS5 keyword filtering to buildFtsPrefixQuery**

Filter out FTS5 reserved keywords from user input tokens:

```typescript
const FTS5_KEYWORDS = new Set(['AND', 'OR', 'NOT', 'NEAR']);

function buildFtsPrefixQuery(input: string): string {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(token => token.length > 0)
    .filter(token => !FTS5_KEYWORDS.has(token.toUpperCase()));

  if (tokens.length === 0) {
    return `"${input.replace(/"/g, '""')}"`;
  }

  return tokens.map(token => `"${token}"*`).join(' ');
}
```

Key changes:
- Filter FTS5 keywords (AND, OR, NOT, NEAR)
- Quote individual tokens to prevent FTS5 syntax injection
- Quote the fallback string properly

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/database/sqlite-adapter.ts
git commit -m "fix: harden FTS5 query builder against keyword injection"
```

---

### Task 7: Fix test.yml workflow (stale better-sqlite3 reference)

The test workflow still tries to rebuild `better-sqlite3` but the project now uses `@ansvar/mcp-sqlite`.

**Files:**
- Modify: `.github/workflows/test.yml`

**Step 1: Remove the stale rebuild step**

Remove lines 28-31:
```yaml
      - name: Rebuild native dependencies
        run: |
          cd node_modules/better-sqlite3
          npm run install
```

Replace with a simpler step or remove entirely since `@ansvar/mcp-sqlite` doesn't need native rebuilding.

**Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "fix: remove stale better-sqlite3 rebuild from test workflow"
```

---

### Task 8: Add Socket Security and OSSF Scorecard workflows (Phase 4.6)

The audit requires 6 security scanning layers. We have 4 (CodeQL, Semgrep, Trivy, Gitleaks). Need Socket Security and OSSF Scorecard.

**Files:**
- Create: `.github/workflows/socket-security.yml`
- Create: `.github/workflows/scorecard.yml`

**Step 1: Create Socket Security workflow**

```yaml
name: Socket Security

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  socket:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SocketDev/socket-security-action@v1
        with:
          enable_sarif: true
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: socket-results.sarif
          category: socket-security
```

**Step 2: Create OSSF Scorecard workflow**

```yaml
name: OSSF Scorecard

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

permissions:
  contents: read
  security-events: write
  id-token: write

jobs:
  scorecard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: ossf/scorecard-action@v2
        with:
          results_file: scorecard-results.sarif
          results_format: sarif
          publish_results: true
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: scorecard-results.sarif
          category: ossf-scorecard
```

**Step 3: Commit**

```bash
git add .github/workflows/socket-security.yml .github/workflows/scorecard.yml
git commit -m "feat: add Socket Security and OSSF Scorecard workflows (6/6 security layers)"
```

---

### Task 9: Create CHANGELOG.md (Phase 4.1)

**Files:**
- Create: `CHANGELOG.md`

**Step 1: Create CHANGELOG.md**

Document the version history based on git log. Include:
- v1.0.0 release features
- This audit fix release as upcoming

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md for version tracking"
```

---

### Task 10: Add MCP error codes to tool error handling (Phase 1.1)

Currently errors return plain text. Should use proper MCP error codes via `McpError` with `ErrorCode.*`.

**Files:**
- Modify: `src/tools/registry.ts`
- Modify: `src/tools/verify-lei.ts`
- Modify: `src/tools/search-entity.ts`

**Step 1: Import McpError and ErrorCode**

In `registry.ts`, import from the MCP SDK:
```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
```

**Step 2: Update error handling in CallToolRequest handler**

Replace the generic catch with proper MCP error types:
- Unknown tool → throw `McpError(ErrorCode.MethodNotFound, ...)`
- Invalid params → throw `McpError(ErrorCode.InvalidParams, ...)`
- Internal errors → throw `McpError(ErrorCode.InternalError, ...)`

**Step 3: Add input validation in verify-lei.ts**

When LEI format is invalid, return a structured error with actionable message.

**Step 4: Add input validation in search-entity.ts**

When entity_name is empty, return a structured error with actionable message.

**Step 5: Build and verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/tools/registry.ts src/tools/verify-lei.ts src/tools/search-entity.ts
git commit -m "feat: use MCP error codes for structured error responses"
```

---

### Task 11: Run full test suite and verify everything builds

**Files:**
- None (verification only)

**Step 1: Build**

```bash
npm run build
```
Expected: Clean compilation, no errors.

**Step 2: Run production tests**

```bash
npm test
```
Expected: All tests pass.

**Step 3: Run golden tests**

```bash
npm run test:golden
```
Expected: All golden tests pass.

**Step 4: Run npm audit**

```bash
npm audit
```
Expected: No critical/high vulnerabilities.

---

### Task 12: Final commit and PR preparation

**Files:**
- None (git operations)

**Step 1: Verify all changes**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

**Step 2: Push and create PR**

```bash
git push -u origin feat/production-audit-fixes
```

Create PR with title: "feat: production audit fixes — A+ standard compliance"

---

## Summary of All Changes

| Audit Phase | Issue | Fix | Files |
|-------------|-------|-----|-------|
| 1.2 | Tool descriptions too thin | Enhanced descriptions + schema constraints | `src/tools/registry.ts` |
| 1.1 | No MCP error codes | McpError with ErrorCode.* | `src/tools/registry.ts`, verify-lei, search-entity |
| 1.4 | HTTP /health too basic | Rich health response with DB status | `src/http-server.ts` |
| 1.4 | Session isolation | Per-session Server instances | `src/http-server.ts` |
| 2.1 | No sources.yml | Adopted from worktree | `sources.yml` |
| 2.7 | No golden tests | 10+ contract tests | `fixtures/golden-tests.json` |
| 2.7 | No drift detection | Hash-based detection | `fixtures/golden-hashes.json` |
| 3.4 | FTS5 keyword injection | Filter AND/OR/NOT/NEAR, quote tokens | `src/database/sqlite-adapter.ts` |
| 4.1 | No CHANGELOG | Created | `CHANGELOG.md` |
| 4.1 | CLAUDE.md incomplete | Merged worktree + main versions | `CLAUDE.md` |
| 4.2 | test.yml broken reference | Removed better-sqlite3 rebuild | `.github/workflows/test.yml` |
| 4.6 | Missing 2/6 security layers | Socket Security + OSSF Scorecard | `.github/workflows/` |
