import type Database from '@ansvar/mcp-sqlite';

const MIN_PRODUCTION_ENTITY_COUNT = Number.parseInt(process.env.GLEIF_MIN_ENTITY_COUNT || '1000000', 10);
const MIN_COMPLETENESS_RATIO = 0.98;

export interface DatabaseReadiness {
  entityCount: number;
  expectedEntityCount: number | null;
  coverageRatio: number | null;
  productionReady: boolean;
  issues: string[];
}

function parseExpectedEntityCount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function assessDatabaseReadiness(db: InstanceType<typeof Database>): DatabaseReadiness {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
  const metadataRows = db.prepare('SELECT key, value FROM metadata').all() as Array<{ key: string; value: string }>;
  const metadata = Object.fromEntries(metadataRows.map(row => [row.key, row.value]));

  const entityCount = countRow.count;
  const expectedEntityCount = parseExpectedEntityCount(metadata.expected_entities);
  const coverageRatio = expectedEntityCount ? entityCount / expectedEntityCount : null;

  const issues: string[] = [];

  if (entityCount < MIN_PRODUCTION_ENTITY_COUNT) {
    issues.push(
      `entity_count ${entityCount.toLocaleString()} is below minimum production threshold ${MIN_PRODUCTION_ENTITY_COUNT.toLocaleString()}`
    );
  }

  if (coverageRatio !== null && coverageRatio < MIN_COMPLETENESS_RATIO) {
    issues.push(
      `coverage ${(coverageRatio * 100).toFixed(2)}% is below required ${(MIN_COMPLETENESS_RATIO * 100).toFixed(0)}%`
    );
  }

  return {
    entityCount,
    expectedEntityCount,
    coverageRatio,
    productionReady: issues.length === 0,
    issues,
  };
}

export function assertProductionReadyDatabase(db: InstanceType<typeof Database>): void {
  const allowIncomplete = process.env.GLEIF_ALLOW_INCOMPLETE_DB === 'true';
  const readiness = assessDatabaseReadiness(db);

  if (readiness.productionReady) {
    return;
  }

  const details = readiness.issues.map(issue => `- ${issue}`).join('\n');
  const baseMessage = [
    'Database is not production-ready.',
    details,
    `Set GLEIF_ALLOW_INCOMPLETE_DB=true only for local testing.`,
    `Rebuild with: npm run build:db`,
  ].join('\n');

  if (allowIncomplete) {
    console.error(`[gleif-mcp] WARNING\n${baseMessage}`);
    return;
  }

  throw new Error(baseMessage);
}
