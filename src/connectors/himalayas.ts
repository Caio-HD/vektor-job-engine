import { JobConnector } from './base';
import {
  HIMALAYAS_SOURCE,
  mapHimalayasJob,
  type HimalayasJobPayload,
} from './himalayas-map';
import { RawJobListing } from '../types/job';

export {
  HIMALAYAS_SOURCE,
  mapHimalayasJob,
  type HimalayasJobPayload,
} from './himalayas-map';

type HimalayasResponse = {
  jobs?: HimalayasJobPayload[];
  nextCursor?: string | null;
};

const API_BASE = 'https://himalayas.app/jobs/api';
// Feed refreshes about once a day; deeper crawls buy nothing beyond a few pages.
const MAX_PAGES = 3;
const PAGE_LIMIT = 20;

export class HimalayasConnector implements JobConnector {
  readonly name = HIMALAYAS_SOURCE;

  async fetchJobs(): Promise<RawJobListing[]> {
    try {
      const jobs: HimalayasJobPayload[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const url = new URL(API_BASE);
        url.searchParams.set('limit', String(PAGE_LIMIT));
        if (cursor) url.searchParams.set('cursor', cursor);

        const resp = await fetch(url.toString(), {
          headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' },
        });
        if (!resp.ok) {
          throw new Error(`Himalayas API responded with status ${resp.status}`);
        }

        const data = (await resp.json()) as HimalayasResponse;
        const batch = data.jobs ?? [];
        jobs.push(...batch);

        const next = data.nextCursor?.trim();
        if (!next || batch.length === 0) break;
        cursor = next;
      }

      const seen = new Set<string>();
      const listings: RawJobListing[] = [];
      for (const job of jobs) {
        const mapped = mapHimalayasJob(job);
        if (!mapped || seen.has(mapped.externalId)) continue;
        seen.add(mapped.externalId);
        listings.push(mapped);
      }
      return listings;
    } catch (err) {
      console.error(`[${this.name}] Fetch failed:`, err);
      return [];
    }
  }
}
