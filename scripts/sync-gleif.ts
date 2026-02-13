#!/usr/bin/env npx tsx
/**
 * Sync GLEIF database with the latest Golden Copy release.
 *
 * Current strategy: metadata-aware full rebuild when new data exists or local DB is incomplete.
 */

import Database from '@ansvar/mcp-sqlite';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const DB_PATH = process.env.GLEIF_DB_PATH || join(DATA_DIR, 'gleif.db');

const LATEST_API_URL = 'https://goldencopy.gleif.org/api/v2/golden-copies/publishes/lei2/latest';
const MIN_PRODUCTION_ENTITY_COUNT = Number.parseInt(process.env.GLEIF_MIN_ENTITY_COUNT || '1000000', 10);
const MIN_COMPLETENESS_RATIO = 0.98;

interface LatestMetadata {
  publishDate: string;
  recordCount: number;
  csvUrl: string;
}

interface DatabaseState {
  exists: boolean;
  entityCount: number;
  expectedEntityCount: number | null;
  sourcePublishDate: string | null;
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isNewerDate(nextDate: string | null, currentDate: string | null): boolean {
  if (!nextDate) return false;
  if (!currentDate) return true;

  const next = Date.parse(nextDate);
  const current = Date.parse(currentDate);

  if (!Number.isFinite(next) || !Number.isFinite(current)) {
    return nextDate !== currentDate;
  }

  return next > current;
}

async function fetchLatestMetadata(): Promise<LatestMetadata> {
  console.log('📡 Fetching latest GLEIF publish metadata...');
  const response = await fetch(LATEST_API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data: {
      publish_date: string;
      full_file: {
        csv: {
          record_count: number;
          url: string;
        };
      };
    };
  };

  return {
    publishDate: payload.data.publish_date,
    recordCount: payload.data.full_file.csv.record_count,
    csvUrl: payload.data.full_file.csv.url,
  };
}

function readDatabaseState(): DatabaseState {
  if (!existsSync(DB_PATH)) {
    return {
      exists: false,
      entityCount: 0,
      expectedEntityCount: null,
      sourcePublishDate: null,
    };
  }

  const db = new Database(DB_PATH, { readonly: true });

  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
    const metadataRows = db.prepare('SELECT key, value FROM metadata').all() as Array<{ key: string; value: string }>;
    const metadata = Object.fromEntries(metadataRows.map(row => [row.key, row.value]));

    return {
      exists: true,
      entityCount: countRow.count,
      expectedEntityCount: parseIntOrNull(metadata.expected_entities),
      sourcePublishDate: metadata.source_publish_date || metadata.last_full_sync || null,
    };
  } catch (error) {
    return {
      exists: true,
      entityCount: 0,
      expectedEntityCount: null,
      sourcePublishDate: null,
    };
  } finally {
    db.close();
  }
}

function needsRebuild(state: DatabaseState, latest: LatestMetadata | null, force: boolean): string[] {
  const reasons: string[] = [];

  if (force) {
    reasons.push('GLEIF_FORCE_FULL_SYNC=true');
  }

  if (!state.exists) {
    reasons.push(`Database missing at ${DB_PATH}`);
    return reasons;
  }

  if (state.entityCount < MIN_PRODUCTION_ENTITY_COUNT) {
    reasons.push(`Entity count ${state.entityCount.toLocaleString()} is below production minimum ${MIN_PRODUCTION_ENTITY_COUNT.toLocaleString()}`);
  }

  if (state.expectedEntityCount && state.expectedEntityCount > 0) {
    const completeness = state.entityCount / state.expectedEntityCount;
    if (completeness < MIN_COMPLETENESS_RATIO) {
      reasons.push(
        `Completeness ${ (completeness * 100).toFixed(2)}% is below threshold ${(MIN_COMPLETENESS_RATIO * 100).toFixed(0)}%`
      );
    }
  }

  if (latest && isNewerDate(latest.publishDate, state.sourcePublishDate)) {
    reasons.push(`New publish detected (${latest.publishDate} > ${state.sourcePublishDate || 'none'})`);
  }

  return reasons;
}

async function runFullBuild(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', 'build:db'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`build:db exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('🔄 GLEIF Database Sync');
  console.log('═══════════════════════════════════════');

  const force = process.env.GLEIF_FORCE_FULL_SYNC === 'true';

  const currentState = readDatabaseState();
  console.log(`Current DB: ${currentState.exists ? 'present' : 'missing'}`);
  console.log(`Current entities: ${currentState.entityCount.toLocaleString()}`);
  console.log(`Current publish date: ${currentState.sourcePublishDate || 'unknown'}`);

  let latest: LatestMetadata | null = null;
  try {
    latest = await fetchLatestMetadata();
    console.log(`Latest publish date: ${latest.publishDate}`);
    console.log(`Latest record count: ${latest.recordCount.toLocaleString()}`);
  } catch (error) {
    console.warn(`⚠️  Could not fetch latest metadata: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  const reasons = needsRebuild(currentState, latest, force);

  if (reasons.length === 0) {
    console.log('✅ Database already up to date and production-ready. No sync needed.');
    return;
  }

  if (!latest && !currentState.exists) {
    throw new Error('Cannot build database: latest metadata unavailable and local database does not exist.');
  }

  console.log('🚧 Rebuild required:');
  reasons.forEach(reason => console.log(`   - ${reason}`));

  await runFullBuild();

  const updatedState = readDatabaseState();
  console.log('');
  console.log('✅ Sync complete');
  console.log(`Updated entities: ${updatedState.entityCount.toLocaleString()}`);
  console.log(`Updated publish date: ${updatedState.sourcePublishDate || 'unknown'}`);
}

main().catch(error => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
});
