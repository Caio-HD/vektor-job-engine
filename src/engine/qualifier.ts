import type { RawJobListing, QualifiedJob, IngestionFilterConfig, CareerTrack } from '@/types/job';
import { parseSalary } from '@/engine/salary';
import { extractSalaryFromText } from '@/engine/salary-text';
import {
  estimateFromCorpus,
  shouldDiscardByEstimate,
  type SalaryCorpus,
  type SalaryEstimate,
} from '@/engine/salary-estimate';
import { requiredYearsOfExperience } from '@/engine/experience';

const MAX_REQUIRED_YEARS = 4;
// Senior titles pass only when the posting explicitly asks for this many years or fewer.
const MAX_SENIOR_REQUIRED_YEARS = 3;
const SALARY_TO_CONFIRM = 'a confirmar';

const SENIORITY_ABOVE_TARGET = /\b(staff|principal|lead|head of|director|manager|vp|architect|chief|cto)\b/;
const SENIOR_TITLE = /\bsenior\b|\bs[eê]nior\b|\bsr\b\.?/;
const NON_DEVELOPMENT_ROLE =
  /\b(support|suporte|customer|solutions?|sales|vendas|designer|ux|graphic|devops|sre|site reliability|infrastructure|infra|platform engineer|security|seguran[cç]a|data|dados|scientist|machine learning|ml|ai engineer|qa|quality|tester|testing|mobile|ios|android|marketing|recruiter|operations|performance engineer|observability)\b/;
const OTHER_PRIMARY_STACK =
  /\b(go|golang|rust|php|laravel|java|ruby|rails|python|django|scala|elixir|kotlin|swift|flutter|vue|angular|shopify|wordpress|salesforce|sap|sage|netsuite|odoo|delphi|cobol)\b/;
// Paid-per-task model training work, not employment.
const TASK_BASED_GIG = /\bcoding tasks?\b|\bper task\b/;
const DEVELOPMENT_ROLE =
  /\b(developer|desenvolvedor|desenvolvedora|engineer|engenheiro|engenheira|programador|programadora|programmer|software|full[ -]?stack|front[ -]?end|back[ -]?end)\b/;
const TARGET_STACK = /\b(typescript|javascript|react|node(?:\.?js)?|next\.?js)\b|\.net\b|c#/;
const FULL_STACK_TITLE = /\bfull[ -]?stack\b/;
const BEYOND_LATAM_REGION =
  /\b(us|usa|united states|canada|north america|europe|european union|uk|united kingdom|emea|apac|asia|global|worldwide|anywhere)\b/;
const PORTUGUESE_MARKERS = [
  'desenvolvedor', 'desenvolvedora', 'analista', 'vaga', 'pleno', 'sênior', 'júnior',
  'requisitos', 'benefícios', 'atividades', 'experiência', 'conhecimento', 'você',
  'empresa', 'responsabilidades', 'diferenciais',
];

export type EvaluateOptions = {
  /** Observed salary corpus. When present, jobs without a real band may be
   * discarded solely when the TOP of the estimated band is below the floor. */
  corpus?: SalaryCorpus;
};

export type EvaluateResult = {
  job: QualifiedJob | null;
  estimate: SalaryEstimate | null;
};

export class QualificationEngine {
  private config: IngestionFilterConfig;

  constructor(config?: Partial<IngestionFilterConfig>) {
    this.config = {
      remoteOnly: true,
      minMonthlyUsd: 4000,
      minMonthlyBrl: 8000,
      excludedKeywords: [
        'on-site', 'onsite', 'hybrid', 'híbrido', 'presencial',
        'security clearance', 'us citizen only', 'must reside in the us',
        'tier 1', 'tier i', 'l1 support', 'estágio', 'internship'
      ],
      allowedTracks: ['FullStack'],
      ...config
    };
  }

  public getFloorConfig(): { minMonthlyUsd: number; minMonthlyBrl: number } {
    return {
      minMonthlyUsd: this.config.minMonthlyUsd,
      minMonthlyBrl: this.config.minMonthlyBrl,
    };
  }

