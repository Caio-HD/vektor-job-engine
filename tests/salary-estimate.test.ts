import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCorpus,
  classifyFamily,
  classifySeniority,
  compareEstimatesToReal,
  estimateFromCorpus,
  relativeError,
  shouldDiscardByEstimate,
  summarizeAccuracy,
  type SalaryCorpus,
} from '@/engine/salary-estimate';
import type { QualifiedJob } from '@/types/job';

function job(overrides: Partial<QualifiedJob> & Pick<QualifiedJob, 'id' | 'title' | 'company'>): QualifiedJob {
  return {
    source: 'Test',
    url: 'https://example.com/' + overrides.id,
    location: 'Remote Worldwide',
    compensation: {
      raw: 'Not specified',
      currency: 'UNKNOWN',
    },
    track: 'FullStack',
    matchScore: 0.9,
    reasons: [],
    collectedAt: new Date().toISOString(),
    ...overrides,
  };
}

function paid(
  id: string,
  title: string,
  company: string,
  monthlyMin: number,
  monthlyMax: number,
): QualifiedJob {
  return job({
    id,
    title,
    company,
    compensation: {
      raw: `US$ ${monthlyMin}-${monthlyMax}/mês`,
      currency: 'USD',
      min: monthlyMin,
      max: monthlyMax,
      monthlyMin,
      monthlyMax,
      unit: 'month',
    },
  });
}

describe('salary-estimate classification', () => {
  it('classifies family from title keywords', () => {
    assert.equal(classifyFamily('Senior Frontend Engineer'), 'frontend');
    assert.equal(classifyFamily('Backend Engineer'), 'backend');
    assert.equal(classifyFamily('Full Stack Developer'), 'fullstack');
    assert.equal(classifyFamily('Staff ML Engineer', 'LLM and NLP'), 'ai');
    assert.equal(classifyFamily('DevOps Engineer'), 'devops');
    assert.equal(classifyFamily('Data Engineer'), 'data');
    assert.equal(classifyFamily('Mobile iOS Engineer'), 'mobile');
    assert.equal(classifyFamily('QA Automation Engineer'), 'qa');
    assert.equal(classifyFamily('Solutions Consultant'), 'other');
  });

  it('classifies seniority from title keywords', () => {
    assert.equal(classifySeniority('Junior Frontend Engineer'), 'junior');
    assert.equal(classifySeniority('Mid-level Backend Engineer'), 'pleno');
    assert.equal(classifySeniority('Senior Full Stack Engineer'), 'senior');
    assert.equal(classifySeniority('Staff Platform Engineer'), 'lead');
    assert.equal(classifySeniority('Software Engineer'), 'unknown');
  });
});

describe('salary-estimate corpus and estimate', () => {
  it('requires at least 3 group observations before estimating', () => {
    const corpus = buildCorpus([
      paid('1', 'Senior Frontend Engineer', 'A', 4000, 5000),
      paid('2', 'Senior Frontend Engineer', 'B', 4500, 5500),
    ]);
    const estimate = estimateFromCorpus(
      { title: 'Senior Frontend Engineer', company: 'Zed' },
      corpus,
    );
    assert.equal(estimate, null);
  });

  it('uses the group band when there are enough observations', () => {
    const corpus = buildCorpus([
      paid('1', 'Senior Frontend Engineer', 'A', 4000, 5000),
      paid('2', 'Senior Frontend Engineer', 'B', 4500, 6000),
      paid('3', 'Senior Frontend Engineer', 'C', 5000, 7000),
    ]);
    const estimate = estimateFromCorpus(
      { title: 'Senior Frontend Engineer', company: 'Zed' },
      corpus,
    );
    assert.ok(estimate);
    assert.equal(estimate.method, 'grupo');
    assert.equal(estimate.observationCount, 3);
    assert.equal(estimate.monthlyMin, 4000);
    assert.equal(estimate.monthlyMax, 7000);
    assert.match(estimate.basis, /frontend\/senior/);
  });

  it('prefers the company band over the group band', () => {
    const corpus = buildCorpus([
      paid('1', 'Senior Frontend Engineer', 'Acme', 8000, 9000),
      paid('2', 'Senior Frontend Engineer', 'Acme', 8500, 9500),
      paid('3', 'Senior Frontend Engineer', 'Other1', 4000, 5000),
      paid('4', 'Senior Frontend Engineer', 'Other2', 4100, 5100),
      paid('5', 'Senior Frontend Engineer', 'Other3', 4200, 5200),
    ]);
    const estimate = estimateFromCorpus(
      { title: 'Senior Frontend Engineer', company: 'Acme' },
      corpus,
    );
    assert.ok(estimate);
    assert.equal(estimate.method, 'empresa');
    assert.equal(estimate.observationCount, 2);
    assert.equal(estimate.monthlyMin, 8000);
    assert.equal(estimate.monthlyMax, 9500);
  });

  it('returns no estimate when nothing is observed for the job', () => {
    const corpus: SalaryCorpus = {
      byCompany: new Map(),
      byGroup: new Map(),
    };
    const estimate = estimateFromCorpus(
      { title: 'Senior Mobile Engineer', company: 'Unknown Co' },
      corpus,
    );
    assert.equal(estimate, null);
  });
});

describe('salary-estimate discard rule', () => {
  const floors = { minMonthlyUsd: 4000, minMonthlyBrl: 8000 };

  it('discards when the top of the estimated band is below the floor', () => {
    assert.equal(
      shouldDiscardByEstimate(
        {
          monthlyMin: 2000,
          monthlyMax: 3500,
          currency: 'USD',
          method: 'grupo',
          observationCount: 3,
          basis: 'test',
          family: 'frontend',
          seniority: 'junior',
        },
        floors,
      ),
      true,
    );
  });

  it('keeps a wide band whose top clears the floor', () => {
    assert.equal(
      shouldDiscardByEstimate(
        {
          monthlyMin: 3500,
          monthlyMax: 9000,
          currency: 'USD',
          method: 'grupo',
          observationCount: 3,
          basis: 'test',
          family: 'frontend',
          seniority: 'senior',
        },
        floors,
      ),
      false,
    );
  });

  it('never discards a job with no estimate', () => {
    assert.equal(shouldDiscardByEstimate(null, floors), false);
  });
});

describe('salary-estimate shadow validation', () => {
  it('computes relative error against the real mid-point', () => {
    assert.equal(relativeError(6000, 5000), 0.2);

    const jobs = [
      paid('1', 'Senior Frontend Engineer', 'A', 4000, 5000),
      paid('2', 'Senior Frontend Engineer', 'B', 4500, 5500),
      paid('3', 'Senior Frontend Engineer', 'C', 5000, 7000),
      paid('4', 'Senior Frontend Engineer', 'D', 4800, 5200),
    ];
    const corpus = buildCorpus(jobs);
    const comparisons = compareEstimatesToReal(jobs, corpus);
    assert.ok(comparisons.length >= 1);
    for (const row of comparisons) {
      assert.ok(row.relativeError >= 0);
    }
    const accuracy = summarizeAccuracy(comparisons);
    assert.equal(accuracy.comparedCount, comparisons.length);
    assert.ok(typeof accuracy.meanRelativeError === 'number');
  });
});
