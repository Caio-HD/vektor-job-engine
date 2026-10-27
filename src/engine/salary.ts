export type SalaryUnit = 'month' | 'hour' | 'year' | 'unknown';

export type ParsedSalary = {
  raw: string;
  currency: 'USD' | 'BRL' | 'UNKNOWN';
  min?: number;
  max?: number;
  monthlyMin?: number;
  monthlyMax?: number;
  unit: SalaryUnit;
  assumedUnit: boolean;
  assumedCurrency: boolean;
};

const UNKNOWN_RAW = /^(?:not\s+specified|n[aã]o\s+informado|see\s+listing|n\/?a|-)?$/i;

// Piece rates are not convertible to a monthly salary floor.
const NON_SALARY_RATE =
  /\bper\s+(?:tasks?|projects?|pieces?|units?|submissions?|contracts?)\b/i;

export function isNonSalaryRate(raw: string): boolean {
  return NON_SALARY_RATE.test(raw);
}

// Brazilian strings use . as thousands separator and , as decimal mark.
function prefersBrazilianNumbers(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (/r\$|\bbrl\b|\breais?\b/.test(lower)) return true;
  if (/m[eê]s|\bano\b/.test(lower)) return true;
  if (/\d{1,3}(?:\.\d{3})+,\d+/.test(raw)) return true;
  if (/\d+,\d{1,2}\s*[kKmM]\b/.test(raw)) return true;
  if (/\d{1,3}(?:\.\d{3})+(?!\d)/.test(raw)) return true;
  return false;
}

function parseNumberToken(token: string, preferBr: boolean): number | undefined {
  let body = token.replace(/\s+/g, '');
  if (!body) return undefined;

  let mult = 1;
  const suffix = body.match(/([kKmM])$/);
  if (suffix) {
    mult = suffix[1].toLowerCase() === 'm' ? 1_000_000 : 1_000;
    body = body.slice(0, -1);
  }

  const hasDot = body.includes('.');
  const hasComma = body.includes(',');

  if (hasDot && hasComma) {
    if (body.lastIndexOf(',') > body.lastIndexOf('.')) {
      body = body.replace(/\./g, '').replace(',', '.');
    } else {
      body = body.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const frac = body.split(',')[1] ?? '';
    if (preferBr || (frac.length > 0 && frac.length !== 3) || mult !== 1) {
      body = body.replace(',', '.');
    } else {
      body = body.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    const parts = body.split('.');
    const thousandsStyle = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    if (preferBr || thousandsStyle) {
      body = body.replace(/\./g, '');
    }
  }

  const value = Number(body);
  if (!Number.isFinite(value)) return undefined;
  return value * mult;
}

export function parseAmountNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!cleaned) return undefined;
  return parseNumberToken(cleaned, prefersBrazilianNumbers(raw));
}

function detectCurrency(raw: string): {
  currency: ParsedSalary['currency'];
  assumedCurrency: boolean;
} {
  const lower = raw.toLowerCase();
  if (/r\$|\bbrl\b|\breais?\b/.test(lower)) {
    return { currency: 'BRL', assumedCurrency: false };
  }
  // "$" alone is USD; R$ already handled above.
  if (/us\$|\busd\b|\$/.test(lower)) {
    return { currency: 'USD', assumedCurrency: false };
  }
  return { currency: 'UNKNOWN', assumedCurrency: true };
}

export type SalaryUnitHint = 'year' | 'hour' | 'month';

export type ParseSalaryOptions = {
  unitHint?: SalaryUnitHint;
};

function detectUnit(
  raw: string,
  unitHint?: SalaryUnitHint,
): { unit: Exclude<SalaryUnit, 'unknown'>; assumedUnit: boolean } {
  const lower = raw.toLowerCase();
  if (/\/h(?:r|our|ours)?\b|\bper\s+hours?\b|\bhrs?\b|\bhoras?\b|\bhours?\b|usd\/h|\$\/h/.test(lower)) {
    return { unit: 'hour', assumedUnit: false };
  }
  if (/m[eê]s|\bmonths?\b|\bmonthly\b|\/mo\b|\/month\b/.test(lower)) {
    return { unit: 'month', assumedUnit: false };
  }
  if (/\bano\b|\byears?\b|\bannually\b|\/yr\b|\/year\b|\bper\s+year\b/.test(lower)) {
    return { unit: 'year', assumedUnit: false };
  }
  if (unitHint) {
    return { unit: unitHint, assumedUnit: false };
  }
  const byCurrency = unitFromCurrencyConvention(raw);
  if (byCurrency) {
    return { unit: byCurrency, assumedUnit: true };
  }
  return { unit: 'month', assumedUnit: true };
}

