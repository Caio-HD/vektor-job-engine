# vektor-job-engine

Job ingestion and qualification engine for remote-work boards. It collects postings from several
sources, parses compensation written in USD and BRL, and keeps only the postings that pass a set of
rules: stack, seniority, years of experience asked, and a salary floor.

This is a one-time extract from a private tool I use every day to run my own job search. It was
published so the parsing and scoring logic can be read and tested in isolation.

## What is here

```
src/
  connectors/   one module per board (Ashby, Himalayas, Jobicy, Jobgether,
                RemoteOK, Remotive, We Work Remotely, Working Nomads)
  engine/       salary parsing and normalisation, posting qualification, experience rules
  types/        the shared job posting shape
tests/          unit tests for the connectors, the salary parser and the qualifier
```

## Rules the qualifier applies

- **Seniority**: a posting titled "senior" only passes when it asks for three years or fewer, because
  a title alone does not describe the bar.
- **Years asked**: read from the body text, including ranges and the several ways boards phrase them.
- **Salary floor**: a posting with no disclosed compensation is kept, but flagged, instead of silently
  dropped.
- **Stack match**: the posting must mention the technologies the candidate actually uses.

Each rule is a pure function over the parsed posting, so it can be unit tested without network access.

## Running it

```bash
npm install
npm run typecheck
npm test
```

The tests do not touch the network: each connector test runs against a saved payload. 82 tests cover
the connectors, the salary parser and the qualifier.

## What was left out

This extract is the engine only. The database layer, the web app and the storage of postings stayed in
the private tool, so the tests that read postings from the database are not here. The salary page
parser (`src/engine/salary-page.ts`) is included, but its test is not, because that test needs the
database fixture.

## Notes

- Compensation parsing is deliberately conservative. When a range cannot be resolved into a monthly
  or annual figure with a stated currency, the posting is marked as unknown rather than guessed.
- The connectors only read public listing pages. Rate limiting and caching are handled by the caller.
