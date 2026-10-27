import { JobConnector } from './base';
import { mapJobicyJob, type JobicyJobPayload } from './jobicy-map';
import { RawJobListing } from '../types/job';

export { mapJobicyJob, type JobicyJobPayload } from './jobicy-map';

type JobicyResponse = {
  jobs?: JobicyJobPayload[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

export class JobicyConnector implements JobConnector {
  readonly name = 'Jobicy';
  // Canonical feed: geo=latam keeps Brazil / LATAM / Anywhere; industry is widened client-side.
  private readonly baseUrl = 'https://jobicy.com/api/jobs';
  // Jobicy asks for ~1 call/hour — cap pages so a single collect stays a light crawl.
  private readonly maxPages = 3;

  async fetchJobs(): Promise<RawJobListing[]> {
    try {
      const rawJobs = await this.fetchAllPages();
      const listings: RawJobListing[] = [];
      for (const job of rawJobs) {
        const mapped = mapJobicyJob(job);
        if (mapped) listings.push(mapped);
      }
      return listings;
    } catch (err) {
      console.error(`[${this.name}] Fetch failed:`, err);
      return [];
    }
  }

  private async fetchAllPages(): Promise<JobicyJobPayload[]> {
    const all: JobicyJobPayload[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < this.maxPages; page++) {
      const url = new URL(this.baseUrl);
      url.searchParams.set('count', '200');
      url.searchParams.set('geo', 'latam');
      if (cursor) url.searchParams.set('cursor', cursor);

      const resp = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' },
      });
      if (!resp.ok) {
        throw new Error(`Jobicy API responded with status ${resp.status}`);
      }

      const data = (await resp.json()) as JobicyResponse;
      const jobs = data.jobs ?? [];
      all.push(...jobs);

      if (!data.hasMore || !data.nextCursor) break;
      cursor = data.nextCursor;
    }

    return all;
  }
}