// Market convention when the text carries no unit: a US or euro amount is an annual
// band, a Brazilian amount is a monthly one. Reading a US band as monthly would
// inflate it twelvefold and let a job below the floor survive.
function unitFromCurrencyConvention(raw: string): Exclude<SalaryUnit, 'unknown'> | null {
  const lower = raw.toLowerCase();
  if (/r\$|\bbrl\b/.test(lower)) return 'month';
  if (/us\$|\busd\b|€|\beur\b|\$/.test(lower)) return 'year';
  return null;
}

// Full-time monthly equivalent assumes 160 working hours per month.
function toMonthly(value: number, unit: Exclude<SalaryUnit, 'unknown'>): number {
  switch (unit) {
    case 'hour':
      return value * 160;
    case 'year':
      return value / 12;
    case 'month':
      return value;
  }
}

type PlausibilityWindow = { minAnnual: number; maxAnnual: number };

// A pay band is only a salary when its annual equivalent is plausible for the
// currency. Outside this window the number is a funding round, a budget or a
// sentence fragment, never a pay check.
// Monthly lower bounds (USD 750, BRL 3.000) stay below the configured floors
// (USD 4.000, BRL 8.000) so a job the floor should discard is still discarded
// instead of being reported as "no salary".
const PLAUSIBILITY_WINDOWS: Record<ParsedSalary['currency'], PlausibilityWindow> = {
  USD: { minAnnual: 9_000, maxAnnual: 2_500_000 },
  BRL: { minAnnual: 36_000, maxAnnual: 3_000_000 },
  // No dedicated EUR band exists: EUR text resolves to UNKNOWN, and an absurd
  // fragment such as "EUR 47" must still not become a salary. Sized like USD.
  UNKNOWN: { minAnnual: 9_000, maxAnnual: 2_500_000 },
};

function annualEquivalent(value: number, unit: Exclude<SalaryUnit, 'unknown'>): number {
  return toMonthly(value, unit) * 12;
}

function isPlausibleSalaryValue(
  value: number,
  currency: ParsedSalary['currency'],
  unit: Exclude<SalaryUnit, 'unknown'>,
): boolean {
  const window = PLAUSIBILITY_WINDOWS[currency];
  const annual = annualEquivalent(value, unit);
  return annual >= window.minAnnual && annual <= window.maxAnnual;
}

function extractNumberTokens(raw: string): string[] {
  const matches = raw.match(/\d+(?:[.,]\d+)*\s*[kKmM]?/gi);
  return matches ?? [];
}

export function parseSalary(
  raw: string | undefined | null,
  options?: ParseSalaryOptions,
): ParsedSalary {
  if (raw == null) {
    return {
      raw: '',
      currency: 'UNKNOWN',
      unit: 'unknown',
      assumedUnit: false,
      assumedCurrency: false,
    };
  }

  const trimmed = raw.trim();
  if (!trimmed || UNKNOWN_RAW.test(trimmed) || !/\d/.test(trimmed)) {
    return {
      raw: trimmed,
      currency: 'UNKNOWN',
      unit: 'unknown',
      assumedUnit: false,
      assumedCurrency: false,
    };
  }

  // Per-task / per-project rates must not become a monthly floor value.
  if (isNonSalaryRate(trimmed)) {
    const { currency, assumedCurrency } = detectCurrency(trimmed);
    return {
      raw: trimmed,
      currency,
      unit: 'unknown',
      assumedUnit: false,
      assumedCurrency: currency === 'UNKNOWN' ? true : assumedCurrency,
    };
  }

  const preferBr = prefersBrazilianNumbers(trimmed);
  const values = extractNumberTokens(trimmed)
    .map((token) => parseNumberToken(token, preferBr))
    .filter((n): n is number => n !== undefined && n > 0);

  if (values.length === 0) {
    return {
      raw: trimmed,
      currency: 'UNKNOWN',
      unit: 'unknown',
      assumedUnit: false,
      assumedCurrency: false,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const { currency, assumedCurrency } = detectCurrency(trimmed);
  const { unit, assumedUnit } = detectUnit(trimmed, options?.unitHint);
  const plausible = isPlausibleSalaryValue(min, currency, unit);

  return {
    raw: trimmed,
    currency,
    min: plausible ? min : undefined,
    max: plausible ? max : undefined,
    monthlyMin: plausible ? toMonthly(min, unit) : undefined,
    monthlyMax: plausible ? toMonthly(max, unit) : undefined,
    unit,
    assumedUnit,
    assumedCurrency: currency === 'UNKNOWN' ? true : assumedCurrency,
  };
}
