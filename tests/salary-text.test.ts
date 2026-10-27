import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractSalaryFromText } from '@/engine/salary-text';
import { parseSalary } from '@/engine/salary';
import { QualificationEngine } from '@/engine/qualifier';
import type { RawJobListing } from '@/types/job';

function baseJob(overrides: Partial<RawJobListing> = {}): RawJobListing {
  return {
    source: 'Test',
    externalId: '1',
    title: 'Full Stack Engineer',
    company: 'Acme',
    url: 'https://example.com/job',
    location: 'Remote Worldwide',
    description: 'TypeScript React Node',
    ...overrides,
  };
}

describe('extractSalaryFromText formats', () => {
  it('extracts $160,000 as annual USD convention', () => {
    const extracted = extractSalaryFromText('Pay is $160,000 for this role.');
    assert.deepEqual(extracted, { raw: '$160,000', unitHint: 'year' });
  });

  it('extracts $160,000 to $200,000 range', () => {
    const extracted = extractSalaryFromText(
      'Compensation band: $160,000 to $200,000 depending on experience.',
    );
    assert.deepEqual(extracted, {
      raw: '$160,000 to $200,000',
      unitHint: 'year',
    });
  });

  it('extracts $160,000-$200,000 hyphen range', () => {
    const extracted = extractSalaryFromText('Salary $160,000-$200,000');
    assert.deepEqual(extracted, {
      raw: '$160,000-$200,000',
      unitHint: 'year',
    });
  });

  it('extracts USD 160,000', () => {
    const extracted = extractSalaryFromText('Offering USD 160,000');
    assert.deepEqual(extracted, { raw: 'USD 160,000', unitHint: 'year' });
  });

  it('extracts R$ 11.359,50 as monthly BRL convention', () => {
    const extracted = extractSalaryFromText('Remuneracao R$ 11.359,50');
    assert.deepEqual(extracted, { raw: 'R$ 11.359,50', unitHint: 'month' });
  });

  it('extracts 80.000 - 120.000 EUR as annual', () => {
    const extracted = extractSalaryFromText('Package 80.000 - 120.000 EUR');
    assert.deepEqual(extracted, {
      raw: '80.000 - 120.000 EUR',
      unitHint: 'year',
    });
  });

  it('extracts $150 - $200 USD per hour with hour hint from context', () => {
    const extracted = extractSalaryFromText(
      'Contract rate $150 - $200 USD per hour',
    );
    assert.ok(extracted);
    assert.equal(extracted.unitHint, 'hour');
    assert.match(extracted.raw, /\$150\s*-\s*\$200\s*USD/i);
  });

  it('uses per year context over currency convention', () => {
    const extracted = extractSalaryFromText(
      'We pay $90,000 per year plus equity',
    );
    assert.deepEqual(extracted, { raw: '$90,000', unitHint: 'year' });
  });

  it('uses per hour context for a single band', () => {
    const extracted = extractSalaryFromText('Rate of $175 USD per hour');
    assert.ok(extracted);
    assert.equal(extracted.unitHint, 'hour');
    assert.match(extracted.raw, /\$175\s*USD/i);
  });

  it('returns null for Compensation heading with no amount', () => {
    assert.equal(extractSalaryFromText('Compensation\nBenefits\nEquity'), null);
  });

  it('does not treat per task amounts as salary bands', () => {
    assert.equal(
      extractSalaryFromText('Paid $1000 per task after review'),
      null,
    );
  });

  it('skips a per-task band and keeps a later salary band', () => {
    const extracted = extractSalaryFromText(
      'Some gigs pay $1000 per task. Full-time salary $160,000 to $200,000.',
    );
    assert.deepEqual(extracted, {
      raw: '$160,000 to $200,000',
      unitHint: 'year',
    });
  });

  it('returns null for bare numbers without currency', () => {
    assert.equal(extractSalaryFromText('Budget around 160000 annually'), null);
  });
});

describe('parseSalary non-salary rates', () => {
  it('does not invent a monthly minimum for per task rates', () => {
    const parsed = parseSalary('$1000 per task');
    assert.equal(parsed.unit, 'unknown');
    assert.equal(parsed.min, undefined);
    assert.equal(parsed.monthlyMin, undefined);
  });

  it('still converts real hourly rates with x160', () => {
    const parsed = parseSalary('150 USD/h - 200 USD/h');
    assert.equal(parsed.unit, 'hour');
    assert.equal(parsed.monthlyMin, 24000);
    assert.equal(parsed.monthlyMax, 32000);
  });
});

describe('QualificationEngine announcement salary', () => {
  it('qualifies a listing using a band found in the description', () => {
    const engine = new QualificationEngine();
    const job = baseJob({
      salaryText: 'See listing',
      description:
        'Full stack TypeScript React Node. Salary $160,000 to $200,000.',
    });

    const result = engine.evaluate(job);

    assert.ok(result);
    assert.equal(result.compensation.raw, 'anuncio: $160,000 to $200,000');
    assert.equal(result.compensation.currency, 'USD');
    assert.equal(result.compensation.unit, 'year');
    assert.equal(result.compensation.min, 160000);
    assert.equal(result.compensation.max, 200000);
    assert.equal(result.compensation.monthlyMin, 160000 / 12);
  });

  it('never reads $1000 per task as a monthly salary, and rejects the gig', () => {
    const engine = new QualificationEngine();
    const job = baseJob({
      salaryText: '$1000 per task',
      description: 'Full stack TypeScript React Node contractor gigs.',
    });

    const parsed = parseSalary(job.salaryText);

    assert.equal(parsed.monthlyMin, undefined);
    assert.equal(parsed.min, undefined);
    assert.equal(engine.evaluate(job), null);
  });

  it('does not replace an existing usable listing salary', () => {
    const engine = new QualificationEngine();
    const job = baseJob({
      salaryText: 'US$ 5.000/mês',
      description: 'Also mentions $160,000 to $200,000 in the body.',
    });

    const result = engine.evaluate(job);

    assert.ok(result);
    assert.equal(result.compensation.raw, 'US$ 5.000/mês');
    assert.equal(result.compensation.monthlyMin, 5000);
  });
});
