export type AshbyBoard = {
  slug: string;
  company: string;
  salaryUnitHint: 'year';
};

export const ASHBY_BOARDS: readonly AshbyBoard[] = [
  { slug: 'miro', company: 'Miro', salaryUnitHint: 'year' },
  { slug: 'andela', company: 'Andela', salaryUnitHint: 'year' },
  { slug: 'wrapbook', company: 'Wrapbook', salaryUnitHint: 'year' },
  { slug: 'airbyte', company: 'Airbyte', salaryUnitHint: 'year' },
  { slug: 'zapier', company: 'Zapier', salaryUnitHint: 'year' },
  { slug: 'infisical', company: 'Infisical', salaryUnitHint: 'year' },
  { slug: 'railway', company: 'Railway', salaryUnitHint: 'year' },
] as const;
