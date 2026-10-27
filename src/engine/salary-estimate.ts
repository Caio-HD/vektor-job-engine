import type { QualifiedJob } from '@/types/job';

/**
 * Deterministic job-family / seniority classifier and corpus-based salary estimator.
 *
 * Numbers come ONLY from the system's own observed corpus (qualifying jobs that
 * already carry a real monthly band). The classifier uses keyword rules — never
 * a model call — so estimates are reproducible and free. When there are not
 * enough observations, there is no estimate and the job is not discarded.
 */

export type JobFamily =
  | 'fullstack'
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'data'
  | 'ai'
  | 'mobile'
  | 'qa'
  | 'other';

export type JobSeniority = 'junior' | 'pleno' | 'senior' | 'lead' | 'unknown';

export type EstimateMethod = 'empresa' | 'grupo';

export type SalaryBandStats = {
  count: number;
  monthlyMin: number;
  monthlyMax: number;
  currency: 'USD' | 'BRL';
};

export type SalaryCorpus = {
  byCompany: Map<string, SalaryBandStats>;
  byGroup: Map<string, SalaryBandStats>;
};

export type ClassifiableJob = {
  title: string;
  description?: string;
  company: string;
};

export type SalaryEstimate = {
  monthlyMin: number;
  monthlyMax: number;
  currency: 'USD' | 'BRL';
  method: EstimateMethod;
  observationCount: number;
  basis: string;
  family: JobFamily;
  seniority: JobSeniority;
};

export type EstimateFloorConfig = {
  minMonthlyUsd: number;
  minMonthlyBrl: number;
};

export type ShadowComparison = {
  jobId: string;
  realMonthlyMid: number;
  estimatedMonthlyMid: number;
  relativeError: number;
  estimate: SalaryEstimate;
};

export type EstimateAccuracy = {
  comparedCount: number;
  meanRelativeError: number | null;
};

/** Minimum observations before a family+seniority group band is usable. */
export const MIN_GROUP_OBSERVATIONS = 3;

/** Minimum observations before a company gets its own preferred band. */
export const MIN_COMPANY_OBSERVATIONS = 2;

/**
 * Classification rules (family) — first match wins, most specific first:
 *   ai       → ai, artificial intelligence, machine learning, ml engineer, llm,
 *              deep learning, nlp, computer vision, genai, generative ai
 *   devops   → devops, sre, site reliability, platform engineer, infrastructure,
 *              kubernetes, cloud engineer, platform ops
 *   data     → data engineer, data scientist, data analyst, analytics engineer,
 *              etl, warehouse, snowflake, databricks
 *   qa       → qa, quality assurance, test engineer, sdet, automation test,
 *              quality engineer
 *   mobile   → mobile, ios, android, react native, flutter, kotlin multiplatform
 *   fullstack→ full stack, fullstack, full-stack
 *   frontend → frontend, front-end, front end, ui engineer, react developer,
 *              vue, angular, next.js developer
 *   backend  → backend, back-end, back end, api engineer, java engineer,
 *              golang, go engineer, python engineer, .net engineer, node engineer
 *   other    → fallback when nothing matches
 */
const FAMILY_RULES: Array<{ family: JobFamily; patterns: RegExp[] }> = [
  {
    family: 'ai',
    patterns: [
      /\bartificial\s+intelligence\b/i,
      /\bmachine\s+learning\b/i,
      /\bml\s+engineer\b/i,
      /\bdeep\s+learning\b/i,
      /\bcomputer\s+vision\b/i,
      /\bgenerative\s+ai\b/i,
      /\bgenai\b/i,
      /\bllm\b/i,
      /\bnlp\b/i,
      /\bai\b/i,
    ],
  },
  {
    family: 'devops',
    patterns: [
      /\bdevops\b/i,
      /\bsite\s+reliability\b/i,
      /\bsre\b/i,
      /\bplatform\s+engineer\b/i,
      /\bplatform\s+ops\b/i,
      /\binfrastructure\b/i,
      /\bkubernetes\b/i,
      /\bcloud\s+engineer\b/i,
    ],
  },
  {
    family: 'data',
    patterns: [
      /\bdata\s+engineer\b/i,
      /\bdata\s+scientist\b/i,
      /\bdata\s+analyst\b/i,
      /\banalytics\s+engineer\b/i,
      /\betl\b/i,
      /\bdata\s+warehouse\b/i,
      /\bsnowflake\b/i,
      /\bdatabricks\b/i,
    ],
  },
  {
    family: 'qa',
    patterns: [
      /\bquality\s+assurance\b/i,
      /\btest\s+engineer\b/i,
      /\bautomation\s+test\b/i,
      /\bquality\s+engineer\b/i,
      /\bsdet\b/i,
      /\bqa\b/i,
    ],
  },
  {
    family: 'mobile',
    patterns: [
      /\breact\s+native\b/i,
      /\bkotlin\s+multiplatform\b/i,
      /\bmobile\b/i,
      /\bios\b/i,
      /\bandroid\b/i,
      /\bflutter\b/i,
    ],
  },
  {
    family: 'fullstack',
    patterns: [/\bfull[\s-]?stack\b/i],
  },
  {
    family: 'frontend',
    patterns: [
      /\bfront[\s-]?end\b/i,
      /\bui\s+engineer\b/i,
      /\breact\s+developer\b/i,
      /\bnext\.?js\s+developer\b/i,
      /\bvue\b/i,
      /\bangular\b/i,
    ],
  },
  {
    family: 'backend',
    patterns: [
      /\bback[\s-]?end\b/i,
      /\bapi\s+engineer\b/i,
      /\bjava\s+engineer\b/i,
      /\bgolang\b/i,
      /\bgo\s+engineer\b/i,
      /\bpython\s+engineer\b/i,
      /\.net\s+engineer\b/i,
      /\bnode\s+engineer\b/i,
    ],
  },
];

