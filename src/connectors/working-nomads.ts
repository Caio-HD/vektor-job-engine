import { JobConnector } from './base.js';
import { RawJobListing } from '../types/job.js';

interface WorkingNomadsJob {
  url: string;
  title: string;
  description: string;
  company_name: string;
  category_name: string;
  tags: string;
  location: string;
  pub_date: string;
}

export class WorkingNomadsConnector implements JobConnector {
  readonly name = 'WorkingNomads';
  private endpoint = 'https://workingnomads.com/api/exposed_jobs/';

  async fetchJobs(): Promise<RawJobListing[]> {
    try {
      const resp = await fetch(this.endpoint, {
        headers: {
          'User-Agent': 'Vektor-Career-Engine/0.1.0',
          Accept: 'application/json'
        }
      });
      if (!resp.ok) {
        throw new Error(`WorkingNomads API responded with status ${resp.status}`);
      }

      const payload = (await resp.json()) as WorkingNomadsJob[] | { jobs?: WorkingNomadsJob[] };
      const jobs = Array.isArray(payload) ? payload : (payload.jobs || []);

      return jobs.map((job) => ({
        source: this.name,
        externalId: job.url ? job.url.split('/').pop() || job.url : job.title,
        title: job.title || '',
        company: job.company_name || '',
        url: job.url || '',
        location: job.location || 'Remote',
        salaryText: 'Not specified',
        description: this.cleanHtml(`${job.tags || ''} ${job.description || ''}`),
        publishedAt: job.pub_date
      }));
    } catch (err) {
      console.error(`[${this.name}] Fetch failed:`, err);
      return [];
    }
  }

  private cleanHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
