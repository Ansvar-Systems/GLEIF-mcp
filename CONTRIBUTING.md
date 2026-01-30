# Contributing to GLEIF MCP

Thank you for your interest in contributing to the GLEIF MCP Server! This document provides guidelines for contributions.

## How to Contribute

### Reporting Issues

- Check existing issues before creating a new one
- Use a clear, descriptive title
- Include steps to reproduce bugs
- Include relevant error messages or logs
- For LEI data issues, include the LEI code and expected vs. actual results

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with a clear message
6. Push to your fork
7. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Include tests for new functionality
- Keep commits focused and atomic
- Run `npm run build` to ensure TypeScript compiles

## Areas We're Looking For Help

### Database Optimization

- Improve FTS5 search relevance
- Optimize query performance for large result sets
- Better index strategies for multi-field searches

### Data Quality

- Identify and report data parsing issues
- Improve address normalization
- Better handling of special characters in entity names

### Additional Features

- Enhanced search filters (by country, status, registration date)
- Bulk LEI verification API
- Export functionality (CSV, JSON)
- Statistics and analytics tools

### Testing

- Add more test cases for edge cases
- Integration tests for MCP protocol
- Performance benchmarks

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/GLEIF-MCP
cd GLEIF-MCP

# Install dependencies
npm install

# Build production database (10-15 minutes, 443MB download)
npm run build:db

# Run in development
npm run dev

# Run tests
npm test

# Build TypeScript
npm run build
```

## Data Source

All LEI data comes from the **GLEIF Golden Copy API v2**:
- Source: https://goldencopy.gleif.org/api/v2/docs
- License: CC BY 4.0 (public data)
- Update frequency: Daily delta files

Do **not** include data from third-party LEI providers or proprietary databases.

## Testing Guidelines

Before submitting a PR:

1. **Run the test suite**: `npm test`
2. **Test with production data**: Verify against real LEIs
3. **Check database integrity**: Ensure schema migrations work
4. **Verify MCP protocol**: Test with Claude Desktop or MCP Inspector

## Security

- Never commit secrets or API keys
- Pre-commit hooks will scan for secrets (gitleaks)
- Report security issues to hello@ansvar.eu (not GitHub issues)

## Questions?

Open an issue or reach out at hello@ansvar.eu.

---

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
