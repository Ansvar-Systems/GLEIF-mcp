# GLEIF MCP - Installation Guide

## Quick Install for Claude Desktop

### Prerequisites
- Node.js 18+ installed
- Claude Desktop app

### Step 1: Build the Project

```bash
cd /Users/jeffreyvonrotz/Projects/GLEIF-mcp
npm install
npm run build
```

### Step 2: Choose Database Option

**Option A: Test Database (Quick - 30 seconds)**
```bash
npx tsx scripts/create-test-db.ts
```
Creates database with 10 sample entities (Apple, JPMorgan, Deutsche Bank, etc.)

**Option B: Full Production Database (10-15 minutes)**
```bash
npm run build:db
```
Downloads and processes 3.2M real LEI records from GLEIF (~443MB download)

### Step 3: Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gleif": {
      "command": "node",
      "args": [
        "/Users/jeffreyvonrotz/Projects/GLEIF-mcp/dist/index.js"
      ],
      "env": {
        "GLEIF_DB_PATH": "/Users/jeffreyvonrotz/Projects/GLEIF-mcp/data/gleif.db"
      }
    }
  }
}
```

### Step 4: Restart Claude Desktop

Quit and reopen Claude Desktop. The GLEIF MCP server will appear in the available tools.

## Testing

### Run Test Suite
```bash
node test-all-tools.mjs
```

Should show: `🎉 All tests passed! GLEIF MCP Server is 100% functional`

### Test in Claude Desktop

Try these queries:
- "Verify the LEI for Apple Inc: 549300XQFX8FNB77HY47"
- "Search for entities with 'bank' in their name"
- "Check the GLEIF database health status"

## Available Tools

### 1. verify_lei
Verify a Legal Entity Identifier and return full entity details.

**Example:**
```
Verify LEI: 549300XQFX8FNB77HY47
```

**Response includes:**
- Legal name
- Registration status
- Jurisdiction
- Legal address (full)
- Headquarters address
- Registration dates
- Managing LOU

### 2. search_entity
Search for entities by name (full-text search).

**Example:**
```
Search for companies with "Deutsche Bank" in their name
```

**Parameters:**
- `entity_name`: Name or partial name to search
- `limit`: Max results (default 10, max 100)

### 3. get_health
Get server and database health status.

**Returns:**
- Entity count
- Last sync timestamp
- Data age in hours
- Freshness status (current/stale/critical)
- Database version

## Database Info

**Test Database:**
- 10 sample entities
- Companies: Apple, JPMorgan, Deutsche Bank, Goldman Sachs, Microsoft, Tesla, HSBC, Barclays, BNP Paribas, Amazon
- Perfect for development and testing

**Production Database:**
- 3,195,676 entities (as of 2026-01-30)
- 443MB download (zipped)
- ~800MB SQLite database
- Daily sync via cron (Docker deployment)

## Docker Deployment

```bash
docker-compose up -d
```

Server available at: `http://localhost:8303`

## Troubleshooting

**Server won't start:**
- Check Node.js version: `node --version` (need 18+)
- Verify database exists: `ls -lh data/gleif.db`
- Check Claude Desktop logs

**No results in searches:**
- Verify database was created: `sqlite3 data/gleif.db "SELECT COUNT(*) FROM entities;"`
- Should show at least 10 (test DB) or 3M+ (production DB)

**Out of date warnings:**
- Run `npm run sync` to update from GLEIF delta files
- Or rebuild: `npm run build:db`

## Support

- Issues: https://github.com/Ansvar-Systems/GLEIF-MCP/issues
- GLEIF Data: https://www.gleif.org/en/lei-data/gleif-concatenated-file/
