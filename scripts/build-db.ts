#!/usr/bin/env npx tsx

/**
 * Build the gleif.db SQLite database from GLEIF Golden Copy.
 * Downloads 3.2M+ LEI records and creates searchable local database.
 *
 * Run with: npm run build:db
 */

import Database from 'better-sqlite3';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  createWriteStream,
  createReadStream,
  unlinkSync,
} from 'fs';
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
const DB_PATH = process.env.GLEIF_DB_PATH || join(DATA_DIR, 'gleif.db');
const DEFAULT_ZIP_PATH = join(DATA_DIR, 'gleif-download.csv.zip');
const DEFAULT_CSV_PATH = join(DATA_DIR, 'gleif-download.csv');

const ZIP_PATH = process.env.GLEIF_SOURCE_ZIP_PATH || DEFAULT_ZIP_PATH;
const CSV_PATH = process.env.GLEIF_SOURCE_CSV_PATH || DEFAULT_CSV_PATH;

const GLEIF_API_URL = 'https://goldencopy.gleif.org/api/v2/golden-copies/publishes/lei2/latest';
const MIN_COMPLETENESS_RATIO = 0.98;

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

interface BuildContext {
  sourceUrl: string;
  publishedAt: string;
  expectedRecordCount: number | null;
}

interface ColumnMap {
  lei: number;
  legalName: number;
  registrationStatus?: number;
  legalJurisdiction?: number;
  entityCategory?: number;
  legalAddressLine1?: number;
  legalAddressLine2?: number;
  legalAddressCity?: number;
  legalAddressRegion?: number;
  legalAddressCountry?: number;
  legalAddressPostalCode?: number;
  hqAddressLine1?: number;
  hqAddressLine2?: number;
  hqAddressCity?: number;
  hqAddressRegion?: number;
  hqAddressCountry?: number;
  hqAddressPostalCode?: number;
  initialRegistrationDate?: number;
  lastUpdateDate?: number;
  nextRenewalDate?: number;
  managingLou?: number;
  entityStatus?: number;
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

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
    await execAsync(`unzip -o "${ZIP_PATH}" -d "${DATA_DIR}"`);

    const { stdout } = await execAsync(`ls "${DATA_DIR}"/*.csv | head -1`);
    const extractedFile = stdout.trim();

    if (!extractedFile) {
      throw new Error('No CSV file found after extraction');
    }