/**
 * Classification rules (seniority) — first match wins:
 *   lead   → lead, principal, staff, head of, director, engineering manager
 *   senior → senior, sr., sr
 *   junior → junior, jr., jr, entry level, entry-level, graduate
 *   pleno  → mid-level, mid level, midlevel, pleno, intermediate
 *   unknown→ fallback
 */
const SENIORITY_RULES: Array<{ seniority: JobSeniority; patterns: RegExp[] }> = [
  {
    seniority: 'lead',
    patterns: [
      /\blead\b/i,
      /\bprincipal\b/i,
      /\bstaff\b/i,
      /\bhead\s+of\b/i,
      /\bdirector\b/i,
      /\bengineering\s+manager\b/i,
    ],
  },
  {
    seniority: 'senior',
    patterns: [/\bsenior\b/i, /\bsr\./i, /\bsr\b/i],
  },
  {
    seniority: 'junior',
    patterns: [
      /\bjunior\b/i,
      /\bjr\./i,
      /\bjr\b/i,
      /\bentry[\s-]?level\b/i,
      /\bgraduate\b/i,
    ],
  },
  {
    seniority: 'pleno',
    patterns: [
      /\bmid[\s-]?level\b/i,
      /\bmidlevel\b/i,
      /\bpleno\b/i,
      /\bintermediate\b/i,
    ],
  },
];

export function classifyFamily(title: string, description = ''): JobFamily {
  const blob = `${title}\n${description}`;
  for (const rule of FAMILY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(blob))) {
      return rule.family;
    }
  }
  return 'other';
}

export function classifySeniority(title: string, description = ''): JobSeniority {
  // Prefer the title: description noise often mentions "senior stakeholders".
  for (const rule of SENIORITY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(title))) {
      return rule.seniority;
    }
  }
  for (const rule of SENIORITY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(description))) {
      return rule.seniority;
    }
  }
  return 'unknown';
}

export function groupKey(family: JobFamily, seniority: JobSeniority): string {
  return `${family}|${seniority}`;
}

export function normalizeCompany(company: string): string {
  return company.trim().toLowerCase();
}

function hasUsableMonthlyBand(
  job: QualifiedJob,
): job is QualifiedJob & {
  compensation: QualifiedJob['compensation'] & {
    monthlyMin: number;
    currency: 'USD' | 'BRL';
  };
} {
  const { monthlyMin, currency } = job.compensation;
  return (
    typeof monthlyMin === 'number' &&
    Number.isFinite(monthlyMin) &&
    (currency === 'USD' || currency === 'BRL')
  );
}

function bandCeiling(job: QualifiedJob): number {
  const { monthlyMin, monthlyMax } = job.compensation;
  if (typeof monthlyMax === 'number' && Number.isFinite(monthlyMax)) {
    return monthlyMax;
  }
  return monthlyMin as number;
}

function absorbObservation(
  map: Map<string, SalaryBandStats>,
  key: string,
  monthlyMin: number,
  monthlyMax: number,
  currency: 'USD' | 'BRL',
): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { count: 1, monthlyMin, monthlyMax, currency });
    return;
  }
  // Prefer the dominant currency already stored; skip mismatches.
  if (existing.currency !== currency) {
    return;
  }
  existing.count += 1;
  existing.monthlyMin = Math.min(existing.monthlyMin, monthlyMin);
  existing.monthlyMax = Math.max(existing.monthlyMax, monthlyMax);
}

/**
 * Build an observation corpus from qualifying jobs that already have a real
 * monthly band. Company bands and family+seniority group bands are both kept;
 * callers enforce the minimum-observation thresholds at estimate time.
 */
