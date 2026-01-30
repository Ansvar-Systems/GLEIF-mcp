#!/usr/bin/env npx tsx

/**
 * Build the gleif.db SQLite database from GLEIF Golden Copy.
 * Downloads 3.2M+ LEI records and creates searchable local database.
 *
 * Run with: npm run build:db
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync, createWriteStream, createReadStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'gleif.db');
const ZIP_PATH = join(DATA_DIR, 'gleif-download.csv.zip');
const CSV_PATH = join(DATA_DIR, 'gleif-download.csv');

// GLEIF Golden Copy API v2
const GLEIF_API_URL = 'https://goldencopy.gleif.org/api/v2/golden-copies/publishes/lei2/latest';

interface GLEIFMetadata {
  data: {
    publish_date: string;
    full_file: {
      csv: {
        record_count: number;
        size: number;
        size_human_readable: string;
        url: string;
      };
    };
  };
}

/**
 * Fetch GLEIF Golden Copy metadata
 */
async function fetchMetadata(): Promise<GLEIFMetadata> {
  console.log('📡 Fetching GLEIF Golden Copy metadata...');
  const response = await fetch(GLEIF_API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
  }

  const metadata = (await response.json()) as GLEIFMetadata;
  console.log(`✅ Published: ${metadata.data.publish_date}`);
  console.log(`   Records: ${metadata.data.full_file.csv.record_count.toLocaleString()}`);
  console.log(`   Size: ${metadata.data.full_file.csv.size_human_readable}`);

  return metadata;
}

/**
 * Download ZIP file from GLEIF
 */
