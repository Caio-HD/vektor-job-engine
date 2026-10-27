import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function resolveAliasTarget(rel) {
  const base = path.join(repoRoot, 'src', rel);
  if (fs.existsSync(base)) {
    return base;
  }
  if (fs.existsSync(`${base}.ts`)) {
    return `${base}.ts`;
  }
  if (fs.existsSync(`${base}.tsx`)) {
    return `${base}.tsx`;
  }
  return base;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const target = resolveAliasTarget(rel);
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