  /**
   * Apply steps 1–3 (excluded keywords, location, track) and return the listings
   * that could still qualify. Used so page salary lookup only runs for candidates.
   */
  public selectPreQualified(listings: RawJobListing[]): RawJobListing[] {
    return listings.filter((raw) => this.resolvePreQualification(raw) !== null);
  }

  public evaluate(raw: RawJobListing, options?: EvaluateOptions): QualifiedJob | null {
    return this.evaluateWithEstimate(raw, options).job;
  }

  /**
   * Same as evaluate(), but also returns the corpus estimate (when computed) so
   * the collect pipeline can persist method/basis and shadow validation.
   * Works without a corpus — estimate stays null and the legacy floor rules apply.
   */
  public evaluateWithEstimate(
    raw: RawJobListing,
    options?: EvaluateOptions,
  ): EvaluateResult {
    const track = this.resolvePreQualification(raw);
    if (!track) {
      return { job: null, estimate: null };
    }

    // 5. Compensation extraction + floor enforcement
    const comp = this.parseCompensation(
      raw.salaryText,
      raw.salaryUnitHint,
      raw.description,
    );

    let estimate: SalaryEstimate | null = null;
    if (options?.corpus) {
      estimate = estimateFromCorpus(
        {
          title: raw.title,
          description: raw.description,
          company: raw.company,
        },
        options.corpus,
      );
    }

    const reasons = [`Matched track ${track}`, 'Passed all negative exclusion filters'];

    if (typeof comp.monthlyMin === 'number') {
      if (comp.currency === 'USD' && comp.monthlyMin < this.config.minMonthlyUsd) {
        return { job: null, estimate };
      }
      if (comp.currency === 'BRL' && comp.monthlyMin < this.config.minMonthlyBrl) {
        return { job: null, estimate };
      }
    } else {
      if (
        shouldDiscardByEstimate(estimate, {
          minMonthlyUsd: this.config.minMonthlyUsd,
          minMonthlyBrl: this.config.minMonthlyBrl,
        })
      ) {
        // No real band: discard ONLY when the TOP of the estimated band is below the floor.
        return { job: null, estimate };
      }
      // Brazilian postings without a salary almost always pay below the floor.
      if (this.isPortugueseListing(raw) || this.isBrazilOnlyScope(raw.location)) {
        return { job: null, estimate };
      }
      if (!comp.raw || comp.raw === 'Not specified') {
        comp.raw = SALARY_TO_CONFIRM;
      }
      reasons.push('Salário a confirmar');
    }

    return {
      job: {
        id: `vektor_${raw.source.toLowerCase()}_${raw.externalId}`,
        source: raw.source,
        title: raw.title,
        company: raw.company,
        url: raw.url,
        sourceUrl: raw.sourceUrl,
        location: raw.location,
        compensation: comp,
        track,
        matchScore: 0.85,
        reasons,
        collectedAt: new Date().toISOString(),
      },
      estimate,
    };
  }

  private resolvePreQualification(raw: RawJobListing): CareerTrack | null {
    const textBlob = `${raw.title} ${raw.description} ${raw.location}`.toLowerCase();

    // 1. Mandatory exclusion filters
    for (const forbidden of this.config.excludedKeywords) {
      if (textBlob.includes(forbidden.toLowerCase())) {
        return null;
      }
    }

    // 2. Location validation: must allow international/remote
    const isGlobalRemote = this.isLocationAcceptable(raw.location.toLowerCase());
    if (!isGlobalRemote) {
      return null;
    }

    // 3. Seniority: titles above the target level and postings asking for too many years
    const title = raw.title.toLowerCase();
    if (SENIORITY_ABOVE_TARGET.test(title)) {
      return null;
    }
    if (TASK_BASED_GIG.test(`${title} ${raw.salaryText ?? ''}`.toLowerCase())) {
      return null;
    }
    const requiredYears = requiredYearsOfExperience(`${raw.title}\n${raw.description}`);
    if (requiredYears !== null && requiredYears > MAX_REQUIRED_YEARS) {
      return null;
    }
    if (SENIOR_TITLE.test(title) && (requiredYears === null || requiredYears > MAX_SENIOR_REQUIRED_YEARS)) {
      return null;
    }

    // 4. Track matching
    const track = this.resolveTrack(title, raw.description.toLowerCase());
    if (!track || !this.config.allowedTracks.includes(track)) {
      return null;
    }

    return track;
  }

