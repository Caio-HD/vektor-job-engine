import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QualificationEngine } from '@/engine/qualifier';
import { requiredYearsOfExperience } from '@/engine/experience';
import type { RawJobListing } from '@/types/job';

function listing(overrides: Partial<RawJobListing>): RawJobListing {
  return {
    source: 'Test',
    externalId: '1',
    title: 'Full Stack Engineer',
    company: 'Acme',
    url: 'https://example.com/job',
    location: 'Worldwide',
    description: 'TypeScript React Node',
    salaryText: 'US$ 6.000/mês',
    ...overrides,
  };
}

describe('filtro de função, nível e salário do qualificador', () => {
  const engine = new QualificationEngine();

  it('rejeita designer mesmo quando a descrição cita React', () => {
    // Arrange
    const job = listing({
      title: 'Senior UI & UX / Graphic Designer',
      company: 'Lemon.io',
      description: 'Design interfaces that our React developers implement.',
      salaryText: 'US$ 8.800/mês',
    });

    // Act
    const result = engine.evaluate(job);

    // Assert
    assert.equal(result, null);
  });

  it('rejeita vagas de suporte acima do piso', () => {
    // Arrange
    const supportEngineer = listing({ title: 'Support Engineer (Contract)', company: 'Retell AI', salaryText: 'US$ 6.000 a US$ 7.500 por mes' });
    const tier2 = listing({ title: 'Technical Support Agent (Tier 2)', company: 'Capacity', salaryText: 'US$ 5.600 a US$ 7.200 por mes' });

    // Act + Assert
    assert.equal(engine.evaluate(supportEngineer), null);
    assert.equal(engine.evaluate(tier2), null);
  });

  it('rejeita sênior que pede 5 anos ou mais', () => {
    // Arrange
    const airtm = listing({
      title: 'Senior Software Enginner (Full-stack Node + React)',
      company: 'Airtm',
      location: 'LATAM',
      description: 'Required: 5+ years of professional software engineering experience. TypeScript, Node.js, React.',
      salaryText: 'US$ 12.917 por mes',
    });
    const lemon = listing({
      title: 'Senior React Full-stack Developer',
      company: 'Lemon.io',
      description: 'Commercial experience: React.js: 3+ years, Node.js: 5+ years, and Next.js: 2+ years.',
      salaryText: 'US$ 8.800 por mes',
    });

    // Act + Assert
    assert.equal(engine.evaluate(airtm), null);
    assert.equal(engine.evaluate(lemon), null);
  });

  it('rejeita sênior que pede 4 anos', () => {
    // Arrange
    const job = listing({
      title: 'Senior Frontend Engineer (React)',
      company: 'Oowlish Technology',
      location: 'Brazil',
      description: '4+ years of experience building React applications with TypeScript.',
      salaryText: 'US$ 12.917 por mes',
    });

    // Act + Assert
    assert.equal(engine.evaluate(job), null);
  });

  it('rejeita sênior que não declara anos', () => {
    // Arrange
    const toggl = listing({
      title: 'Toggl: Senior Full Stack',
      description: 'Deep, practical knowledge of JavaScript, TypeScript, React. Backend mostly Golang and Postgres.',
      salaryText: '€83,000',
    });
    const portuguese = listing({
      title: 'Desenvolvedor Full Stack Sênior',
      location: 'Worldwide',
      description: 'React, Node.js e TypeScript.',
    });
    const abbreviated = listing({ title: 'Sr. Full Stack Engineer', description: 'React, Node.js and TypeScript.' });

    // Act + Assert
    assert.equal(engine.evaluate(toggl), null);
    assert.equal(engine.evaluate(portuguese), null);
    assert.equal(engine.evaluate(abbreviated), null);
  });

  it('aceita sênior que pede até 3 anos', () => {
    // Arrange
    const job = listing({
      title: 'Senior Frontend Engineer (React)',
      description: '3+ years of experience building React applications with TypeScript.',
    });

    // Act + Assert
    assert.ok(engine.evaluate(job));
  });

  it('aceita pleno sem anos declarados', () => {
    // Arrange
    const job = listing({ title: 'Mid TypeScript Developer (React)', description: 'TypeScript, React and REST APIs.' });

    // Act + Assert
    assert.ok(engine.evaluate(job));
  });

  it('aceita engenheiro genérico quando a descrição confirma a stack', () => {
    // Arrange
    const job = listing({
      title: 'Software Engineer',
      company: 'Flex',
      location: 'Brazil',
      description: 'We primarily use Typescript, PostgreSQL, and GCP.',
      salaryText: 'USD 55k–75k / yr',
      salaryUnitHint: 'year',
    });

    // Act
    const result = engine.evaluate(job);

    // Assert
    assert.ok(result);
    assert.equal(result.track, 'FullStack');
  });

  it('aceita frontend React de qualquer país mesmo citando Flutter', () => {
    // Arrange
    const job = listing({
      title: 'Web Frontend Engineer - JS, CSS, React, Flutter',
      company: 'Canonical',
      location: 'Anywhere',
      salaryText: 'US$ 4.000 a US$ 5.833 por mes',
    });

    // Act + Assert
    assert.ok(engine.evaluate(job));
  });

  it('aceita vaga estrangeira sem salário e marca a confirmar', () => {
    // Arrange
    const job = listing({
      title: 'Full Stack Engineer',
      company: 'Infisical',
      location: 'USA, Canada, Europe, Brazil',
      description: 'Deep technical mastery of the JavaScript ecosystem, particularly React.js, Node.js, and TypeScript.',
      salaryText: undefined,
    });

    // Act
    const result = engine.evaluate(job);

    // Assert
    assert.ok(result);
    assert.equal(result.compensation.raw, 'a confirmar');
    assert.ok(result.reasons.includes('Salário a confirmar'));
  });

  it('rejeita vaga brasileira sem salário', () => {
    // Arrange
    const job = listing({
      title: 'Desenvolvedor(a) Full Stack Sênior',
      company: 'Fraga Assessoria',
      location: 'Brasil',
      description: 'Requisitos: experiência com React, Node.js e TypeScript. Benefícios: VR e plano de saúde.',
      salaryText: undefined,
    });

    // Act + Assert
    assert.equal(engine.evaluate(job), null);
  });

  it('rejeita vaga sem salário aberta só para Brasil e América Latina, mesmo com descrição em inglês', () => {
    // Arrange
    const location = 'Remote - South America, Latin America, Brazil';
    const noSalary = listing({ title: 'Full Stack Developer II', company: 'Hand Talk', location, description: 'Build features with React, Node.js and TypeScript.', salaryText: undefined });
    const withSalary = listing({ title: 'Full Stack Developer II', company: 'Hand Talk', location, description: 'Build features with React, Node.js and TypeScript.', salaryText: 'US$ 6.000/mês' });

    // Act + Assert
    assert.equal(engine.evaluate(noSalary), null);
    assert.ok(engine.evaluate(withSalary));
  });

  it('rejeita outra stack principal, gestão, DevOps e dados', () => {
    // Arrange
    const titles = [
      'Golang Engineer',
      'Engineering Manager',
      'Senior DevOps Engineer - LATAM',
      'Senior Data Scientist, Full Stack (Brazil)',
      'Analista Desenvolvedor Full Stack Java Sênior',
      'Senior AI Engineer / Architect',
      'Performance Engineer - Open Source',
      'Senior Infra Engineer: Observability',
    ];

    // Act + Assert
    for (const title of titles) {
      assert.equal(engine.evaluate(listing({ title, salaryText: 'US$ 15.094 por mes' })), null, title);
    }
  });

  it('rejeita trabalho pago por tarefa e vaga de ERP', () => {
    // Arrange
    const askable = listing({ title: 'Software Engineer, AI Coding Tasks', company: 'Askable', salaryText: '$1000 per task' });
    const askableContract = listing({ title: 'Askable: Software Engineer, AI Coding Tasks (Contract)', salaryText: 'See listing' });
    const sage = listing({ title: 'Toptal: Full-Stack E-commerce Developer with Sage X3 Experience', salaryText: 'See listing' });

    // Act + Assert
    assert.equal(engine.evaluate(askable), null);
    assert.equal(engine.evaluate(askableContract), null);
    assert.equal(engine.evaluate(sage), null);
  });

  it('mantém vaga de agentes de IA em TypeScript aberta a qualquer país', () => {
    // Arrange
    const job = listing({
      title: 'Sticker Mule: SI agent engineer',
      location: 'Anywhere in the World',
      description: 'Build agents that run on their own. Comfortable in Go, TypeScript, GraphQL, Postgres, GCP.',
      salaryText: '$150,000–$250,000 USD',
    });

    // Act + Assert
    assert.ok(engine.evaluate(job));
  });
});

