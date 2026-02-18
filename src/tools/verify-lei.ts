import type { DatabaseAdapter, LEIRecord } from '../database/types.js';

export interface VerifyLEIInput {
  lei: string;
}

export interface VerifyLEIOutput {
  found: boolean;
  lei?: string;
  entity?: LEIRecord;
  message?: string;
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
    };
  }

  const record = db.verifyLEI(lei);

  if (!record) {
    return {
      found: false,
      lei: lei.toUpperCase(),
      message: 'LEI not found in database. Entity may not be registered or database needs sync.',
    };
  }

  return {
    found: true,
    lei: record.lei,
    entity: record,
  };
}
