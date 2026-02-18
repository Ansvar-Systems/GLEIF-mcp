#!/usr/bin/env node
import { readFileSync } from 'fs';
import Database from '@ansvar/mcp-sqlite';
import { createSqliteAdapter } from './dist/database/sqlite-adapter.js';
import { verifyLEI } from './dist/tools/verify-lei.js';
import { searchEntity } from './dist/tools/search-entity.js';
import { getHealth } from './dist/tools/health.js';

const goldenTests = JSON.parse(readFileSync('./fixtures/golden-tests.json', 'utf-8'));
const goldenHashes = JSON.parse(readFileSync('./fixtures/golden-hashes.json', 'utf-8'));

const db = new Database('./data/gleif.db', { readonly: true });
const adapter = createSqliteAdapter(db);

let passed = 0;
let failed = 0;

console.log('Golden Contract Tests');
console.log('='.repeat(70));

for (const test of goldenTests.tests) {
  try {
    if (test.tool === 'verify_lei') {
      const result = await verifyLEI(adapter, test.input);
      let testPassed = true;
      for (const [key, expected] of Object.entries(test.expected)) {
        const actual = key.includes('.')
          ? key.split('.').reduce((obj, k) => obj?.[k], result)
          : result[key];
        if (actual !== expected) {
          console.log(`FAIL [${test.id}]: ${key} expected "${expected}" got "${actual}"`);
          testPassed = false;
        }
      }
      if (testPassed) {
        console.log(`PASS [${test.id}]: ${test.description}`);
        passed++;
      } else {
        failed++;
      }
    } else if (test.tool === 'search_entity') {
      const result = await searchEntity(adapter, test.input);
      if (test.expected['total_gt'] !== undefined && result.total > test.expected['total_gt']) {
        console.log(`PASS [${test.id}]: ${test.description} (${result.total} results)`);
        passed++;
      } else if (test.expected['total_gt'] !== undefined && result.total <= test.expected['total_gt']) {
        console.log(`FAIL [${test.id}]: expected total > ${test.expected['total_gt']}, got ${result.total}`);
        failed++;
      }
    } else if (test.tool === 'get_health') {
      const result = await getHealth(adapter);
      if (result.database.entity_count >= test.expected['entity_count_min']) {
        console.log(`PASS [${test.id}]: ${test.description} (${result.database.entity_count} entities)`);
        passed++;
      } else {
        console.log(`FAIL [${test.id}]: expected >= ${test.expected['entity_count_min']}, got ${result.database.entity_count}`);
        failed++;
      }
    }
  } catch (err) {
    console.log(`FAIL [${test.id}]: ${err.message}`);
    failed++;
  }
}

// Drift detection
console.log('');
console.log('Drift Detection Checks');
console.log('='.repeat(70));

const checks = goldenHashes.checks;

// Entity count range
const countRow = db.prepare('SELECT COUNT(*) as c FROM entities').get();
if (countRow.c >= checks.entity_count_range.min && countRow.c <= checks.entity_count_range.max) {
  console.log(`PASS [drift-entity-count]: ${countRow.c} in range [${checks.entity_count_range.min}, ${checks.entity_count_range.max}]`);
  passed++;
} else {
  console.log(`FAIL [drift-entity-count]: ${countRow.c} outside range`);
  failed++;
}

// Required tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
for (const table of checks.required_tables) {
  if (tables.includes(table)) {
    console.log(`PASS [drift-table-${table}]: table exists`);
    passed++;
  } else {
    console.log(`FAIL [drift-table-${table}]: table missing`);
    failed++;
  }
}

// Known LEIs
for (const lei of checks.known_leis_present) {
  const row = db.prepare('SELECT lei FROM entities WHERE lei = ?').get(lei);
  if (row) {
    console.log(`PASS [drift-lei-${lei}]: present`);
    passed++;
  } else {
    console.log(`FAIL [drift-lei-${lei}]: missing`);
    failed++;
  }
}

db.close();

console.log('');
console.log('='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