async function downloadZIP(url: string): Promise<void> {
  console.log('📥 Downloading GLEIF CSV (this may take 5-10 minutes)...');
  console.log(`   Source: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ZIP: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Create data directory if it doesn't exist
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Stream to file
  const fileStream = createWriteStream(ZIP_PATH);
  await pipeline(response.body as any, fileStream);

  console.log(`✅ ZIP downloaded to ${ZIP_PATH}`);
}

/**
 * Extract ZIP file
 */
async function extractZIP(): Promise<void> {
  console.log('📦 Extracting ZIP file...');

  try {
    // Use unzip command (available on macOS/Linux)
    await execAsync(`unzip -o "${ZIP_PATH}" -d "${DATA_DIR}"`);

    // Find the extracted CSV file
    const { stdout } = await execAsync(`ls "${DATA_DIR}"/*.csv | head -1`);
    const extractedFile = stdout.trim();

    if (extractedFile && extractedFile !== CSV_PATH) {
      // Rename to standard name
      await execAsync(`mv "${extractedFile}" "${CSV_PATH}"`);
    }

    console.log(`✅ CSV extracted to ${CSV_PATH}`);
  } catch (error) {
    throw new Error(`Failed to extract ZIP: ${error}`);
  }
}

/**
 * Initialize database with schema
 */
function initializeDatabase(db: Database.Database): void {
  console.log('🗄️  Initializing database schema...');

  const schemaPath = join(__dirname, '..', 'src', 'database', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  db.exec(schema);

  console.log('✅ Database schema created');
}

/**
 * Parse CSV and load into database
 */
async function loadData(db: Database.Database, publishedAt: string): Promise<number> {
  console.log('📊 Loading data into database (this will take 5-10 minutes)...');

  // Log sync start
  const syncStmt = db.prepare(`
    INSERT INTO sync_log (sync_type, started_at, status, source_url)
    VALUES (?, ?, ?, ?)
  `);
  const syncResult = syncStmt.run('full', new Date().toISOString(), 'running', GLEIF_API_URL);
  const syncId = syncResult.lastInsertRowid as number;

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO entities (
      lei,
      legal_name,
      legal_name_lower,
      registration_status,
      jurisdiction,
      category,
      legal_address_line1,
      legal_address_line2,
      legal_address_city,
      legal_address_region,
      legal_address_country,
      legal_address_postal_code,
      hq_address_line1,
      hq_address_line2,
      hq_address_city,
      hq_address_region,
      hq_address_country,
      hq_address_postal_code,
      initial_registration_date,
      last_update_date,
      next_renewal_date,
      managing_lou,
      entity_status,
      entity_category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  let headerParsed = false;
  let headerMap: Map<string, number> = new Map();

  db.exec('BEGIN TRANSACTION');

  try {
    const fileStream = createReadStream(CSV_PATH, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      // Parse header
      if (!headerParsed) {
        const headers = parseCSVLine(line);
        headers.forEach((header, index) => {
          headerMap.set(header, index);
        });
        headerParsed = true;
        console.log(`   Found ${headers.length} columns in CSV`);
        continue;
      }

      // Parse data row
      const values = parseCSVLine(line);

      if (values.length < 10) {
        // Skip malformed rows
        continue;
      }

      const lei = values[headerMap.get('LEI') || 0] || '';
      const legalName = values[headerMap.get('Entity.LegalName') || 1] || '';

      if (!lei || !legalName) {
        continue;
      }

      // Extract fields based on GLEIF CSV structure
      insertStmt.run(
        lei,
        legalName,
        legalName.toLowerCase(),
        values[headerMap.get('Entity.RegistrationStatus') || 2] || 'UNKNOWN',
        values[headerMap.get('Entity.LegalJurisdiction') || 3] || null,
        values[headerMap.get('Entity.EntityCategory') || 4] || null,
        // Legal Address
        values[headerMap.get('Entity.LegalAddress.FirstAddressLine') || 5] || null,
        values[headerMap.get('Entity.LegalAddress.AdditionalAddressLine') || 6] || null,
        values[headerMap.get('Entity.LegalAddress.City') || 7] || null,
        values[headerMap.get('Entity.LegalAddress.Region') || 8] || null,
        values[headerMap.get('Entity.LegalAddress.Country') || 9] || null,
        values[headerMap.get('Entity.LegalAddress.PostalCode') || 10] || null,
        // HQ Address
        values[headerMap.get('Entity.HeadquartersAddress.FirstAddressLine') || 11] || null,
        values[headerMap.get('Entity.HeadquartersAddress.AdditionalAddressLine') || 12] || null,
        values[headerMap.get('Entity.HeadquartersAddress.City') || 13] || null,
        values[headerMap.get('Entity.HeadquartersAddress.Region') || 14] || null,
        values[headerMap.get('Entity.HeadquartersAddress.Country') || 15] || null,
        values[headerMap.get('Entity.HeadquartersAddress.PostalCode') || 16] || null,
        // Registration dates
        values[headerMap.get('Registration.InitialRegistrationDate') || 17] || null,
        values[headerMap.get('Registration.LastUpdateDate') || 18] || null,
        values[headerMap.get('Registration.NextRenewalDate') || 19] || null,
        values[headerMap.get('Registration.ManagingLOU') || 20] || null,
        values[headerMap.get('Entity.EntityStatus') || 21] || null,
        values[headerMap.get('Entity.EntityCategory') || 4] || null
      );

      count++;

      if (count % 100000 === 0) {
        console.log(`   Loaded ${count.toLocaleString()} entities...`);
      }
    }

    db.exec('COMMIT');

    // Update metadata
    db.prepare("UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'total_entities'").run(
      count.toString()
    );
    db.prepare("UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_full_sync'").run(
      publishedAt
    );

    // Update sync log
    db.prepare(
      'UPDATE sync_log SET completed_at = ?, status = ?, records_added = ? WHERE id = ?'
    ).run(new Date().toISOString(), 'success', count, syncId);

    console.log(`✅ Successfully loaded ${count.toLocaleString()} entities`);

    return count;
  } catch (error) {
    db.exec('ROLLBACK');

    // Log sync failure
    db.prepare('UPDATE sync_log SET status = ?, error_message = ? WHERE id = ?').run(
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      syncId
    );

    throw error;
  }
}

/**
 * Simple CSV line parser (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Push last field
  result.push(current);

  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 GLEIF Database Builder');
  console.log('═══════════════════════════════════════\n');

  try {
    // Step 1: Fetch metadata
    const metadata = await fetchMetadata();
    const csvUrl = metadata.data.full_file.csv.url;
    const publishedAt = metadata.data.publish_date;

    // Step 2: Download ZIP
    await downloadZIP(csvUrl);

    // Step 3: Extract ZIP
    await extractZIP();

    // Step 4: Initialize database
    if (existsSync(DB_PATH)) {
      console.log(`⚠️  Removing existing database at ${DB_PATH}`);
      unlinkSync(DB_PATH);
    }

    const db = new Database(DB_PATH);
    initializeDatabase(db);

    // Step 5: Load data
    const totalRecords = await loadData(db, publishedAt);

    db.close();

    // Step 6: Cleanup
    console.log('\n🧹 Cleaning up...');
    if (existsSync(ZIP_PATH)) {
      unlinkSync(ZIP_PATH);
      console.log('✅ ZIP file removed');
    }
    if (existsSync(CSV_PATH)) {
      unlinkSync(CSV_PATH);
      console.log('✅ CSV file removed');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✨ Database build complete!');
    console.log(`📊 Total entities: ${totalRecords.toLocaleString()}`);
    console.log(`💾 Database: ${DB_PATH}`);
    console.log('═══════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

main();
