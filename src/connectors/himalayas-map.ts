import { stripHtml } from '@/connectors/html';
import type { RawJobListing } from '@/types/job';

export type HimalayasJobPayload = {
  title: string;
  companyName?: string;
  applicationLink?: string;
  guid?: string;
  locationRestrictions?: string[] | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  salaryPeriod?: string | null;
  description?: string | null;
  pubDate?: number | null;
};

export const HIMALAYAS_SOURCE = 'Himalayas';

function mapSalaryUnitHint(
  period: string | null | undefined,
): RawJobListing['salaryUnitHint'] | undefined {
  if (!period) return undefined;
  const normalized = period.trim().toLowerCase();
  if (
    normalized === 'year' ||
    normalized === 'yearly' ||
    normalized === 'annual' ||
    normalized === 'annually'
  ) {
    return 'year';
  }
  if (normalized === 'month' || normalized === 'monthly') {
    return 'month';
  }
  if (normalized === 'hour' || normalized === 'hourly') {
    return 'hour';
  }
  return undefined;
}

function mapSalaryText(job: HimalayasJobPayload): string | undefined {
  const currency = job.currency?.trim();
  if (!currency) return undefined;

  const min = typeof job.minSalary === 'number' ? job.minSalary : undefined;
  const max = typeof job.maxSalary === 'number' ? job.maxSalary : undefined;
  if (min === undefined && max === undefined) return undefined;

  if (min !== undefined && max !== undefined) {
    return `${currency} ${min} - ${max}`;
  }
  return `${currency} ${min ?? max}`;
}

function mapLocation(restrictions: string[] | null | undefined): string {
  const parts = (restrictions ?? []).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Worldwide';
}

function canonicalJobUrl(job: HimalayasJobPayload): string | undefined {
  const guid = job.guid?.trim();
  if (guid) return guid;

  const application = job.applicationLink?.trim();
  if (!application) return undefined;
  try {
    const url = new URL(application);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return application.split('?')[0];
  }
}

export function mapHimalayasJob(job: HimalayasJobPayload): RawJobListing | null {
  const company = job.companyName?.trim() ?? '';
  if (!company) return null;

  const sourceUrl = canonicalJobUrl(job);
  const applyUrl = job.applicationLink?.trim() || sourceUrl;
  if (!applyUrl || !sourceUrl) return null;

  const salaryText = mapSalaryText(job);
  const salaryUnitHint = mapSalaryUnitHint(job.salaryPeriod);

  return {
    source: HIMALAYAS_SOURCE,
    externalId: job.guid?.trim() || sourceUrl,
    title: job.title,
    company,
    url: applyUrl,
    sourceUrl,
    location: mapLocation(job.locationRestrictions),
    salaryText,
    salaryUnitHint: salaryText ? salaryUnitHint : undefined,
    description: stripHtml(job.description ?? ''),
    publishedAt:
      typeof job.pubDate === 'number' ? new Date(job.pubDate * 1000).toISOString() : undefined,
  };
}
