#!/usr/bin/env npx tsx
import Database from '@ansvar/mcp-sqlite';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'data', 'gleif.db');

console.log('Creating test database...');
const db = new Database(DB_PATH);

// Load schema
const schema = readFileSync(join(__dirname, '..', 'src', 'database', 'schema.sql'), 'utf-8');
db.exec(schema);

// Insert sample data
const samples = [
  ['549300XQFX8FNB77HY47', 'Apple Inc.', 'ISSUED', 'US', 'Cupertino', 'CA'],
  ['529900T8BM49AURSDO55', 'JPMorgan Chase & Co.', 'ISSUED', 'US', 'New York', 'NY'],
  ['MAES062Z21O4RZ2U4M44', 'Deutsche Bank AG', 'ISSUED', 'DE', 'Frankfurt', 'HE'],
  ['BFXS5XCH7N0Y05NIXW11', 'Goldman Sachs Group Inc.', 'ISSUED', 'US', 'New York', 'NY'],
  ['5493000IBP32UQZ0KL24', 'Microsoft Corporation', 'ISSUED', 'US', 'Redmond', 'WA'],
  ['549300E9PC51EN656011', 'Tesla Inc', 'ISSUED', 'US', 'Austin', 'TX'],
  ['APQRDMY3SH7LBPR0R923', 'HSBC Holdings plc', 'ISSUED', 'GB', 'London', 'ENG'],
  ['724500Y6DUVHQD6OXN27', 'Barclays PLC', 'ISSUED', 'GB', 'London', 'ENG'],
  ['RVJNYEQ01YD011K0S085', 'BNP Paribas', 'ISSUED', 'FR', 'Paris', 'IDF'],
  ['549300VBWWV6BYQOWM67', 'Amazon.com Inc.', 'ISSUED', 'US', 'Seattle', 'WA']
];

const insert = db.prepare(`
  INSERT INTO entities (lei, legal_name, legal_name_lower, registration_status, 
                        legal_address_country, legal_address_city, legal_address_region,
                        initial_registration_date, last_update_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN');
for (const [lei, name, status, country, city, region] of samples) {
  insert.run(lei, name, name.toLowerCase(), status, country, city, region,
    '2024-01-01', new Date().toISOString());
}
db.exec('COMMIT');

// Log initial sync
db.prepare(`
  INSERT INTO sync_log (sync_type, started_at, completed_at, status, records_added)
  VALUES (?, ?, ?, ?, ?)
`).run('full', new Date().toISOString(), new Date().toISOString(), 'success', samples.length);

// Update metadata
db.prepare("UPDATE metadata SET value = ? WHERE key = 'total_entities'").run(samples.length.toString());
db.prepare("UPDATE metadata SET value = ? WHERE key = 'last_full_sync'").run(new Date().toISOString());

db.close();
console.log(`✅ Test database created with ${samples.length} sample entities`);
console.log(`Database: ${DB_PATH}`);
