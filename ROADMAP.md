# GLEIF MCP - Roadmap

## Current Status: v1.0.0

### ✅ Completed Features

**Core Database (v1.0.0):**
- ✅ 3,195,676 LEI records from GLEIF Golden Copy
- ✅ Full-text search with SQLite FTS5
- ✅ 235 countries/jurisdictions
- ✅ Offline-first architecture with 1.5GB local database
- ✅ Daily sync capability from GLEIF API

**MCP Tools (v1.0.0):**
- ✅ `verify_lei`: Full entity details for any LEI
- ✅ `search_entity`: Full-text search across all entities
- ✅ `get_health`: Database freshness and status monitoring

**Infrastructure (v1.0.0):**
- ✅ Dual transport: stdio (Claude Desktop) + HTTP/SSE (Docker)
- ✅ Docker deployment with cron-based sync
- ✅ Production-ready with 3.2M entities

---

## Near-Term: Enhanced Search & Filtering (v1.1.0)

### Advanced Search Capabilities

**Country/Jurisdiction Filters:**
- Search within specific countries or regions
- Multi-country queries (e.g., "Find banks in EU member states")
- Regulatory jurisdiction grouping (EU, EFTA, G20, etc.)

**Status Filtering:**
- Filter by registration status (ISSUED, LAPSED, MERGED, etc.)
- Date range queries (registered after X, renewed before Y)
- Bulk status checks

**Enhanced Text Search:**
- Fuzzy matching for typos
- Phonetic search for company names
- Wildcard and regex support

### Example Queries This Would Enable

```
"Find all active LEIs in Germany registered after 2020"
"Search for entities with 'Deutsche' in name, status ISSUED only"
"Show all LAPSED entities that were banks"
"Find LEIs in Nordic countries (SE, NO, DK, FI)"
```

---

## Mid-Term: Relationship Data & Hierarchies (v1.2.0)

### Corporate Structure Mapping

GLEIF provides parent/child relationship data (Level 2):
- Ultimate parent entity identification
- Direct parent relationships
- Ownership percentages
- Relationship validation dates

**Potential Features:**
- `get_relationships`: Find parent/child LEIs
- `get_hierarchy`: Full corporate structure tree
- Ownership chain visualization
- Beneficial ownership transparency

### Example Queries

```
"Show me the corporate hierarchy for this LEI"
"Who is the ultimate parent of Deutsche Bank AG?"
"Find all subsidiaries of Apple Inc"
"Map ownership structure for compliance reporting"
```

### Why This Needs Validation

**Challenges:**
1. **Database size**: Relationship data adds ~500MB
2. **Complexity**: Graph queries vs. simple FTS
3. **Use case**: Not all users need corporate structures

**📊 Your Input Shapes the Roadmap**: Open a GitHub issue if this matters to your work.

---

## Long-Term: Analytics & Compliance Tools (v2.0+)

### Compliance Workflows

**MiFID II/EMIR Support:**
- Bulk LEI verification for trade reporting
- Counterparty identification reports
- LEI coverage gap analysis

**KYC/AML Integration:**
- Entity screening workflows
- Jurisdiction risk scoring
- Regulatory status monitoring

**Analytics Dashboard:**
- LEI registration trends by country
- Entity type distribution
- Data quality metrics

### Integration Ecosystem

**Export Capabilities:**
- CSV/JSON/Excel bulk export
- API endpoint for batch queries
- Scheduled reports

**Monitoring & Alerts:**
- Entity status change notifications
- New registrations in watched jurisdictions
- Data freshness alerts

---

## Data Quality Improvements (Ongoing)

### Address Normalization
- Standardize country codes (ISO 3166)
- City name deduplication
- Postal code validation

### Search Relevance
- Boost exact matches
- Better handling of special characters
- Multi-language support (entity names in local scripts)

### Performance Optimization
- Index optimization for large result sets
- Query caching for common searches
- Database compression strategies

---

## Contributing

Have ideas for the roadmap? Open a [GitHub Discussion](https://github.com/Ansvar-Systems/GLEIF-MCP/discussions) or [Issue](https://github.com/Ansvar-Systems/GLEIF-MCP/issues).

**Priority areas:**
- Corporate hierarchy data (most requested)
- Advanced filtering (high value, low complexity)
- Export capabilities (compliance team requests)

Built by [Ansvar Systems](https://ansvar.eu) - Stockholm, Sweden
