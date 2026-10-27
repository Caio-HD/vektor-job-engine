import { JobConnector } from './base';
import { mapJobgetherJob, type JobgetherJobPayload } from './jobgether-map';
import { RawJobListing } from '../types/job';

export { mapJobgetherJob, type JobgetherJobPayload } from './jobgether-map';

type JobgetherResponse = {
  jobs?: JobgetherJobPayload[];
  pagination?: {
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
};

const MAX_PAGE = 10;
const PAGE_LIMIT = 25;
const GEO = 'brazil';

export class JobgetherConnector implements JobConnector {
  readonly name = 'Jobgether';

  async fetchJobs(): Promise<RawJobListing[]> {
    const all: RawJobListing[] = [];

    for (let page = 1; page <= MAX_PAGE; page += 1) {
      try {
        const { jobs, hasMore } = await this.fetchPage(page);
        all.push(...jobs);
        if (!hasMore) break;
      } catch (err) {
        console.error(`[${this.name}] Page ${page} failed:`, err);
        break;
      }
    }

    return all;
  }

  private async fetchPage(page: number): Promise<{ jobs: RawJobListing[]; hasMore: boolean }> {
    const endpoint =
      `https://jobgether.com/api/v1/jobs?page=${page}&limit=${PAGE_LIMIT}&locations=${GEO}`;
    const resp = await fetch(endpoint, {
      headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' },
    });
    if (!resp.ok) {
      throw new Error(`Jobgether responded with status ${resp.status}`);
    }

    const data = (await resp.json()) as JobgetherResponse;
    const jobs = (data.jobs ?? [])
      .filter((job) => Boolean(job?.id) && Boolean(job?.title) && Boolean((job.company ?? job.companyName ?? '').trim()))
      .map((job) => mapJobgetherJob(job));

    return {
      jobs,
      hasMore: Boolean(data.pagination?.hasMore),
    };
  }
}