    if (extractedFile !== CSV_PATH) {
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

function getRequiredColumnIndex(headerMap: Map<string, number>, key: string): number {
  const idx = headerMap.get(key);
  if (idx === undefined) {
    throw new Error(`Required CSV column missing: ${key}`);
  }
  return idx;
}

function getOptionalColumnIndex(headerMap: Map<string, number>, key: string): number | undefined {
  return headerMap.get(key);
}

function buildColumnMap(headerMap: Map<string, number>): ColumnMap {
  return {
    lei: getRequiredColumnIndex(headerMap, 'LEI'),
    legalName: getRequiredColumnIndex(headerMap, 'Entity.LegalName'),
    registrationStatus: getOptionalColumnIndex(headerMap, 'Entity.RegistrationStatus'),
    legalJurisdiction: getOptionalColumnIndex(headerMap, 'Entity.LegalJurisdiction'),
    entityCategory: getOptionalColumnIndex(headerMap, 'Entity.EntityCategory'),
    legalAddressLine1: getOptionalColumnIndex(headerMap, 'Entity.LegalAddress.FirstAddressLine'),
    legalAddressLine2: getOptionalColumnIndex(headerMap, 'Entity.LegalAddress.AdditionalAddressLine'),
    legalAddressCity: getOptionalColumnIndex(headerMap, 'Entity.LegalAddress.City'),
    legalAddressRegion: getOptionalColumnIndex(headerMap, 'Entity.LegalAddress.Region'),
    legalAddressCountry: getOptionalColumnIndex(headerMap, 'Entity.LegalAddress.Country'),
    legalAddressPostalCode: getOptionalColumnIndex(headerMap, 'Entity.LegalAddress.PostalCode'),
    hqAddressLine1: getOptionalColumnIndex(headerMap, 'Entity.HeadquartersAddress.FirstAddressLine'),
    hqAddressLine2: getOptionalColumnIndex(headerMap, 'Entity.HeadquartersAddress.AdditionalAddressLine'),
    hqAddressCity: getOptionalColumnIndex(headerMap, 'Entity.HeadquartersAddress.City'),
    hqAddressRegion: getOptionalColumnIndex(headerMap, 'Entity.HeadquartersAddress.Region'),
    hqAddressCountry: getOptionalColumnIndex(headerMap, 'Entity.HeadquartersAddress.Country'),
    hqAddressPostalCode: getOptionalColumnIndex(headerMap, 'Entity.HeadquartersAddress.PostalCode'),
    initialRegistrationDate: getOptionalColumnIndex(headerMap, 'Registration.InitialRegistrationDate'),
    lastUpdateDate: getOptionalColumnIndex(headerMap, 'Registration.LastUpdateDate'),
    nextRenewalDate: getOptionalColumnIndex(headerMap, 'Registration.NextRenewalDate'),
    managingLou: getOptionalColumnIndex(headerMap, 'Registration.ManagingLOU'),
    entityStatus: getOptionalColumnIndex(headerMap, 'Entity.EntityStatus'),
  };
}

function valueAt(values: string[], idx: number | undefined): string | null {
  if (idx === undefined) return null;
  const value = values[idx];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasBalancedQuotes(line: string): boolean {
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char !== '"') {
      continue;
    }

    if (inQuotes && line[i + 1] === '"') {
      i++;
      continue;
    }

    inQuotes = !inQuotes;
  }

  return !inQuotes;
}

/**
 * Parse CSV and load into database
 */
async function loadData(db: Database.Database, context: BuildContext): Promise<number> {
  console.log('📊 Loading data into database (this will take 5-15 minutes)...');

  const syncStmt = db.prepare(`
    INSERT INTO sync_log (sync_type, started_at, status, source_url)
    VALUES (?, ?, ?, ?)
  `);
  const syncResult = syncStmt.run('full', new Date().toISOString(), 'running', context.sourceUrl);
  const syncId = syncResult.lastInsertRowid as number;

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
  let malformedRows = 0;
  let headerParsed = false;
  let headerMap: Map<string, number> = new Map();
  let columnMap: ColumnMap | null = null;
  let pendingRecord = '';

  db.exec('BEGIN TRANSACTION');

  try {
    const fileStream = createReadStream(CSV_PATH, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      pendingRecord = pendingRecord.length > 0 ? `${pendingRecord}\n${line}` : line;

      if (!hasBalancedQuotes(pendingRecord)) {
        continue;
      }

      const record = pendingRecord;
      pendingRecord = '';

      if (!headerParsed) {
        const headers = parseCSVLine(record);
        if (headers.length > 0) {
          headers[0] = headers[0].replace(/^\uFEFF/, '');
        }
        headers.forEach((header, index) => {
          headerMap.set(header, index);
        });

        columnMap = buildColumnMap(headerMap);
        headerParsed = true;
        console.log(`   Found ${headers.length} columns in CSV`);
        continue;
      }

      const values = parseCSVLine(record);

      if (values.length < 10 || !columnMap) {
        malformedRows++;
        continue;
      }

      const lei = valueAt(values, columnMap.lei);
      const legalName = valueAt(values, columnMap.legalName);

      if (!lei || !legalName) {
        malformedRows++;
        continue;
      }

      insertStmt.run(
        lei,
        legalName,
        legalName.toLowerCase(),
        valueAt(values, columnMap.registrationStatus) || 'UNKNOWN',
        valueAt(values, columnMap.legalJurisdiction),
        valueAt(values, columnMap.entityCategory),
        valueAt(values, columnMap.legalAddressLine1),
        valueAt(values, columnMap.legalAddressLine2),
        valueAt(values, columnMap.legalAddressCity),
        valueAt(values, columnMap.legalAddressRegion),
        valueAt(values, columnMap.legalAddressCountry),
        valueAt(values, columnMap.legalAddressPostalCode),
        valueAt(values, columnMap.hqAddressLine1),
        valueAt(values, columnMap.hqAddressLine2),
        valueAt(values, columnMap.hqAddressCity),
        valueAt(values, columnMap.hqAddressRegion),
        valueAt(values, columnMap.hqAddressCountry),
        valueAt(values, columnMap.hqAddressPostalCode),
        valueAt(values, columnMap.initialRegistrationDate),
        valueAt(values, columnMap.lastUpdateDate),
        valueAt(values, columnMap.nextRenewalDate),
        valueAt(values, columnMap.managingLou),
        valueAt(values, columnMap.entityStatus),
        valueAt(values, columnMap.entityCategory)
      );

      count++;

      if (count % 100000 === 0) {
        console.log(`   Loaded ${count.toLocaleString()} entities...`);
      }
    }

    if (pendingRecord.trim().length > 0) {
      console.warn('⚠️  Trailing partial CSV record detected and skipped');
      malformedRows++;
    }

    if (context.expectedRecordCount && context.expectedRecordCount > 0) {
      const completeness = count / context.expectedRecordCount;
      if (completeness < MIN_COMPLETENESS_RATIO) {
        throw new Error(
          `Ingestion completeness check failed: loaded ${count.toLocaleString()} / expected ${context.expectedRecordCount.toLocaleString()} (${(completeness * 100).toFixed(2)}%)`
        );
      }
    }

    db.prepare("UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'total_entities'").run(
      count.toString()
    );
    db.prepare("UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_full_sync'").run(
      context.publishedAt
    );
    db.prepare("UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'expected_entities'").run(
      (context.expectedRecordCount || count).toString()
    );
    db.prepare("UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'source_publish_date'").run(
      context.publishedAt
    );

    db.exec('COMMIT');

    db.prepare(
      'UPDATE sync_log SET completed_at = ?, status = ?, records_added = ? WHERE id = ?'
    ).run(new Date().toISOString(), 'success', count, syncId);

    if (malformedRows > 0) {
      console.warn(`⚠️  Skipped ${malformedRows.toLocaleString()} malformed/incomplete CSV rows`);
    }

    console.log(`✅ Successfully loaded ${count.toLocaleString()} entities`);

    return count;
  } catch (error) {
    db.exec('ROLLBACK');

    db.prepare('UPDATE sync_log SET status = ?, error_message = ? WHERE id = ?').run(
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      syncId
    );

    throw error;
  }
}

/**
 * Simple CSV parser (handles quoted fields and escaped quotes)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);

  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 GLEIF Database Builder');
  console.log('═══════════════════════════════════════\n');

  const skipDownload = process.env.GLEIF_SKIP_DOWNLOAD === 'true';
  const keepSourceFiles = process.env.GLEIF_KEEP_SOURCE_FILES === 'true';

  let downloadedZip = false;
  let extractedCsv = false;

  try {
    let metadata: GLEIFMetadata | null = null;

    if (!skipDownload) {
      try {
        metadata = await fetchMetadata();
      } catch (error) {
        if (!existsSync(CSV_PATH) && !existsSync(ZIP_PATH)) {
          throw error;
        }
        console.warn(
          `⚠️  Metadata fetch failed (${error instanceof Error ? error.message : 'unknown'}). Continuing with local snapshot.`
        );
      }
    } else {
      console.log('ℹ️  GLEIF_SKIP_DOWNLOAD=true, using local CSV/ZIP snapshot only');
    }

    if (!existsSync(CSV_PATH)) {
      if (existsSync(ZIP_PATH)) {
        await extractZIP();
        extractedCsv = true;
      } else {
        if (!metadata) {
          throw new Error(
            `No local CSV/ZIP found and metadata unavailable. Expected CSV at ${CSV_PATH} or ZIP at ${ZIP_PATH}`
          );
        }

        await downloadZIP(metadata.data.full_file.csv.url);
        downloadedZip = true;
        await extractZIP();
        extractedCsv = true;
      }
    } else {
      console.log(`ℹ️  Using existing local CSV at ${CSV_PATH}`);
    }

    const inferredPublishDate = new Date().toISOString();
    const expectedFromEnv = parseIntOrNull(process.env.GLEIF_EXPECTED_RECORD_COUNT);

    const context: BuildContext = {
      sourceUrl: metadata?.data.full_file.csv.url || `file://${CSV_PATH}`,
      publishedAt: metadata?.data.publish_date || inferredPublishDate,
      expectedRecordCount: metadata?.data.full_file.csv.record_count || expectedFromEnv,
    };

    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    if (existsSync(DB_PATH)) {
      console.log(`⚠️  Removing existing database at ${DB_PATH}`);
      unlinkSync(DB_PATH);
    }

    const db = new Database(DB_PATH);
    initializeDatabase(db);

    const totalRecords = await loadData(db, context);

    db.close();

    console.log('\n🧹 Cleaning up...');
    if (!keepSourceFiles && downloadedZip && existsSync(ZIP_PATH)) {
      unlinkSync(ZIP_PATH);
      console.log('✅ ZIP file removed');
    }
    if (!keepSourceFiles && extractedCsv && existsSync(CSV_PATH)) {
      unlinkSync(CSV_PATH);
      console.log('✅ CSV file removed');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✨ Database build complete!');
    console.log(`📊 Total entities: ${totalRecords.toLocaleString()}`);
    if (context.expectedRecordCount) {
      const pct = (totalRecords / context.expectedRecordCount) * 100;
      console.log(`📈 Completeness: ${pct.toFixed(2)}% (${totalRecords.toLocaleString()}/${context.expectedRecordCount.toLocaleString()})`);
    }
    console.log(`💾 Database: ${DB_PATH}`);
    console.log('═══════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

main();
