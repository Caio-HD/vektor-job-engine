import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));

register(pathToFileURL(path.join(testsDir, 'alias-resolve.mjs')).href, import.meta.url);
