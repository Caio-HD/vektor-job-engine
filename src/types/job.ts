export type CareerTrack = 'FullStack' | 'Solutions' | 'SupportL2';

export type EmploymentType = 'contractor' | 'full_time' | 'any';

export interface RawJobListing {
  source: string;
  externalId: string;
  title: string;
  company: string;
  url: string;
  sourceUrl?: string;
  location: string;
  salaryText?: string;
  salaryUnitHint?: 'year' | 'hour' | 'month';
  description: string;
  publishedAt?: string;
}

export interface QualifiedJob {
  id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  sourceUrl?: string;
  location: string;
  compensation: {
    raw: string;
    currency: 'USD' | 'BRL' | 'UNKNOWN';
    min?: number;
    max?: number;
    monthlyMin?: number;
    monthlyMax?: number;
    unit?: 'month' | 'hour' | 'year' | 'unknown';
  };
  track: CareerTrack;
  matchScore: number;
  reasons: string[];
  collectedAt: string;
}

export interface IngestionFilterConfig {
  remoteOnly: boolean;
  minMonthlyUsd: number;
  minMonthlyBrl: number;
  excludedKeywords: string[];
  allowedTracks: CareerTrack[];
}
