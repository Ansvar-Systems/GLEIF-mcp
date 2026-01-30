# GLEIF MCP Server - Setup Complete ✅

## Status: 100% Production Ready

**Date:** 2026-01-30
**Database:** 3,195,676 LEI records
**Size:** 1.5GB
**Installation:** Complete

---

## What's Installed

### Database Statistics
- **Total entities:** 3,195,676
- **US entities:** 342,028
- **Indian entities:** 329,790
- **Italian entities:** 242,090
- **German entities:** 241,510
- **UK entities:** 221,042
- **Top 10 countries:** US, IN, IT, DE, GB, ES, NL, FR, SE, DK

### Production Tests Passed ✅
1. ✅ Verify LEI (Fidelity fund)
2. ✅ Search for "bank" (10 results found)
3. ✅ Search for "Goldman Sachs" (5 entities found)
4. ✅ Search for "Deutsche Bank" (5 entities found)
5. ✅ Health check (3.2M entities, 0.06 hours old)
6. ✅ Country distribution analysis

### Claude Desktop Configuration ✅

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Current config:**
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

---

## How to Use in Claude Desktop

### Step 1: Restart Claude Desktop
**IMPORTANT:** You must restart Claude Desktop for the MCP server to load.

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. The GLEIF MCP server will now be available

### Step 2: Test with Real Queries

Try these example queries in Claude Desktop:

**LEI Verification:**
```
Verify this LEI: 001GPB6A9XPE8XJICC14
```

**Entity Search:**
```
Search the GLEIF database for Deutsche Bank entities
```

```
Find all entities with "Goldman Sachs" in their name
```

**Health Check:**
```
Check the GLEIF database status and freshness
```

**Country Analysis:**
```
How many entities are registered in the United States?
```

---

## MCP Tools Available

### 1. `verify_lei`
Verify a 20-character Legal Entity Identifier and return full details.

**Input:**
- `lei`: The 20-character LEI code

**Returns:**
- Legal name
- Registration status
- Legal address (full)
- Headquarters address
- Registration dates
- Managing LOU

### 2. `search_entity`
Search for entities by name using full-text search (FTS5).

**Input:**
- `entity_name`: Name or partial name to search
- `limit`: Max results (default 10, max 100)

**Returns:**
- Array of matching entities
- Total count

### 3. `get_health`
Get server and database health status.

**Returns:**
- Entity count (3,195,676)
- Last sync timestamp
- Data age in hours
- Freshness status
- Database version

---

## Database Details

**File:** `/Users/jeffreyvonrotz/Projects/GLEIF-mcp/data/gleif.db`
**Size:** 1.5GB
**Type:** SQLite with FTS5 full-text search
**Last updated:** 2026-01-30 07:13:14 UTC
**Data source:** GLEIF Golden Copy API v2

**Sync log:**
- Type: Full sync
- Records added: 3,195,676
- Status: Success
- Duration: ~3 minutes

---

## Verification Commands

### Check database exists:
```bash
ls -lh /Users/jeffreyvonrotz/Projects/GLEIF-mcp/data/gleif.db
```

### Count entities:
```bash
sqlite3 /Users/jeffreyvonrotz/Projects/GLEIF-mcp/data/gleif.db \
  "SELECT COUNT(*) FROM entities;"
```

### Run test suite:
```bash
cd /Users/jeffreyvonrotz/Projects/GLEIF-mcp
node test-production.mjs
```

---

## Maintenance

### Update database (daily sync):
```bash
cd /Users/jeffreyvonrotz/Projects/GLEIF-mcp
npm run sync
```

### Rebuild from scratch:
```bash
npm run build:db
```
(Takes 10-15 minutes, downloads 443MB)

### Check server health:
```bash
curl http://localhost:3000/health
```
(If running HTTP server with `npm run dev:http`)

---

## Docker Deployment (Optional)

For production deployment:

```bash
docker-compose up -d
```

Server available at: `http://localhost:8303`

---

## Troubleshooting

### Server doesn't appear in Claude Desktop
1. Check config file exists: `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json`
2. Restart Claude Desktop completely
3. Check Claude Desktop logs

### Queries return no results
1. Verify database exists and has data:
   ```bash
   sqlite3 data/gleif.db "SELECT COUNT(*) FROM entities;"
   ```
2. Should return: `3195676`

### "Database not found" error
1. Check path in config matches actual database location
2. Verify: `/Users/jeffreyvonrotz/Projects/GLEIF-mcp/data/gleif.db` exists

---

## Success Indicators

You'll know it's working when:
- ✅ Claude Desktop shows "gleif" in available MCP servers
- ✅ Queries return real entity data
- ✅ Search results show companies like "Deutsche Bank", "Goldman Sachs"
- ✅ LEI verification returns detailed entity information
- ✅ Health checks show 3.2M entities

---

## Next Steps

1. **Restart Claude Desktop** (if not done already)
2. **Test with sample queries** (see examples above)
3. **Explore the data** - Try searching for companies you know
4. **Integrate into workflows** - Use LEI verification in your analysis

---

## Support

- **Project:** `/Users/jeffreyvonrotz/Projects/GLEIF-mcp`
- **Documentation:** `README.md`, `INSTALL.md`
- **Tests:** `test-production.mjs`
- **GLEIF Data:** https://www.gleif.org/

**Built with:**
- Node.js + TypeScript
- SQLite + FTS5
- MCP SDK 1.25.3
- GLEIF Golden Copy API v2

---

**Setup completed:** 2026-01-30
**Status:** 🟢 Production Ready
**Database version:** 1.0.0
