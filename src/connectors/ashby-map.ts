import type { AshbyBoard } from '@/connectors/ashby-boards';
import type { RawJobListing } from '@/types/job';

export type AshbyJobPayload = {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: Array<string | { location?: string }>;
  publishedAt?: string;
  isRemote?: boolean;
  workplaceType?: string;
  address?: unknown;
  jobUrl: string;
  applyUrl: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  compensation?: {
    compensationTierSummary?: string | null;
    scrapeableCompensationSalarySummary?: string | null;
    compensationTiers?: unknown[];
    summaryComponents?: unknown[];
  } | null;
};

function secondaryLocationLabel(entry: string | { location?: string }): string | undefined {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed || undefined;
  }
  const trimmed = entry.location?.trim();
  return trimmed || undefined;
}

export function mapAshbyJob(job: AshbyJobPayload, board: AshbyBoard): RawJobListing {
  const primary = job.location?.trim() || '';
  const secondary = (job.secondaryLocations ?? [])
    .map(secondaryLocationLabel)
    .filter((value): value is string => Boolean(value));
  const locationParts = [primary, ...secondary].filter(Boolean);
  const salaryText = job.compensation?.scrapeableCompensationSalarySummary ?? undefined;

  return {
    source: 'ashby',
    externalId: job.id,
    title: job.title,
    company: board.company,
    url: job.applyUrl,
    sourceUrl: job.jobUrl,
    location: locationParts.length > 0 ? locationParts.join(', ') : 'Remote',
    salaryText: salaryText || undefined,
    salaryUnitHint: board.salaryUnitHint,
    description: job.descriptionPlain ?? '',
    publishedAt: job.publishedAt,
  };
}
