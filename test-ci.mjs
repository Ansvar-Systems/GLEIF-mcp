#!/usr/bin/env node

/**
 * CI-safe tests — no database required.
 * Tests pure logic: input validation, FTS5 query builder, tool handlers with mock adapter.
 */

import { verifyLEI } from './dist/tools/verify-lei.js';
import { searchEntity } from './dist/tools/search-entity.js';
import { getHealth } from './dist/tools/health.js';
import { buildFtsPrefixQuery } from './dist/database/sqlite-adapter.js';
import { TOOLS } from './dist/tools/registry.js';

let passed = 0;
let failed = 0;

function assert(condition, testId, message) {
  if (condition) {
    console.log(`PASS [${testId}]: ${message}`);
    passed++;
  } else {
    console.log(`FAIL [${testId}]: ${message}`);
    failed++;
  }
}

function assertEq(actual, expected, testId, message) {
  assert(actual === expected, testId, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertIncludes(str, substr, testId, message) {
  assert(typeof str === 'string' && str.includes(substr), testId, message);
}

// ── Mock adapter ─────────────────────────────────────────────

const MOCK_RECORD = {
  lei: '7H6GLXDRUGQFU57RNE97',
  legal_name: 'JPMorgan Chase Bank, National Association',
  legal_name_lower: 'jpmorgan chase bank, national association',
  registration_status: 'ISSUED',
  jurisdiction: 'US-OH',
  category: null,
  legal_address_line1: '1111 POLARIS PARKWAY',
  legal_address_line2: null,
  legal_address_city: 'COLUMBUS',
  legal_address_region: 'US-OH',
  legal_address_country: 'US',
  legal_address_postal_code: '43240',
  hq_address_line1: '383 MADISON AVENUE',
  hq_address_line2: null,
  hq_address_city: 'NEW YORK',
  hq_address_region: 'US-NY',
  hq_address_country: 'US',
  hq_address_postal_code: '10179',
  initial_registration_date: '2012-06-06',
  last_update_date: '2024-12-04',
  next_renewal_date: '2025-12-01',
  managing_lou: 'EVK05KS7XY1DEII3R011',
  entity_status: null,
  entity_category: null,
};

function createMockAdapter(records = { [MOCK_RECORD.lei]: MOCK_RECORD }) {
  return {
    type: 'sqlite',
    verifyLEI(lei) {
      return records[lei.toUpperCase().trim()] || null;
    },
    searchEntity(name, limit = 10) {
      const q = name.toLowerCase();
      const results = Object.values(records).filter(r =>
        r.legal_name_lower.includes(q)
      ).slice(0, limit);
      return { results, total: results.length };
    },
    getHealth() {
      return {
        entity_count: Object.keys(records).length,
        expected_entity_count: null,
        coverage_ratio: null,
        production_ready: false,
        data_quality_status: 'unknown',
        last_sync: null,
        data_age_hours: null,
        freshness_status: 'never_synced',
        sync_enabled: false,
        database_version: '1.0.0',
      };
    },
    getSyncHistory() { return []; },
    close() {},
  };
}

// ── 1. LEI Validation (verify_lei) ───────────────────────────

console.log('LEI Input Validation');
console.log('='.repeat(70));

const mockDb = createMockAdapter();

// Valid LEI
{
  const r = await verifyLEI(mockDb, { lei: '7H6GLXDRUGQFU57RNE97' });
  assert(r.found === true, 'lei-valid', 'Valid LEI returns found');
  assertEq(r.entity.legal_name, MOCK_RECORD.legal_name, 'lei-valid-name', 'Returns correct entity name');
}

// Invalid: too short
{
  const r = await verifyLEI(mockDb, { lei: 'ABC123' });
  assert(r.found === false, 'lei-short', 'Too-short LEI rejected');
  assertIncludes(r.message, 'Invalid LEI format', 'lei-short-msg', 'Returns format error message');
}

// Invalid: too long
{
  const r = await verifyLEI(mockDb, { lei: 'A'.repeat(21) });
  assert(r.found === false, 'lei-long', 'Too-long LEI rejected');
}

// Invalid: empty
{
  const r = await verifyLEI(mockDb, { lei: '' });
  assert(r.found === false, 'lei-empty', 'Empty LEI rejected');
}

// Invalid: special characters
{
  const r = await verifyLEI(mockDb, { lei: '12345678901234567!@#' });
  assert(r.found === false, 'lei-special-chars', 'LEI with special chars rejected');
}

// Invalid: spaces
{
  const r = await verifyLEI(mockDb, { lei: '7H6G LXDRUGQFU57RNE9' });
  assert(r.found === false, 'lei-spaces', 'LEI with spaces rejected');
}

// Valid format but not in DB
{
  const r = await verifyLEI(mockDb, { lei: 'ZZZZZZZZZZZZZZZZZZZZ' });
  assert(r.found === false, 'lei-notfound', 'Non-existent LEI returns not found');
  assertIncludes(r.message, 'not found', 'lei-notfound-msg', 'Returns not-found message');
}

// Case insensitivity
{
  const r = await verifyLEI(mockDb, { lei: '7h6glxdrugqfu57rne97' });
  assert(r.found === true, 'lei-case', 'LEI lookup is case-insensitive');
}

// SQL injection attempt in LEI
{
  const r = await verifyLEI(mockDb, { lei: "'; DROP TABLE ent--" });
  assert(r.found === false, 'lei-sqli', 'SQL injection in LEI rejected by format validation');
}

console.log('');

// ── 2. Search Input Validation (search_entity) ──────────────

console.log('Search Input Validation');
console.log('='.repeat(70));

// Empty name
{
  const r = await searchEntity(mockDb, { entity_name: '' });
  assertEq(r.total, 0, 'search-empty', 'Empty search returns 0 results');
}

// Whitespace-only name
{
  const r = await searchEntity(mockDb, { entity_name: '   ' });
  assertEq(r.total, 0, 'search-whitespace', 'Whitespace-only search returns 0 results');
}

// Valid search
{
  const r = await searchEntity(mockDb, { entity_name: 'jpmorgan' });
  assert(r.total > 0, 'search-valid', 'Valid search returns results');
}

// Limit clamping: negative
{
  const r = await searchEntity(mockDb, { entity_name: 'jpmorgan', limit: -5 });
  assert(r.total >= 0, 'search-neg-limit', 'Negative limit handled gracefully');
}

// Limit clamping: zero
{
  const r = await searchEntity(mockDb, { entity_name: 'jpmorgan', limit: 0 });
  assert(r.total >= 0, 'search-zero-limit', 'Zero limit handled gracefully');
}

// Limit clamping: above max
{
  const r = await searchEntity(mockDb, { entity_name: 'jpmorgan', limit: 999 });
  assert(r.total >= 0, 'search-huge-limit', 'Oversized limit handled gracefully');
}

// Very long input
{
  const longName = 'A'.repeat(10000);
  const r = await searchEntity(mockDb, { entity_name: longName });
  assert(r.total === 0, 'search-long-input', 'Very long input handled gracefully');
}

// Unicode input
{
  const r = await searchEntity(mockDb, { entity_name: 'Deutsche Borse Aktiengesellschaft' });
  assertEq(r.total, 0, 'search-unicode', 'Unicode input handled (no crash)');
}

// Special chars in search
{
  const r = await searchEntity(mockDb, { entity_name: '<script>alert(1)</script>' });
  assert(r.total === 0, 'search-xss', 'XSS payload in search handled gracefully');
}

console.log('');

// ── 3. FTS5 Query Builder ────────────────────────────────────

console.log('FTS5 Query Builder');
console.log('='.repeat(70));

// Normal input
{
  const q = buildFtsPrefixQuery('Deutsche Bank');
  assertEq(q, '"Deutsche"* "Bank"*', 'fts-normal', 'Normal two-word query');
}

// Single word
{
  const q = buildFtsPrefixQuery('Apple');
  assertEq(q, '"Apple"*', 'fts-single', 'Single word query');
}

// Strips special chars
{
  const q = buildFtsPrefixQuery('O\'Brien & Co.');
  assertIncludes(q, '"OBrien"*', 'fts-special', 'Special chars stripped from tokens');
}

// FTS5 keyword injection: AND
{
  const q = buildFtsPrefixQuery('AND OR NOT NEAR');
  // All tokens are keywords and should be filtered out; fallback to quoted input
  assert(!q.includes('"AND"*'), 'fts-keyword-and', 'AND keyword filtered out');
  assert(!q.includes('"OR"*'), 'fts-keyword-or', 'OR keyword filtered out');
  assert(!q.includes('"NOT"*'), 'fts-keyword-not', 'NOT keyword filtered out');
  assert(!q.includes('"NEAR"*'), 'fts-keyword-near', 'NEAR keyword filtered out');
}

// Mixed keywords and valid tokens
{
  const q = buildFtsPrefixQuery('Bank AND Trust');
  assertEq(q, '"Bank"* "Trust"*', 'fts-mixed-kw', 'Keywords removed, valid tokens kept');
}

// Empty input
{
  const q = buildFtsPrefixQuery('');
  assert(typeof q === 'string', 'fts-empty', 'Empty input returns string');
}

// Whitespace-only
{
  const q = buildFtsPrefixQuery('   ');
  assert(typeof q === 'string', 'fts-whitespace', 'Whitespace input returns string');
}

// SQL injection in FTS
{
  const q = buildFtsPrefixQuery('" OR 1=1 --');
  assert(!q.includes('OR 1=1'), 'fts-sqli', 'SQL injection in FTS query neutralized');
}

// Double quotes (FTS operator)
{
  const q = buildFtsPrefixQuery('"hello" "world"');
  assert(typeof q === 'string', 'fts-quotes', 'Quoted input handled');
}

console.log('');

// ── 4. Health Tool ───────────────────────────────────────────

console.log('Health Tool');
console.log('='.repeat(70));

{
  const r = await getHealth(mockDb);
  assert(r.server === 'gleif-mcp', 'health-server', 'Health returns server name');
  assert(typeof r.version === 'string', 'health-version', 'Health returns version');
  assert(typeof r.database === 'object', 'health-db', 'Health returns database object');
  assert(typeof r.database.entity_count === 'number', 'health-count', 'Health returns entity count');
  assert(typeof r.database.freshness_status === 'string', 'health-freshness', 'Health returns freshness status');
}

console.log('');

// ── 5. Tool Registry ────────────────────────────────────────

console.log('Tool Registry');
console.log('='.repeat(70));

{
  assert(TOOLS.length === 3, 'registry-count', 'Registry has 3 tools');
  const names = TOOLS.map(t => t.name);
  assert(names.includes('verify_lei'), 'registry-verify', 'verify_lei registered');
  assert(names.includes('search_entity'), 'registry-search', 'search_entity registered');
  assert(names.includes('get_health'), 'registry-health', 'get_health registered');
}

// All tools have descriptions
{
  for (const tool of TOOLS) {
    assert(tool.description.length > 50, `registry-desc-${tool.name}`, `${tool.name} has substantive description`);
    assert(typeof tool.inputSchema === 'object', `registry-schema-${tool.name}`, `${tool.name} has input schema`);
    assert(typeof tool.handler === 'function', `registry-handler-${tool.name}`, `${tool.name} has handler`);
  }
}

// verify_lei schema has pattern constraint
{
  const verifyTool = TOOLS.find(t => t.name === 'verify_lei');
  assertEq(verifyTool.inputSchema.properties.lei.pattern, '^[A-Za-z0-9]{20}$', 'registry-lei-pattern', 'LEI schema has pattern constraint');
  assertEq(verifyTool.inputSchema.properties.lei.minLength, 20, 'registry-lei-minlen', 'LEI schema has minLength');
  assertEq(verifyTool.inputSchema.properties.lei.maxLength, 20, 'registry-lei-maxlen', 'LEI schema has maxLength');
}

// search_entity schema has limit constraints
{
  const searchTool = TOOLS.find(t => t.name === 'search_entity');
  assertEq(searchTool.inputSchema.properties.limit.minimum, 1, 'registry-limit-min', 'Limit has minimum constraint');
  assertEq(searchTool.inputSchema.properties.limit.maximum, 100, 'registry-limit-max', 'Limit has maximum constraint');
}

console.log('');

// ── 6. Robustness: Edge Cases ────────────────────────────────

console.log('Robustness Edge Cases');
console.log('='.repeat(70));

// Null-ish inputs
{
  const r = await verifyLEI(mockDb, { lei: null });
  assert(r.found === false, 'robust-null-lei', 'Null LEI handled gracefully');
}

{
  const r = await verifyLEI(mockDb, { lei: undefined });
  assert(r.found === false, 'robust-undef-lei', 'Undefined LEI handled gracefully');
}

{
  const r = await searchEntity(mockDb, { entity_name: null });
  assertEq(r.total, 0, 'robust-null-search', 'Null search name handled gracefully');
}

{
  const r = await searchEntity(mockDb, { entity_name: undefined });
  assertEq(r.total, 0, 'robust-undef-search', 'Undefined search name handled gracefully');
}

// Wrong types
{
  const r = await verifyLEI(mockDb, { lei: 12345 });
  assert(r.found === false, 'robust-number-lei', 'Numeric LEI handled gracefully');
}

{
  const r = await searchEntity(mockDb, { entity_name: 12345 });
  assert(r.total === 0 || r.total > 0, 'robust-number-search', 'Numeric search name handled (no crash)');
}

// Newlines, tabs, control chars
{
  const r = await verifyLEI(mockDb, { lei: '7H6GLXDRUGQFU57\nRNE' });
  assert(r.found === false, 'robust-newline-lei', 'Newline in LEI rejected');
}

{
  const r = await searchEntity(mockDb, { entity_name: 'Bank\x00Trust' });
  assert(r.total >= 0, 'robust-null-byte', 'Null byte in search handled');
}

// Extremely long search
{
  const r = await searchEntity(mockDb, { entity_name: 'X'.repeat(100000) });
  assert(r.total === 0, 'robust-100k-input', '100K char input handled without crash');
}

console.log('');

// ── Summary ──────────────────────────────────────────────────

console.log('='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
