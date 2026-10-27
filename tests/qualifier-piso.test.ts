import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

describe('parseSalary formats',
  () => {
    it('parses Brazilian fixed monthly range with cents',
      () => {
        // Arrange
        const raw = 'R$ 5.683,15 - R$ 5.683,15 / month';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'BRL');
        assert.equal(parsed.unit, 'month');
        assert.equal(parsed.assumedUnit, false);
        assert.equal(parsed.assumedCurrency, false);
        assert.equal(parsed.min, 5683.15);
        assert.equal(parsed.max, 5683.15);
        assert.equal(parsed.monthlyMin, 5683.15);
        assert.equal(parsed.monthlyMax, 5683.15);
      });

    it('parses Brazilian K suffix and mês unit',
      () => {
        // Arrange
        const raw = 'R$ 7.000/mês - R$ 11,2K/mês';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'BRL');
        assert.equal(parsed.unit, 'month');
        assert.equal(parsed.min, 7000);
        assert.equal(parsed.max, 11200);
        assert.equal(parsed.monthlyMin, 7000);
        assert.equal(parsed.monthlyMax, 11200);
      });

    it('parses bare Brazilian range with assumed month and currency',
      () => {
        // Arrange
        const raw = '4.000 a 6.000';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'UNKNOWN');
        assert.equal(parsed.assumedCurrency, true);
        assert.equal(parsed.unit, 'month');
        assert.equal(parsed.assumedUnit, true);
        assert.equal(parsed.min, 4000);
        assert.equal(parsed.max, 6000);
        assert.equal(parsed.monthlyMin, 4000);
        assert.equal(parsed.monthlyMax, 6000);
      });

    it('parses US hourly range and normalizes with x160',
      () => {
        // Arrange
        const raw = '150 USD/h - 200 USD/h';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'USD');
        assert.equal(parsed.unit, 'hour');
        assert.equal(parsed.min, 150);
        assert.equal(parsed.max, 200);
        assert.equal(parsed.monthlyMin, 24000);
        assert.equal(parsed.monthlyMax, 32000);
      });

    it('parses US yearly range and normalizes with /12',
      () => {
        // Arrange
        const raw = '$80,000 - $100,000 per year';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'USD');
        assert.equal(parsed.unit, 'year');
        assert.equal(parsed.min, 80000);
        assert.equal(parsed.max, 100000);
        assert.equal(parsed.monthlyMin, 80000 / 12);
        assert.equal(parsed.monthlyMax, 100000 / 12);
      });

    it('parses US$ with Brazilian thousands and mês',
      () => {
        // Arrange
        const raw = 'US$ 4.000/mês';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'USD');
        assert.equal(parsed.unit, 'month');
        assert.equal(parsed.min, 4000);
        assert.equal(parsed.max, 4000);
        assert.equal(parsed.monthlyMin, 4000);
      });

    it('parses trailing BRL marker with Brazilian thousands',
      () => {
        // Arrange
        const raw = '4.000 - 6.000 BRL';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'BRL');
        assert.equal(parsed.assumedCurrency, false);
        assert.equal(parsed.min, 4000);
        assert.equal(parsed.max, 6000);
        assert.equal(parsed.unit, 'month');
        assert.equal(parsed.assumedUnit, true);
      });

    it('parses M suffix',
      () => {
        // Arrange
        const raw = '$1.2M per year';

        // Act
        const parsed = parseSalary(raw);

        // Assert
        assert.equal(parsed.currency, 'USD');
        assert.equal(parsed.min, 1_200_000);
        assert.equal(parsed.monthlyMin, 1_200_000 / 12);
      });

    it('returns unknown for placeholders and empty values',
      () => {
        for (const raw of ['Not specified', 'não informado', 'see listing', '', undefined, null]) {
          // Arrange / Act
          const parsed = parseSalary(raw);

          // Assert
          assert.equal(parsed.currency, 'UNKNOWN');
          assert.equal(parsed.unit, 'unknown');
          assert.equal(parsed.min, undefined);
          assert.equal(parsed.max, undefined);
          assert.equal(parsed.monthlyMin, undefined);
          assert.equal(parsed.monthlyMax, undefined);
        }
      });
  });

describe('QualificationEngine salary floor',
  () => {
    it('discards known USD below floor',
      () => {
        // Arrange
        const engine = new QualificationEngine();
        const job = baseJob({ salaryText: 'US$ 3.000/mês' });

        // Act
        const result = engine.evaluate(job);

        // Assert
        assert.equal(result, null);
      });

    it('keeps known USD at or above floor',
      () => {
        // Arrange
        const engine = new QualificationEngine();
        const job = baseJob({ salaryText: 'US$ 4.000/mês' });

        // Act
        const result = engine.evaluate(job);

        // Assert
        assert.ok(result);
        assert.equal(result.compensation.currency, 'USD');
        assert.equal(result.compensation.monthlyMin, 4000);
        assert.deepEqual(result.reasons, [
          'Matched track FullStack',
          'Passed all negative exclusion filters',
        ]);
      });

    it('discards known BRL below floor',
      () => {
        // Arrange
        const engine = new QualificationEngine();
        const job = baseJob({ salaryText: 'R$ 5.000/mês' });

        // Act
        const result = engine.evaluate(job);

        // Assert
        assert.equal(result, null);
      });

    it('discards known BRL above the old floor but below the current one',
      () => {
        // Arrange
        const engine = new QualificationEngine();
        const job = baseJob({ salaryText: 'R$ 7.000/mês' });

        // Act
        const result = engine.evaluate(job);

        // Assert
        assert.equal(result, null);
      });

    it('keeps known BRL at or above floor',
      () => {
        // Arrange
        const engine = new QualificationEngine();
        const job = baseJob({ salaryText: 'R$ 8.000/mês' });

        // Act
        const result = engine.evaluate(job);

        // Assert
        assert.ok(result);
        assert.equal(result.compensation.currency, 'BRL');
        assert.equal(result.compensation.monthlyMin, 8000);
      });

    it('keeps unknown salary from a foreign posting, marked to confirm',
      () => {
        // Arrange
        const engine = new QualificationEngine();
        const job = baseJob({ salaryText: 'Not specified' });

        // Act
        const result = engine.evaluate(job);

        // Assert
        assert.ok(result);
        assert.equal(result.compensation.currency, 'UNKNOWN');
        assert.equal(result.compensation.monthlyMin, undefined);
        assert.equal(result.compensation.raw, 'a confirmar');
      });
  });
