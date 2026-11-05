import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../../openapi.yaml', import.meta.url), 'utf8');
await writeFile(new URL('../../openapi.yaml', import.meta.url), source);
console.log('OpenAPI contract is present at openapi.yaml.');