  private isBrazilOnlyScope(location: string): boolean {
    const loc = location.toLowerCase();
    return /\b(brazil|brasil)\b/.test(loc) && !BEYOND_LATAM_REGION.test(loc);
  }

  private isPortugueseListing(raw: RawJobListing): boolean {
    const sample = `${raw.title} ${raw.description.slice(0, 600)}`.toLowerCase();
    const hits = PORTUGUESE_MARKERS.filter((marker) => sample.includes(marker));
    return hits.length >= 2;
  }

  private isLocationAcceptable(loc: string): boolean {
    if (!loc) return true;
    const allowedPatterns = ['worldwide', 'remote', 'anywhere', 'latam', 'latin america', 'brazil', 'brasil', 'global', 'americas'];
    const blockedPatterns = ['us only', 'usa only', 'uk only', 'canada only', 'europe only'];
    const restrictedRegion = /\b(us|usa|united states|canada|uk|united kingdom|europe|emea|apac|australia|india)\b/;
    const openRegion = /\b(latam|latin america|americas|brazil|brasil|worldwide|anywhere|global|international)\b/;

    if (blockedPatterns.some(b => loc.includes(b))) return false;
    if (restrictedRegion.test(loc) && !openRegion.test(loc)) return false;
    return allowedPatterns.some(a => loc.includes(a));
  }

  /**
   * The role comes from the title; the description only confirms the stack
   * when the title is generic ("Software Engineer").
   */
  private resolveTrack(title: string, description: string): CareerTrack | null {
    if (!DEVELOPMENT_ROLE.test(title) || NON_DEVELOPMENT_ROLE.test(title)) {
      return null;
    }
    const titleNamesTargetStack = TARGET_STACK.test(title);
    if (OTHER_PRIMARY_STACK.test(title) && !titleNamesTargetStack) {
      return null;
    }
    if (titleNamesTargetStack || FULL_STACK_TITLE.test(title) || TARGET_STACK.test(description)) {
      return 'FullStack';
    }
    return null;
  }

  private parseCompensation(
    raw: string | undefined,
    unitHint?: RawJobListing['salaryUnitHint'],
    description?: string,
  ): QualifiedJob['compensation'] {
    const parsed = parseSalary(raw, unitHint ? { unitHint } : undefined);

    // Prefer the listing salary when it already yields a usable minimum.
    if (typeof parsed.min === 'number') {
      return this.toCompensation(parsed.raw || 'Not specified', parsed);
    }

    // Fall back to a numeric band found in the announcement body.
    const fromText = extractSalaryFromText(description);
    if (fromText) {
      const textParsed = parseSalary(fromText.raw, { unitHint: fromText.unitHint });
      if (typeof textParsed.min === 'number') {
        return this.toCompensation(`anuncio: ${textParsed.raw}`, textParsed);
      }
    }

    return this.toCompensation(parsed.raw || 'Not specified', parsed);
  }

  private toCompensation(
    displayRaw: string,
    parsed: ReturnType<typeof parseSalary>,
  ): QualifiedJob['compensation'] {
    return {
      raw: displayRaw,
      currency: parsed.currency,
      min: parsed.min,
      max: parsed.max,
      monthlyMin: parsed.monthlyMin,
      monthlyMax: parsed.monthlyMax,
      unit: parsed.unit,
    };
  }
}
