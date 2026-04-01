# GLEIF MCP -- Coverage

**Last verified:** 2026-04-01

This document declares what data this MCP includes, what it does NOT include, and known limitations.

## What is Included

| Source | Items | Completeness | Refresh | Last Updated |
|--------|-------|-------------|---------|---------------|
| GLEIF Golden Copy (LEI-CDF v3.1) | - | full | daily | - |

## What is NOT Included

| Gap | Reason | Planned? |
|-----|--------|----------|
| LEI relationship data (Level 2) | Requires separate GLEIF Relationship API | Future |
| Historical LEI changes | Only current state stored | No |
| Non-LEI entity identifiers (DUNS, BIC) | Out of scope | No |

## Known Limitations

- Database is a snapshot of the GLEIF Golden Copy. Daily auto-sync keeps it current.
- Entity names and addresses are as reported to GLEIF by registrants -- may contain errors.
- Lapsed/retired LEIs are included but marked with their status.
- This MCP provides reference data, not professional advice. See DISCLAIMER.md.
