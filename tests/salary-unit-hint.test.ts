import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSalary } from '@/engine/salary';

describe('parseSalary unitHint', () => {
  it('treats Ashby scrapeable ranges as annual when hinted', () => {
    const parsed = parseSalary('$174K - $267.1K', { unitHint: 'year' });

    assert.equal(parsed.unit, 'year');
    assert.equal(parsed.assumedUnit, false);
    assert.equal(parsed.min, 174_000);
    assert.equal(parsed.monthlyMin, 14_500);
  });

  it('reads a US amount without unit keyword as an annual band', () => {
    const parsed = parseSalary('$174K - $267.1K');

    assert.equal(parsed.unit, 'year');
    assert.equal(parsed.assumedUnit, true);
    assert.equal(parsed.min, 174_000);
    assert.equal(parsed.monthlyMin, 14_500);
  });

  it('reads a Brazilian amount without unit keyword as a monthly band', () => {
    const parsed = parseSalary('R$ 11.359,50');

    assert.equal(parsed.unit, 'month');
    assert.equal(parsed.assumedUnit, true);
    assert.equal(parsed.min, 11_359.5);
    assert.equal(parsed.monthlyMin, 11_359.5);
  });

  it('keeps the monthly default when the currency gives no convention', () => {
    const parsed = parseSalary('174000 - 267100');

    assert.equal(parsed.unit, 'month');
    assert.equal(parsed.assumedUnit, true);
  });
});
