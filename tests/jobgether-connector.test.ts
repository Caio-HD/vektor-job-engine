import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapJobgetherJob, type JobgetherJobPayload } from '@/connectors/jobgether-map';

const fixtureWithPay: JobgetherJobPayload = {
  id: '6ad8daa1a8fae18ba2d9f5d1',
  title: 'Client Service Specialist',
  company: 'RemotelyHR',
  url: 'https://jobgether.com/offer/6ad8daa1a8fae18ba2d9f5d1-client-service-specialist',
  location:
    'South America, North America, Central America, Latin America, Brazil, El Salvador, Guatemala, Honduras, Nicaragua, Costa Rica, Colombia, Panama, Argentina, Mexico',
  remote: 'Full Remote',
  salaryRange: '15360-19200 USD',
  postedAt: '2026-10-21T15:30:41.522Z',
};

const fixtureWithoutPay: JobgetherJobPayload = {
  id: '6ad93d2da8fae18ba2dc14a6',
  title: 'Partner success Manager',
  company: 'Cynet Security',
  url: 'https://jobgether.com/offer/6ad93d2da8fae18ba2dc14a6-partner-success-manager',
  location: 'South America, Latin America, Brazil, Colombia, Argentina',
  remote: 'Full Remote',
  postedAt: '2026-10-21T22:31:09.555Z',
};

describe('mapJobgetherJob', () => {
  it('maps a live Jobgether payload with currency-bearing salary',
    () => {
      const mapped = mapJobgetherJob(fixtureWithPay);

      assert.equal(mapped.source, 'Jobgether');
      assert.equal(mapped.externalId, '6ad8daa1a8fae18ba2d9f5d1');
      assert.equal(mapped.title, 'Client Service Specialist');
      assert.equal(mapped.company, 'RemotelyHR');
      assert.equal(
        mapped.url,
        'https://jobgether.com/offer/6ad8daa1a8fae18ba2d9f5d1-client-service-specialist',
      );
      assert.equal(
        mapped.location,
        'Remote - South America, North America, Central America, Latin America, Brazil, El Salvador, Guatemala, Honduras, Nicaragua, Costa Rica, Colombia, Panama, Argentina, Mexico',
      );
      assert.equal(mapped.salaryText, 'USD 15360 - 19200');
      assert.match(mapped.salaryText ?? '', /USD/);
      assert.equal(mapped.salaryUnitHint, 'year');
      assert.equal(mapped.publishedAt, '2026-10-21T15:30:41.522Z');
    },
  );

  it('omits salaryText when the payload has no salary range', () => {
    const mapped = mapJobgetherJob(fixtureWithoutPay);

    assert.equal(mapped.source, 'Jobgether');
    assert.equal(mapped.externalId, '6ad93d2da8fae18ba2dc14a6');
    assert.equal(mapped.title, 'Partner success Manager');
    assert.equal(mapped.company, 'Cynet Security');
    assert.equal(
      mapped.url,
      'https://jobgether.com/offer/6ad93d2da8fae18ba2dc14a6-partner-success-manager',
    );
    assert.equal(
      mapped.location,
      'Remote - South America, Latin America, Brazil, Colombia, Argentina',
    );
    assert.equal(mapped.salaryText, undefined);
    assert.equal(mapped.salaryUnitHint, undefined);
  });
});
