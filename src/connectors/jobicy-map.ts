import { stripHtml } from '@/connectors/html';
import type { RawJobListing } from '@/types/job';

/** Technology industries kept after a geo=latam pull (client-side; API industry slugs are incomplete). */
const TECH_INDUSTRIES = new Set([
  'Software Engineering',
  'DevOps & Infrastructure',
  'Product & Operations',
  'QA & Testing',
  'Data Science & Analytics',
  'Technical Support',
  'Cybersecurity',
]);

export type JobicyJobPayload = {
  id: number | string;
  url: string;
  jobTitle: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  // Legacy field names seen in older docs / cached payloads.
  annualSalaryMin?: number | null;
  annualSalaryMax?: number | null;
};

function normalizeLocation(geo: string | undefined): string {
  const cleaned = (geo ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || 'Anywhere';
}

function salaryBounds(job: JobicyJobPayload): { min?: number; max?: number } {
  const min = job.salaryMin ?? job.annualSalaryMin;
  const max = job.salaryMax ?? job.annualSalaryMax;
  return {
    min: typeof min === 'number' ? min : undefined,
    max: typeof max === 'number' ? max : undefined,
  };
}

function formatSalaryText(job: JobicyJobPayload): string | undefined {
  const currency = job.salaryCurrency?.trim();
  if (!currency) return undefined;

  const { min, max } = salaryBounds(job);
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined) return `${currency} ${min} - ${max}`;
  return `${currency} ${min ?? max}`;
}

function salaryUnitHint(
  job: JobicyJobPayload,
): RawJobListing['salaryUnitHint'] | undefined {
  const period = job.salaryPeriod?.trim().toLowerCase();
  if (!period) return undefined;
  if (period === 'yearly' || period === 'year' || period === 'annual') return 'year';
  if (period === 'monthly' || period === 'month') return 'month';
  if (period === 'hourly' || period === 'hour') return 'hour';
  return undefined;
}

function isTechJob(job: JobicyJobPayload): boolean {
  const industries = job.jobIndustry ?? [];
  if (industries.length === 0) return false;
  return industries.some((industry) => TECH_INDUSTRIES.has(industry));
}

export function mapJobicyJob(job: JobicyJobPayload): RawJobListing | null {
  const company = job.companyName?.trim();
  if (!company) return null;
  if (!isTechJob(job)) return null;

  const salaryText = formatSalaryText(job);
  const unitHint = salaryUnitHint(job);

  return {
    source: 'Jobicy',
    externalId: String(job.id),
    title: job.jobTitle,
    company,
    url: job.url,
    sourceUrl: job.url,
    location: normalizeLocation(job.jobGeo),
    salaryText,
    ...(unitHint ? { salaryUnitHint: unitHint } : {}),
    description: stripHtml(`${job.jobExcerpt || ''} ${job.jobDescription || ''}`),
    publishedAt: job.pubDate,
  };
}
