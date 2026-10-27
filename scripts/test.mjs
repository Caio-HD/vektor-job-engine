import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testsDir = path.join(process.cwd(), 'tests');
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => path.join('tests', name));

if (files.length === 0) {
  console.error('no test files found in tests/');
  process.exit(1);
}

const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const result = spawnSync(process.execPath, [tsxCli, '--test', ...files], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
