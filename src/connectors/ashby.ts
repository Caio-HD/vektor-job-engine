import { JobConnector } from './base';
import { ASHBY_BOARDS, type AshbyBoard } from './ashby-boards';
import { mapAshbyJob, type AshbyJobPayload } from './ashby-map';
import { RawJobListing } from '../types/job';

export { mapAshbyJob, type AshbyJobPayload } from './ashby-map';

type AshbyBoardResponse = {
  jobs?: AshbyJobPayload[];
};

export class AshbyConnector implements JobConnector {
  readonly name = 'Ashby';
  private boards: readonly AshbyBoard[];

  constructor(boards: readonly AshbyBoard[] = ASHBY_BOARDS) {
    this.boards = boards;
  }

  async fetchJobs(): Promise<RawJobListing[]> {
    const all: RawJobListing[] = [];

    for (const board of this.boards) {
      try {
        const listings = await this.fetchBoard(board);
        all.push(...listings);
      } catch (err) {
        console.error(`[${this.name}] Board "${board.slug}" failed:`, err);
      }
    }

    return all;
  }

  private async fetchBoard(board: AshbyBoard): Promise<RawJobListing[]> {
    const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${board.slug}?includeCompensation=true`;
    const resp = await fetch(endpoint, {
      headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' },
    });
    if (!resp.ok) {
      throw new Error(`Ashby board "${board.slug}" responded with status ${resp.status}`);
    }
    const data = (await resp.json()) as AshbyBoardResponse;
    return (data.jobs ?? []).map((job) => mapAshbyJob(job, board));
  }
}
