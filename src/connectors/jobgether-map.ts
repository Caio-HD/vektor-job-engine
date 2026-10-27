import { stripHtml } from '@/connectors/html';
import type { RawJobListing } from '@/types/job';

export type JobgetherJobPayload = {
  id: string;
  title: string;
  company?: string;
  companyName?: string;
  url?: string;
  jobUrl?: string;
  location?: string | string[];
  locations?: string | string[];
  remote?: string;
  salaryRange?: string | null;
  description?: string | null;
  postedAt?: string;
  publishedAt?: string;
};

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function locationList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((part) => part.trim()).filter(Boolean);
  }
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

function buildLocation(job: JobgetherJobPayload): string {
  const parts = [
    ...locationList(job.location),
    ...locationList(job.locations),
  ];
  const region = parts.join(', ');
  const remote = job.remote?.trim() || '';
  const isRemote = /remote/i.test(remote) || /remote/i.test(region);

  if (region && isRemote && !/remote/i.test(region)) {
    return `Remote - ${region}`;
  }
  if (region) return region;
  if (isRemote) return 'Remote';
  return 'Remote - Brazil';
}

function mapSalaryText(salaryRange: string | null | undefined): string | undefined {
  if (!salaryRange) return undefined;
  const raw = salaryRange.trim();
  if (!raw) return undefined;

  const trailingCurrency = raw.match(
    /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s+([A-Za-z]{3}|US\$|R\$|\$)$/i,
  );
  if (trailingCurrency) {
    const [, min, max, currency] = trailingCurrency;
    return `${currency.toUpperCase().replace('US$', 'USD')} ${min} - ${max}`;
  }

  const leadingCurrency = raw.match(
    /^([A-Za-z]{3}|US\$|R\$|\$)\s*(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/i,
  );
  if (leadingCurrency) {
    const [, currency, min, max] = leadingCurrency;
    return `${currency.toUpperCase().replace('US$', 'USD')} ${min} - ${max}`;
  }

  // Keep only currency-bearing salary strings; bare numbers are useless downstream.
  if (/[A-Za-z$]/.test(raw)) return raw;
  return undefined;
}

export function mapJobgetherJob(job: JobgetherJobPayload): RawJobListing {
  const company = (job.company ?? job.companyName ?? '').trim();
  const pageUrl = (job.url ?? job.jobUrl ?? '').trim();
  const salaryText = mapSalaryText(job.salaryRange);
  const publishedAt = job.publishedAt ?? job.postedAt;

  return {
    source: 'Jobgether',
    externalId: String(job.id),
    title: job.title,
    company,
    url: pageUrl,
    sourceUrl: pageUrl,
    location: buildLocation(job),
    salaryText,
    salaryUnitHint: salaryText ? 'year' : undefined,
    description: decodeEntities(stripHtml(job.description ?? '')),
    publishedAt,
  };
}
