# Changelog

All notable changes to the GLEIF MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Enhanced tool descriptions with improved clarity and use case guidance
- Golden contract tests for comprehensive drift detection across tool capabilities
- FTS5 input sanitization hardening to prevent edge cases in full-text search
- MCP error code handling in tool error responses for better client compatibility
- Health endpoint improvements with proper session isolation
- Socket Security integration workflow for supply chain vulnerability scanning
- OSSF Scorecard workflow for open-source software security metrics
- Automated .mcpb bundle creation on release for easier distribution

### Changed
- Refactored SQLite implementation to use @ansvar/mcp-sqlite for better performance
- Improved sync execution alignment between documentation and runtime behavior
- Enhanced ingestion readiness checks and sync workflow robustness

### Fixed
- Removed stale better-sqlite3 rebuild references from test workflow
- Corrected HTTP health endpoint session isolation

## [1.0.0] - 2026-01-30

### Added
- **3,195,676 LEI Records** — Comprehensive Legal Entity Identifier database covering 235 countries
- **Three Core Tools:**
  - `verify_lei` — Validate LEI format and retrieve entity details
  - `search_entity` — Full-text search across entity names and identifiers via FTS5
  - `get_health` — Monitor database freshness and sync status
- **Offline-First SQLite Database** — 1.5GB self-contained database requiring no runtime API calls
- **SQLite FTS5 Full-Text Search** — Instant entity lookups across all names and records
- **Dual Transport Support:**
  - stdio transport for Claude Desktop integration
  - Streamable HTTP transport for Docker deployment
- **Daily Auto-Sync Capability** — Optional metadata-aware refresh from GLEIF Golden Copy API
- **Audit Trail Tracking** — sync_log table for data freshness monitoring
- **Docker Deployment Ready** — Complete containerization with cron-based daily sync
- **Comprehensive Security Scanning:**
  - CodeQL for code quality analysis
  - Semgrep for pattern-based security checks
  - Trivy for vulnerability scanning
  - Gitleaks for secret detection
- **Production-Ready Documentation** — Architecture guides, API documentation, and deployment instructions
- **Apache 2.0 License** — Open-source licensing for enterprise adoption

### Technical Highlights
- Handles 3.2M entities with sub-100ms search response times
- Supports wildcard and phrase queries in full-text search
- Automatic database rebuild detection when GLEIF publishes new data
- Clean separation of concerns between search, verification, and health monitoring
- Comprehensive test coverage with golden data verification
