import { RawJobListing } from '../types/job';

export interface JobConnector {
  readonly name: string;
  fetchJobs(): Promise<RawJobListing[]>;
}
