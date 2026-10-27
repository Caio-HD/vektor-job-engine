import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QualificationEngine } from '@/engine/qualifier';
import type { RawJobListing } from '@/types/job';

function jobWithLocation(location: string): RawJobListing {
  return {
    source: 'Test',
    externalId: '1',
    title: 'Full Stack Engineer',
    company: 'Acme',
    url: 'https://example.com/job',
    location,
    description: 'TypeScript React Node',
    salaryText: 'US$ 6.000/mês',
  };
}

describe('filtro de local do qualificador', () => {
  const engine = new QualificationEngine();

  it('aceita vaga remota sem regiao restrita', () => {
    assert.ok(engine.evaluate(jobWithLocation('Remote')));
  });

  it('aceita vaga remota que inclui LATAM ou global', () => {
    assert.ok(engine.evaluate(jobWithLocation('Europe, LATAM, APAC, the United States')));
    assert.ok(engine.evaluate(jobWithLocation('Northern America, LATAM, Europe')));
    assert.ok(engine.evaluate(jobWithLocation('Worldwide')));
    assert.ok(engine.evaluate(jobWithLocation('Anywhere')));
    assert.ok(engine.evaluate(jobWithLocation('Brazil')));
  });

  it('rejeita vaga remota restrita a outra regiao', () => {
    assert.equal(engine.evaluate(jobWithLocation('Remote - US & Canada')), null);
    assert.equal(engine.evaluate(jobWithLocation('Remote - Canada only')), null);
    assert.equal(engine.evaluate(jobWithLocation('Remote - Europe')), null);
    assert.equal(engine.evaluate(jobWithLocation('United States')), null);
    assert.equal(engine.evaluate(jobWithLocation('Remote - EMEA')), null);
  });

  it('mantem a regra antiga de local bloqueado por "only"', () => {
    assert.equal(engine.evaluate(jobWithLocation('US only')), null);
    assert.equal(engine.evaluate(jobWithLocation('Europe only')), null);
  });

  it('rejeita local que nao aceita o candidato', () => {
    assert.equal(engine.evaluate(jobWithLocation('Berlin')), null);
  });
});
