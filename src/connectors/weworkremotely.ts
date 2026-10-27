import { JobConnector } from './base';
import { stripHtml } from './html';
import { RawJobListing } from '../types/job';

export class WeWorkRemotelyConnector implements JobConnector {
  readonly name = 'WeWorkRemotely';
  private endpoint = 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss';

  async fetchJobs(): Promise<RawJobListing[]> {
    try {
      const resp = await fetch(this.endpoint, {
        headers: { 'User-Agent': 'Vektor-Career-Engine/0.1.0' }
      });
      if (!resp.ok) {
        throw new Error(`WWR RSS responded with status ${resp.status}`);
      }
      const xml = await resp.text();
      return this.parseRss(xml);
    } catch (err) {
      console.error(`[${this.name}] Fetch failed:`, err);
      return [];
    }
  }

  private parseRss(xml: string): RawJobListing[] {
    const items: RawJobListing[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      const title = this.extractTag(itemContent, 'title');
      const link = this.extractTag(itemContent, 'link');
      const description = stripHtml(this.extractTag(itemContent, 'description'));
      const pubDate = this.extractTag(itemContent, 'pubDate');

      if (title && link) {
        items.push({
          source: this.name,
          externalId: String(Math.abs(this.hash(link))),
          title,
          company: 'WeWorkRemotely Partner',
          url: link,
          location: 'Worldwide / Remote',
          salaryText: 'See listing',
          description,
          publishedAt: pubDate
        });
      }
    }
    return items;
  }

  private extractTag(content: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = regex.exec(content);
    return match ? (match[1] || match[2] || '').trim() : '';
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
