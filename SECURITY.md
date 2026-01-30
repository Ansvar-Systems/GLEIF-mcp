# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Scanning

This project uses multiple layers of automated security scanning:

### Dependency Vulnerabilities
- **npm audit**: Runs on every CI build (audit-level=high)
- **Trivy**: Daily filesystem and dependency scanning
- **Docker scanning**: Trivy scans of production container images

### Code Analysis
- **CodeQL**: Static analysis for security vulnerabilities (weekly + on PRs)
- **Semgrep**: SAST scanning with OWASP Top 10 rules
- **Gitleaks**: Secret scanning on all commits (pre-commit + CI)

### What We Scan For
- Known CVEs in dependencies
- SQL injection vulnerabilities
- Regular expression denial of service (ReDoS)
- Path traversal attacks
- Secrets and API keys
- Container vulnerabilities
- Supply chain security

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do NOT open a public GitHub issue**
2. Email: hello@ansvar.eu
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

We will respond within 48 hours and provide a timeline for a fix.

## Security Best Practices

This project follows security best practices:

- ✅ All database queries use prepared statements (no SQL injection)
- ✅ Input validation on all user-provided data
- ✅ Read-only database access (no write operations during queries)
- ✅ No execution of user-provided code
- ✅ Automated security testing in CI/CD
- ✅ Pre-commit hooks block secrets
- ✅ SBOM generation for supply chain transparency

## Database Security

The GLEIF database (`data/gleif.db`) is:
- Downloaded from official GLEIF Golden Copy API v2
- Built from verified CSV data with checksums
- Opened in read-only mode during queries
- Source data is public (CC BY 4.0 license)
- Ingestion scripts require manual execution (no auto-download in production)

## Third-Party Dependencies

We minimize dependencies and regularly audit:
- **Core runtime**: Node.js, TypeScript, better-sqlite3
- **MCP SDK**: Official Anthropic package
- **No unnecessary dependencies**

All dependencies are tracked via `package-lock.json` and scanned for vulnerabilities.

## Offline-First Security

This MCP server is designed for **offline-first** operation for security reasons:
- No runtime API calls to external services
- All data stored locally in SQLite
- No network dependencies during LEI verification
- Audit trail via sync_log table

This approach reduces attack surface and eliminates external API risks.

---

**Last Updated**: 2026-01-30
