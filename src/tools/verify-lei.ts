import type { DatabaseAdapter, LEIRecord } from '../database/types.js';
import { buildMeta, buildCitation, type MetaBlock, type CitationBlock } from './meta.js';

export interface VerifyLEIInput {
  lei: string;
}

export interface VerifyLEIOutput {
  found: boolean;
  lei?: string;
  entity?: LEIRecord;
  message?: string;
  _error_type?: 'validation_error' | 'not_found';
  _meta: MetaBlock;
  _citation?: CitationBlock;
}

/**
 * Verify a Legal Entity Identifier (LEI) and return entity details
 */
export async function verifyLEI(
  db: DatabaseAdapter,
  input: VerifyLEIInput
): Promise<VerifyLEIOutput> {
  const lei = input.lei ? String(input.lei) : '';

  // Validate LEI format (20 alphanumeric characters)
  if (!lei || lei.length !== 20 || !/^[A-Z0-9]{20}$/i.test(lei)) {
    return {
      found: false,
      message: 'Invalid LEI format. LEI must be exactly 20 alphanumeric characters.',
      _error_type: 'validation_error',
      _meta: buildMeta(),
    };
  }

  const record = db.verifyLEI(lei);

  if (!record) {
    return {
      found: false,
      lei: lei.toUpperCase(),
      message: 'LEI not found in database. Entity may not be registered or database needs sync.',
      _error_type: 'not_found',
      _meta: buildMeta(),
    };
  }

  return {
    found: true,
    lei: record.lei,
    entity: record,
    _meta: buildMeta(),
    _citation: buildCitation(record.lei, record.legal_name),
  };
}
