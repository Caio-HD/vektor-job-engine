import { parseSalary } from '@/engine/salary';

export type SalaryTextUnitHint = 'year' | 'hour' | 'month';

export type ExtractedSalaryText = {
  raw: string;
  unitHint: SalaryTextUnitHint;
};

const CURRENCY = String.raw`R\$|US\$|USD|BRL|EUR|€|\$`;
const NUMBER = String.raw`\d{1,3}(?:\.\d{3})+,\d{1,2}|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d+)?\s*[kKmM]?`;
const RANGE_SEP = String.raw`to|-|–|—|a|até`;

// Non-salary piece rates — never treat these as monthly compensation.
const NON_SALARY_RATE =
  /\bper\s+(?:tasks?|projects?|pieces?|units?|submissions?|contracts?)\b/i;

const BAND_CURRENCY_FIRST = new RegExp(
  String.raw`(?:${CURRENCY})\s*(?:${NUMBER})(?:\s*(?:${RANGE_SEP})\s*(?:${CURRENCY}\s*)?(?:${NUMBER}))?(?:\s*(?:${CURRENCY}))?`,
  'gi',
);

const BAND_CURRENCY_LAST = new RegExp(
  String.raw`(?:${NUMBER})(?:\s*(?:${RANGE_SEP})\s*(?:${NUMBER}))?\s*(?:${CURRENCY})`,
  'gi',
);

function isNonSalaryRate(context: string): boolean {
  return NON_SALARY_RATE.test(context);
}

function unitFromContext(context: string): SalaryTextUnitHint | null {
  const lower = context.toLowerCase();
  if (/per\s+year|\bannually\b|\byearly\b|\/year\b|\/yr\b/.test(lower)) {
    return 'year';
  }
  if (/per\s+hour|\bhourly\b|\/hour\b|\/hr\b/.test(lower)) {
    return 'hour';
  }
  if (/per\s+month|\bmonthly\b|\/month\b|\/mo\b/.test(lower)) {
    return 'month';
  }
  return null;
}

/**
 * Currency convention when the band has no explicit unit keyword:
 * USD / EUR / $ → annual; BRL / R$ → monthly.
 * No currency marker → caller must not guess (returns null upstream).
 */
function unitFromCurrencyConvention(raw: string): SalaryTextUnitHint | null {
  const lower = raw.toLowerCase();
  if (/r\$|\bbrl\b/.test(lower)) return 'month';
  if (/us\$|\busd\b|€|\beur\b|\$/.test(lower)) return 'year';
  return null;
}

function collectBandMatches(text: string): { start: number; end: number; raw: string }[] {
  const found: { start: number; end: number; raw: string }[] = [];
  const seen = new Set<string>();

  for (const re of [BAND_CURRENCY_FIRST, BAND_CURRENCY_LAST]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const key = `${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ start, end, raw: match[0].trim() });
    }
  }

  // Prefer earlier bands; at the same start, keep the longer span.
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  return found;
}

/**
 * Extract the first plausible numeric salary band from announcement prose.
 * Matches amounts only (not headings like "Compensation"). Skips per-task /
 * per-project piece rates. Requires a currency marker.
 */
export function extractSalaryFromText(
  text: string | undefined,
): ExtractedSalaryText | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const band of collectBandMatches(trimmed)) {
    const ctxStart = Math.max(0, band.start - 120);
    const ctxEnd = Math.min(trimmed.length, band.end + 120);
    const context = trimmed.slice(ctxStart, ctxEnd);

    // Keep the piece-rate window tight so an earlier "$X per task" does not
    // poison a later real salary band inside the broader unit context.
    const rateStart = Math.max(0, band.start - 15);
    const rateEnd = Math.min(trimmed.length, band.end + 30);
    if (isNonSalaryRate(trimmed.slice(rateStart, rateEnd))) continue;

    const unitHint =
      unitFromContext(context) ?? unitFromCurrencyConvention(band.raw);
    if (!unitHint) continue;

    // A funding round ("$11M") or a fragment ("EUR 47") is not a salary band.
    // Skip it and keep scanning so a real band later in the text is found.
    const parsedBand = parseSalary(band.raw, { unitHint });
    if (typeof parsedBand.min !== 'number') continue;

    return { raw: band.raw, unitHint };
  }

  return null;
}
