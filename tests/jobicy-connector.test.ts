import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapJobicyJob, type JobicyJobPayload } from '@/connectors/jobicy-map';

// Captured from https://jobicy.com/api/jobs?count=200&geo=latam (trimmed descriptions).
const fixtureWithPay: JobicyJobPayload = {
  id: 156026,
  url: 'https://jobicy.com/jobs/156026-senior-software-engineer-agents-2',
  jobTitle: 'Senior Software Engineer, Agents',
  companyName: 'RevenueCat',
  jobIndustry: ['Software Engineering'],
  jobType: ['Full-Time'],
  jobGeo: 'EMEA,  LATAM,  Canada,  USA',
  jobLevel: 'Senior',
  jobExcerpt:
    "RevenueCat gives app businesses the infrastructure and tools to build, run, and improve their monetization. Since graduating from YC's S18 batch, we've grown into the default monetization platform for mobile. We're in 50%+ of newly shipped ",
  jobDescription:
    '<p><a href="https://jobicy.com/company/revenuecat" target="_blank" rel="noopener">RevenueCat</a> gives app businesses the infrastructure and tools to build, run, and improve their monetization.</p>',
  pubDate: '2026-10-20T15:27:08+00:00',
  salaryMin: 230000,
  salaryMax: 230000,
  salaryCurrency: 'USD',
  salaryPeriod: 'yearly',
};

const fixtureWithoutPay: JobicyJobPayload = {
  id: 156242,
  url: 'https://jobicy.com/jobs/156242-functional-consultant-contact-center',
  jobTitle: 'Functional Consultant - Contact Center',
  companyName: 'Caylent',
  jobIndustry: ['Product & Operations'],
  jobType: ['Full-Time'],
  jobGeo: 'Brazil',
  jobLevel: 'Entry-Level, Junior',
  jobExcerpt:
    'Caylent is an AI-first cloud services company that helps organizations turn ambitious ideas into meaningful business impact.',
  jobDescription:
    '<p><a href="https://jobicy.com/company/caylent" target="_blank" rel="noopener">Caylent</a> is an AI-first cloud services company.</p>',
  pubDate: '2026-10-21T18:02:42+00:00',
};

const fixtureSalesDropped: JobicyJobPayload = {
  id: 999001,
  url: 'https://jobicy.com/jobs/999001-account-executive',
  jobTitle: 'Account Executive',
  companyName: 'Example Co',
  jobIndustry: ['Sales'],
  jobGeo: 'LATAM',
  jobExcerpt: 'Sell software.',
  jobDescription: '<p>Sell software.</p>',
};

describe('mapJobicyJob', () => {
  it('maps salary with currency space and keeps LATAM geography',
    () => {
      const mapped = mapJobicyJob(fixtureWithPay);

      assert.ok(mapped);
      assert.equal(mapped.source, 'Jobicy');
      assert.equal(mapped.externalId, '156026');
      assert.equal(mapped.company, 'RevenueCat');
      assert.equal(mapped.url, fixtureWithPay.url);
      assert.equal(mapped.sourceUrl, fixtureWithPay.url);
      assert.equal(mapped.location, 'EMEA, LATAM, Canada, USA');
      assert.match(mapped.location.toLowerCase(), /latam/);
      assert.equal(mapped.salaryText, 'USD 230000 - 230000');
      assert.match(mapped.salaryText!, /USD/);
      assert.equal(mapped.salaryUnitHint, 'year');
      assert.equal(mapped.title, 'Senior Software Engineer, Agents');
      assert.ok(!mapped.description.includes('<p>'));
    });

  it('omits salaryText when the payload has no disclosed salary',
    () => {
      const mapped = mapJobicyJob(fixtureWithoutPay);

      assert.ok(mapped);
      assert.equal(mapped.company, 'Caylent');
      assert.equal(mapped.location, 'Brazil');
      assert.match(mapped.location.toLowerCase(), /brazil/);
      assert.equal(mapped.salaryText, undefined);
      assert.equal(mapped.salaryUnitHint, undefined);
      assert.equal(mapped.externalId, '156242');
    });

  it('drops non-technology industries',
    () => {
      assert.equal(mapJobicyJob(fixtureSalesDropped), null);
    });
});
