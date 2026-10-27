import { extractSalaryFromText, type ExtractedSalaryText } from '@/engine/salary-text';
import { parseSalary } from '@/engine/salary';
import type { RawJobListing } from '@/types/job';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'Vektor-Career-Engine/0.1.0 (salary-page)';

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, entity: string) => {
      if (entity[0] === '#') {
        const code =
          entity[1] === 'x' || entity[1] === 'X'
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
        if (Number.isFinite(code)) {
          return String.fromCodePoint(code);
        }
        return match;
      }
      return ENTITY_MAP[entity.toLowerCase()] ?? match;
    });
}

/**
 * Strip scripts/styles/tags from an announcement page into plain text, then
 * extract a salary band the same way feed descriptions do.
 */
export function extractSalaryFromPageText(html: string): ExtractedSalaryText | null {
  if (!html) return null;

  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  const withBreaks = withoutNoise
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const plain = decodeHtmlEntities(withBreaks).replace(/\s+/g, ' ').trim();
  if (!plain) return null;

  const extracted = extractSalaryFromText(plain);
  if (!extracted) return null;

  const parsed = parseSalary(extracted.raw, { unitHint: extracted.unitHint });
  if (typeof parsed.min !== 'number') return null;

  return extracted;
}

export type FetchSalaryFromPageOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * GET an announcement page and extract a plausible salary band.
 * Never throws: network errors, timeouts and non-2xx all yield null.
 */
export async function fetchSalaryFromPage(
  url: string,
  options?: FetchSalaryFromPageOptions,
): Promise<ExtractedSalaryText | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      return null;
    }

    const rawBody = await response.text();
    const body =
      rawBody.length > MAX_BODY_BYTES ? rawBody.slice(0, MAX_BODY_BYTES) : rawBody;
    return extractSalaryFromPageText(body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when the feed listing or its description already yields a numeric band. */
export function listingHasUsableSalary(raw: RawJobListing): boolean {
  const fromListing = parseSalary(
    raw.salaryText,
    raw.salaryUnitHint ? { unitHint: raw.salaryUnitHint } : undefined,
  );
  if (typeof fromListing.min === 'number') {
    return true;
  }

  const fromText = extractSalaryFromText(raw.description);
  if (!fromText) {
    return false;
  }

  const textParsed = parseSalary(fromText.raw, { unitHint: fromText.unitHint });
  return typeof textParsed.min === 'number';
}
