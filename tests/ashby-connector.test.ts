import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAshbyJob, type AshbyJobPayload } from '@/connectors/ashby-map';
import type { AshbyBoard } from '@/connectors/ashby-boards';

const board: AshbyBoard = {
  slug: 'miro',
  company: 'Miro',
  salaryUnitHint: 'year',
};

const fixtureWithPay: AshbyJobPayload = {
  id: 'job-with-pay',
  title: 'Senior Full Stack Engineer',
  location: 'Remote',
  secondaryLocations: ['Latin America', { location: 'Brazil' }],
  publishedAt: '2026-10-01T12:00:00.000Z',
  jobUrl: 'https://jobs.ashbyhq.com/miro/job-with-pay',
  applyUrl: 'https://jobs.ashbyhq.com/miro/job-with-pay/application',
  descriptionPlain: 'Build product with React and Node.',
  compensation: {
    compensationTierSummary: '$174K - $267.1K a year',
    scrapeableCompensationSalarySummary: '$174K - $267.1K',
  },
};

const fixtureWithoutPay: AshbyJobPayload = {
  id: 'job-no-pay',
  title: 'Solutions Engineer',
  location: 'Worldwide',
  publishedAt: '2026-10-02T12:00:00.000Z',
  jobUrl: 'https://jobs.ashbyhq.com/miro/job-no-pay',
  applyUrl: 'https://jobs.ashbyhq.com/miro/job-no-pay/application',
  descriptionPlain: 'Help customers integrate APIs.',
  compensation: {
    compensationTierSummary: 'Competitive',
    scrapeableCompensationSalarySummary: null,
  },
};

describe('mapAshbyJob', () => {
  it('maps apply and source links plus annual salary hint', () => {
    const mapped = mapAshbyJob(fixtureWithPay, board);

    assert.equal(mapped.title, 'Senior Full Stack Engineer');
    assert.equal(mapped.company, 'Miro');
    assert.equal(mapped.url, fixtureWithPay.applyUrl);
    assert.equal(mapped.sourceUrl, fixtureWithPay.jobUrl);
    assert.equal(mapped.location, 'Remote, Latin America, Brazil');
    assert.equal(mapped.salaryText, '$174K - $267.1K');
    assert.equal(mapped.salaryUnitHint, 'year');
    assert.equal(mapped.source, 'ashby');
    assert.equal(mapped.externalId, 'job-with-pay');
  });

  it('omits salaryText when scrapeable compensation is absent', () => {
    const mapped = mapAshbyJob(fixtureWithoutPay, board);

    assert.equal(mapped.title, 'Solutions Engineer');
    assert.equal(mapped.company, 'Miro');
    assert.equal(mapped.url, fixtureWithoutPay.applyUrl);
    assert.equal(mapped.sourceUrl, fixtureWithoutPay.jobUrl);
    assert.equal(mapped.location, 'Worldwide');
    assert.equal(mapped.salaryText, undefined);
    assert.equal(mapped.salaryUnitHint, 'year');
  });
});
