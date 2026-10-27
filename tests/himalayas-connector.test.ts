import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapHimalayasJob, type HimalayasJobPayload } from '@/connectors/himalayas-map';

// Captured live from https://himalayas.app/jobs/api/search?country=BR&sort=salaryDesc
const fixtureWorldwideWithPay: HimalayasJobPayload = {
  title: 'SaaS Co-Founder / CTO (100 % remote) (m/f/d)',
  companyName: 'EWOR GmbH',
  minSalary: 500000,
  maxSalary: 500000,
  salaryPeriod: 'annual',
  currency: 'EUR',
  locationRestrictions: [],
  description:
    '<p>We are looking to hire ambitious entrepreneurs to start and scale their own startups.</p><p>We are serial entrepreneurs, for example Paul Müller (founder Adjust, €1.2B exit) and Petter Made (founder SumUp, €8B) who are eager to support outlier personalities and serial entrepre',
  pubDate: 1792318544,
  applicationLink:
    'https://himalayas.app/companies/ewor-gmbh/jobs/saas-co-founder-cto-100-remote-m-f-d-5512248576?utm_source=api',
  guid: 'https://himalayas.app/companies/ewor-gmbh/jobs/saas-co-founder-cto-100-remote-m-f-d-5512248576',
};

// Captured live from https://himalayas.app/jobs/api?limit=20
const fixtureHourlyWithPay: HimalayasJobPayload = {
  title: 'Talent Acquisition Consultant (Contract)',
  companyName: 'Cologix, Inc.',
  minSalary: 40,
  maxSalary: 45,
  salaryPeriod: 'hourly',
  currency: 'CAD',
  locationRestrictions: ['Canada'],
  description:
    '<h3>About Our Company:</h3><div>Headquartered in Denver, Colorado, Cologix is a leading North America network-neutral interconnection and hyperscale edge data center company.</div>',
  pubDate: 1792638194,
  applicationLink:
    'https://himalayas.app/companies/cologix-inc/jobs/talent-acquisition-consultant-contract-8501299878?utm_source=api',
  guid: 'https://himalayas.app/companies/cologix-inc/jobs/talent-acquisition-consultant-contract-8501299878',
};

// Captured live from https://himalayas.app/jobs/api/search?country=BR&sort=salaryDesc
// currency present, amounts absent
const fixtureNoPayAmounts: HimalayasJobPayload = {
  title: 'Applied Scientist',
  companyName: 'micro1',
  minSalary: null,
  maxSalary: null,
  salaryPeriod: 'hourly',
  currency: 'USD',
  locationRestrictions: [],
  description: '<h3>Role Title: Applied Scientist</h3><p>Remote contractor role.</p>',
  pubDate: 1792113206,
  applicationLink: 'https://himalayas.app/companies/micro1/jobs/applied-scientist?utm_source=api',
  guid: 'https://himalayas.app/companies/micro1/jobs/applied-scientist',
};

describe('mapHimalayasJob', () => {
  it('maps distinct guids to distinct externalIds', () => {
    const a = mapHimalayasJob(fixtureWorldwideWithPay);
    const b = mapHimalayasJob(fixtureHourlyWithPay);

    assert.ok(a);
    assert.ok(b);
    assert.notEqual(a.externalId, b.externalId);
    assert.equal(
      a.externalId,
      'https://himalayas.app/companies/ewor-gmbh/jobs/saas-co-founder-cto-100-remote-m-f-d-5512248576',
    );
    assert.equal(
      b.externalId,
      'https://himalayas.app/companies/cologix-inc/jobs/talent-acquisition-consultant-contract-8501299878',
    );
  });

  it('builds currency-bearing salaryText and annual unit hint', () => {
    const mapped = mapHimalayasJob(fixtureWorldwideWithPay);

    assert.ok(mapped);
    assert.equal(mapped.source, 'Himalayas');
    assert.equal(mapped.company, 'EWOR GmbH');
    assert.equal(mapped.salaryText, 'EUR 500000 - 500000');
    assert.match(mapped.salaryText ?? '', /EUR/);
    assert.equal(mapped.salaryUnitHint, 'year');
    assert.match(mapped.location, /Worldwide/);
    assert.equal(
      mapped.sourceUrl,
      'https://himalayas.app/companies/ewor-gmbh/jobs/saas-co-founder-cto-100-remote-m-f-d-5512248576',
    );
    assert.equal(
      mapped.url,
      'https://himalayas.app/companies/ewor-gmbh/jobs/saas-co-founder-cto-100-remote-m-f-d-5512248576?utm_source=api',
    );
    assert.equal(mapped.description.includes('<p>'), false);
  });

  it('maps hourly salaryPeriod to hour hint', () => {
    const mapped = mapHimalayasJob(fixtureHourlyWithPay);

    assert.ok(mapped);
    assert.equal(mapped.salaryText, 'CAD 40 - 45');
    assert.equal(mapped.salaryUnitHint, 'hour');
    assert.equal(mapped.location, 'Canada');
  });

  it('omits salaryText when amounts are missing even if currency is set', () => {
    const mapped = mapHimalayasJob(fixtureNoPayAmounts);

    assert.ok(mapped);
    assert.equal(mapped.salaryText, undefined);
    assert.equal(mapped.salaryUnitHint, undefined);
    assert.match(mapped.location, /Worldwide/);
  });
});