export function buildCorpus(jobs: QualifiedJob[]): SalaryCorpus {
  const byCompany = new Map<string, SalaryBandStats>();
  const byGroup = new Map<string, SalaryBandStats>();

  for (const job of jobs) {
    if (!hasUsableMonthlyBand(job)) {
      continue;
    }
    const monthlyMin = job.compensation.monthlyMin;
    const monthlyMax = bandCeiling(job);
    const currency = job.compensation.currency;
    const family = classifyFamily(job.title, '');
    const seniority = classifySeniority(job.title, '');
    absorbObservation(
      byCompany,
      normalizeCompany(job.company),
      monthlyMin,
      monthlyMax,
      currency,
    );
    absorbObservation(
      byGroup,
      groupKey(family, seniority),
      monthlyMin,
      monthlyMax,
      currency,
    );
  }

  return { byCompany, byGroup };
}

function usableBand(
  stats: SalaryBandStats | undefined,
  minCount: number,
): SalaryBandStats | null {
  if (!stats || stats.count < minCount) {
    return null;
  }
  return stats;
}

/**
 * Pure estimator: company band (≥2 obs) wins over family+seniority group
 * band (≥3 obs). Otherwise returns null — never invents amounts.
 */
export function estimateFromCorpus(
  job: ClassifiableJob,
  corpus: SalaryCorpus,
): SalaryEstimate | null {
  const family = classifyFamily(job.title, job.description ?? '');
  const seniority = classifySeniority(job.title, job.description ?? '');
  const companyKey = normalizeCompany(job.company);

  const companyBand = usableBand(
    corpus.byCompany.get(companyKey),
    MIN_COMPANY_OBSERVATIONS,
  );
  if (companyBand) {
    return {
      monthlyMin: companyBand.monthlyMin,
      monthlyMax: companyBand.monthlyMax,
      currency: companyBand.currency,
      method: 'empresa',
      observationCount: companyBand.count,
      basis: `company band for ${job.company.trim()} (${companyBand.count} observed jobs)`,
      family,
      seniority,
    };
  }

  const key = groupKey(family, seniority);
  const groupBand = usableBand(corpus.byGroup.get(key), MIN_GROUP_OBSERVATIONS);
  if (groupBand) {
    return {
      monthlyMin: groupBand.monthlyMin,
      monthlyMax: groupBand.monthlyMax,
      currency: groupBand.currency,
      method: 'grupo',
      observationCount: groupBand.count,
      basis: `group band for ${family}/${seniority} (${groupBand.count} observed jobs)`,
      family,
      seniority,
    };
  }

  return null;
}

/**
 * Discard rule (single place):
 * - No estimate → never discard.
 * - With estimate → discard ONLY when the TOP of the estimated band is below
 *   the floor for its currency. A wide band whose top clears the floor survives.
 */
export function shouldDiscardByEstimate(
  estimate: SalaryEstimate | null,
  floors: EstimateFloorConfig,
): boolean {
  if (!estimate) {
    return false;
  }
  const floor =
    estimate.currency === 'BRL' ? floors.minMonthlyBrl : floors.minMonthlyUsd;
  return estimate.monthlyMax < floor;
}

export function monthlyMid(min: number, max: number): number {
  return (min + max) / 2;
}

/** Relative error of an estimate against a real monthly mid-point. */
export function relativeError(
  estimatedMid: number,
  realMid: number,
): number | null {
  if (!Number.isFinite(estimatedMid) || !Number.isFinite(realMid) || realMid === 0) {
    return null;
  }
  return Math.abs(estimatedMid - realMid) / Math.abs(realMid);
}

/**
 * Shadow validation: for jobs that carry a real band, estimate anyway and
 * measure relative error. Jobs without a usable estimate are skipped.
 */
export function compareEstimatesToReal(
  jobs: QualifiedJob[],
  corpus: SalaryCorpus,
): ShadowComparison[] {
  const comparisons: ShadowComparison[] = [];

  for (const job of jobs) {
    if (!hasUsableMonthlyBand(job)) {
      continue;
    }
    const estimate = estimateFromCorpus(
      { title: job.title, description: '', company: job.company },
      corpus,
    );
    if (!estimate) {
      continue;
    }

    const realMid = monthlyMid(job.compensation.monthlyMin, bandCeiling(job));
    const estimatedMid = monthlyMid(estimate.monthlyMin, estimate.monthlyMax);
    const error = relativeError(estimatedMid, realMid);
    if (error === null) {
      continue;
    }

    comparisons.push({
      jobId: job.id,
      realMonthlyMid: realMid,
      estimatedMonthlyMid: estimatedMid,
      relativeError: error,
      estimate,
    });
  }

  return comparisons;
}

export function summarizeAccuracy(
  comparisons: Array<Pick<ShadowComparison, 'relativeError'>>,
): EstimateAccuracy {
  if (comparisons.length === 0) {
    return { comparedCount: 0, meanRelativeError: null };
  }
  const sum = comparisons.reduce((acc, row) => acc + row.relativeError, 0);
  return {
    comparedCount: comparisons.length,
    meanRelativeError: sum / comparisons.length,
  };
}