describe('anos de experiência pedidos', () => {
  it('lê os formatos em inglês', () => {
    assert.equal(requiredYearsOfExperience('5+ years of experience with Node'), 5);
    assert.equal(requiredYearsOfExperience('at least 3 years building APIs'), 3);
    assert.equal(requiredYearsOfExperience('Minimum of 6 years in software'), 6);
    assert.equal(requiredYearsOfExperience('4 or more years of React'), 4);
    assert.equal(requiredYearsOfExperience('2-4 years of professional experience'), 2);
  });

  it('lê os formatos em português', () => {
    assert.equal(requiredYearsOfExperience('Mínimo de 5 anos com .NET'), 5);
    assert.equal(requiredYearsOfExperience('3 anos de experiência com React'), 3);
    assert.equal(requiredYearsOfExperience('Experiência de 4+ anos em Node'), 4);
  });

  it('usa o maior valor quando a vaga pede anos por tecnologia', () => {
    assert.equal(requiredYearsOfExperience('React.js: 3+ years, Node.js: 5+ years'), 5);
  });

  it('devolve null quando a vaga não fala em anos', () => {
    assert.equal(requiredYearsOfExperience('We use TypeScript and PostgreSQL.'), null);
    assert.equal(requiredYearsOfExperience(''), null);
  });
});
