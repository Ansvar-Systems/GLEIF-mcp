# GLEIF MCP Server

**Your LEI verification companion. No API limits. Works offline.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fgleif-mcp.svg)](https://www.npmjs.com/package/@ansvar/gleif-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/GLEIF-MCP?style=social)](https://github.com/Ansvar-Systems/GLEIF-MCP)
[![Database](https://img.shields.io/badge/database-3.2M%20entities-green)](docs/database.md)

Query **3.2 million Legal Entity Identifiers** directly from Claude, Cursor, or any MCP-compatible client. Self-contained SQLite database with zero runtime API dependencies.

If you're building financial services, compliance workflows, or banking applications that need LEI verification, this is your offline-first solution.

Built by [Ansvar Systems](https://ansvar.eu) — Stockholm, Sweden

---

## Why This Exists

LEI verification is fragmented across GLEIF's APIs, third-party services, and manual lookups. Whether you're:
- A **financial institution** verifying counterparty identities for MiFID II/EMIR compliance
- A **compliance officer** conducting KYC/AML due diligence
- A **developer** building banking workflows that need instant LEI lookups
- A **risk analyst** mapping corporate ownership structures

...you shouldn't need API rate limits, internet connectivity, or vendor dependencies for basic LEI data. Ask Claude. Get the entity. Instantly.

This MCP server makes GLEIF's 3.2M LEI records **searchable, offline, and AI-readable**.

---

## What's Included

- **3,195,676 LEI Records** (as of January 2026) — Apple, Goldman Sachs, Deutsche Bank, and 3.2M more
- **Full-Text Search** — Find entities across all names instantly via SQLite FTS5
- **Works Offline** — Self-contained database with last-synced data
- **Daily Auto-Sync** — Optional scheduled updates from GLEIF Golden Copy
- **Audit Trail** — Data freshness tracking via sync_log
- **Dual Transport** — stdio (Claude Desktop) and HTTP/SSE (Docker deployment)

**Database size:** ~1.5GB | **Coverage:** 235 countries | **Update frequency:** Daily delta files

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         GLEIF MCP Container                 │
│                                             │
│  HTTP Server ──▶ SQLite Database            │
│  (Port 3000)     (3.2M LEI records)        │
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

---

## Quick Start

### Installation

**Option 1: Claude Desktop (Recommended)**

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gleif": {
      "command": "npx",
      "args": ["-y", "@ansvar/gleif-mcp"]
    }
  }
}
```

Restart Claude Desktop. The database will download automatically on first use (~443MB, one-time).

**Option 2: MCP Registry**

Browse and install from the [official MCP registry](https://registry.modelcontextprotocol.io/):
- Search for "GLEIF" or "LEI"
- One-click install (when registry integration is live in Claude Desktop)
- Automatic updates when new versions are released

**Option 3: Cursor / VS Code**

```json
{
  "mcp.servers": {
    "gleif": {
      "command": "npx",
      "args": ["-y", "@ansvar/gleif-mcp"]
    }
  }
}
```

**Option 4: Global npm Install**

```bash
npm install -g @ansvar/gleif-mcp
```

Then use `"command": "gleif-mcp"` in your config (without npx).

**Option 5: Development / Self-Hosted**

For local development or Docker deployment:

```bash
# Clone and build
git clone https://github.com/Ansvar-Systems/GLEIF-MCP.git
cd GLEIF-MCP
npm install
npm run build

# Build production database (10-15 minutes, 443MB download)
npm run build:db

# Run locally
npm run dev

# Or deploy with Docker
docker-compose up -d
# Available at http://localhost:8303
```

---

## Example Queries

Once connected, just ask naturally:

- *"Verify the LEI for Apple Inc"*
- *"Search for entities with 'Goldman Sachs' in their name"*
- *"Find all Deutsche Bank entities registered in Germany"*
- *"What is the legal name for LEI 549300XQFX8FNB77HY47?"*
- *"Check if LEI 001GPB6A9XPE8XJICC14 is active"*
- *"How many entities are registered in the United States?"*
- *"When was the GLEIF database last updated?"*
- *"Search for banks in London"*

**More examples:** Try any entity name or LEI code — 3.2M records covering 235 countries.

---

## Available Tools

### 1. `verify_lei` — Verify LEI and Return Full Details

Input:
```json
{
  "lei": "549300XQFX8FNB77HY47"
}
```

Response includes:
- Legal name
- Registration status (ISSUED, LAPSED, etc.)
- Legal jurisdiction and address (full)
- Headquarters address
- Registration/renewal dates
- Managing LOU (Local Operating Unit)

### 2. `search_entity` — Full-Text Search by Name

Input:
```json
{
  "entity_name": "Deutsche Bank",
  "limit": 10
}
```

Returns array of matching entities with LEI codes. Uses SQLite FTS5 for fast searches across 3.2M records.

### 3. `get_health` — Database Status and Freshness

Returns:
- Entity count (3,195,676)
- Last sync timestamp
- Data age in hours
- Freshness status (current/stale/critical)
- Database version

**Example response:**
```json
{
  "server": "gleif-mcp",
  "version": "1.0.0",
  "database": {
    "entity_count": 3195676,
    "last_sync": "2026-01-30T00:00:00Z",
    "data_age_hours": 8.2,
    "freshness_status": "current",
    "database_version": "1.0.0"
  }
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

---

## Why Offline-First for Banking Compliance

Banks and financial institutions require self-contained systems. External API dependencies raise security/compliance questions during vendor assessments:

**Typical LEI API Problems:**
- Rate limits block batch processing
- Internet connectivity required for every lookup
- Third-party vendor dependencies in security reviews
- No data freshness guarantees
- API costs scale with usage

**This MCP Server Solves All of These:**
- ✅ **No runtime external API calls** — Query 3.2M entities locally
- ✅ **No rate limits** — Process millions of lookups instantly
- ✅ **Works offline** — Last-synced data always available
- ✅ **Data freshness monitoring** — Audit trail in sync_log
- ✅ **Zero vendor dependencies** — Self-contained SQLite database
- ✅ **Predictable costs** — No per-query fees

**Compliance Use Cases:**
- MiFID II counterparty identification
- EMIR trade reporting
- KYC/AML due diligence
- Corporate ownership mapping
- Regulatory reporting workflows

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

---

## Data Source

All LEI data is sourced verbatim from the **GLEIF Golden Copy API v2**:

- **Source:** [GLEIF Golden Copy](https://goldencopy.gleif.org/api/v2/docs) (official public data)
- **Coverage:** 3,195,676 active LEI records (as of January 2026)
- **Countries:** 235 jurisdictions worldwide
- **Update Frequency:** Daily delta files (automated via cron in Docker)
- **Database Size:** ~1.5GB SQLite (compressed download: 443MB)
- **Data Freshness:** Tracked via `metadata.last_sync` and `sync_log` audit trail

**Top 10 Countries by Entity Count:**
1. United States (342,028)
2. India (329,790)
3. Italy (242,090)
4. Germany (241,510)
5. United Kingdom (221,042)
6. Spain, Netherlands, France, Sweden, Denmark (100k-200k each)

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** - MCP servers that work together for end-to-end regulatory coverage:

### 🏦 GLEIF MCP (This Project)
**Verify 3.2M Legal Entity Identifiers directly from Claude**
- LEI verification and entity search
- Self-contained SQLite database (3,195,676 records)
- Offline-first for banking compliance
- **Install:** `npx @ansvar/gleif-mcp`

### 🇪🇺 [EU Regulations MCP](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 47 EU regulations directly from Claude**
- GDPR, AI Act, DORA, NIS2, MiFID II, PSD2, eIDAS, MDR, and 39 more
- Full regulatory text with article-level search
- Cross-regulation reference and comparison
- **Install:** `npx @ansvar/eu-regulations-mcp`

### 🇺🇸 [US Regulations MCP](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws directly from Claude**
- HIPAA, CCPA, SOX, GLBA, FERPA, COPPA, FDA 21 CFR Part 11, and more
- Federal and state privacy law comparison
- Breach notification timeline mapping
- **Install:** `npx @ansvar/us-regulations-mcp`

### 🔐 [Security Controls MCP](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 1,451 security controls across 28 frameworks**
- ISO 27001, NIST CSF, DORA, PCI DSS, SOC 2, CMMC, and more
- Bidirectional framework mapping and gap analysis
- Import your purchased standards for official text
- **Install:** `pipx install security-controls-mcp`

### How They Work Together

**LEI + Compliance Workflow:**

```
1. "Verify LEI for this counterparty: 549300XQFX8FNB77HY47"
   → GLEIF MCP returns full entity details

2. "What are MiFID II requirements for LEI reporting?"
   → EU Regulations MCP returns Article text

3. "What controls implement MiFID II Article 65?"
   → Security Controls MCP maps to ISO 27001/NIST CSF
```

**Complete compliance in one chat:**
- **GLEIF MCP** verifies entities for KYC/AML workflows
- **EU/US Regulations MCPs** tell you regulatory requirements
- **Security Controls MCP** implements technical controls

---

## About Ansvar Systems

We build AI-accelerated threat modeling and compliance tools for automotive, financial services, and healthcare. The GLEIF MCP started as our internal KYC/compliance tool — turns out everyone building financial workflows has the same LEI verification pain points.

So we're open-sourcing it. Verifying 3.2M entities shouldn't require API keys and rate limits.

**[ansvar.eu](https://ansvar.eu)** — Stockholm, Sweden

---

## Documentation

- **[Installation Guide](INSTALL.md)** — Detailed setup for all platforms
- **[Setup Complete](SETUP_COMPLETE.md)** — Production deployment checklist
- **[Database Schema](src/database/schema.sql)** — SQLite table structure
- **[Dockerfile](Dockerfile)** — Container deployment with cron

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** https://github.com/Ansvar-Systems/GLEIF-MCP/issues
- **GLEIF Documentation:** https://www.gleif.org/en/lei-data/gleif-concatenated-file/
- **MCP Protocol:** https://modelcontextprotocol.io

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
