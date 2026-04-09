/**
 * Shared metadata helpers for GLEIF MCP tool responses.
 * All tool responses must include a _meta block (audit requirement).
 */

export interface MetaBlock {
  disclaimer: string;
  data_age_hours: number | null;
  copyright: string;
  source_url: string;
}

export interface CitationBlock {
  canonical_ref: string;
  display_text: string;
  lookup: { tool: 'verify_lei'; input: { lei: string } };
}

/**
 * Build the standard _meta block for all tool responses.
 * @param dataAgeHours - Age of the database in hours (null if unknown)
 */
export function buildMeta(dataAgeHours: number | null = null): MetaBlock {
  return {
    disclaimer:
      'Data sourced from the GLEIF Golden Copy database. For authoritative information verify directly at https://www.gleif.org.',
    data_age_hours: dataAgeHours,
    copyright: 'CC0 1.0 Universal (Public Domain)',
    source_url: 'https://www.gleif.org/en/lei-data/gleif-golden-copy',
  };
}

/**
 * Build a _citation block for a single LEI entity.
 * The lookup.tool is always 'verify_lei' as per fleet standard.
 */
export function buildCitation(lei: string, legalName: string): CitationBlock {
  return {
    canonical_ref: `LEI:${lei}`,
    display_text: legalName,
    lookup: { tool: 'verify_lei', input: { lei } },
  };
}
