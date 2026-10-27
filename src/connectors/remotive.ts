import { JobConnector } from './base';
import { stripHtml } from './html';
import { RawJobListing } from '../types/job';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  candidate_required_location: string;
  salary: string;
  description: string;
  publication_date: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export class RemotiveConnector implements JobConnector {
  readonly name = 'Remotive';
  private endpoint = 'https://remotive.com/api/remote-jobs?category=software-dev&limit=40';

  async fetchJobs(): Promise<RawJobListing[]> {
    try {
      const resp = await fetch(this.endpoint, {
        headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' }
      });
      if (!resp.ok) {
        throw new Error(`Remotive API responded with status ${resp.status}`);
      }
      const data = (await resp.json()) as RemotiveResponse;
      return (data.jobs || []).map(j => ({
        source: this.name,
        externalId: String(j.id),
        title: j.title,
        company: j.company_name,
        url: j.url,
        location: j.candidate_required_location || 'Worldwide',
        salaryText: j.salary,
        description: stripHtml(j.description),
        publishedAt: j.publication_date
      }));
    } catch (err) {
      console.error(`[${this.name}] Fetch failed:`, err);
      return [];
    }
  }
}
