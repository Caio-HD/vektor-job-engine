import { JobConnector } from './base';
import { RawJobListing } from '../types/job';

interface RemoteOkJob {
  id?: string;
  position?: string;
  company?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  url?: string;
  tags?: string[];
  date?: string;
}

export class RemoteOkConnector implements JobConnector {
  readonly name = 'RemoteOK';
  private endpoint = 'https://remoteok.com/api';

  async fetchJobs(): Promise<RawJobListing[]> {
    try {
      const resp = await fetch(this.endpoint, {
        headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' }
      });
      if (!resp.ok) {
        throw new Error(`RemoteOK API responded with status ${resp.status}`);
      }
      const data = (await resp.json()) as RemoteOkJob[];
      // RemoteOK includes legal notice as the first item
      const listings = Array.isArray(data) ? data.slice(1) : [];

      return listings
        .filter(j => j.position && j.url)
        .map(j => {
          const salary = j.salary_min && j.salary_max
            ? `$${j.salary_min} - $${j.salary_max}`
            : 'Not specified';

          return {
            source: this.name,
            externalId: String(j.id || Math.abs(this.hash(j.url || ''))),
            title: j.position || '',
            company: j.company || 'Unknown',
            url: j.url || '',
            location: j.location || 'Worldwide',
            salaryText: salary,
            description: this.cleanHtml(`${(j.tags || []).join(' ')} ${j.description || ''}`),
            publishedAt: j.date
          };
        });
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

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
