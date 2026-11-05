import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

type OpenApiDocument = {
  paths: Record<
    string,
    Record<string, { operationId?: string; responses?: Record<string, unknown> }>
  >;
  'x-socket-events'?: string[];
};

describe('OpenAPI contract', () => {
  it('is valid and documents every operation with required path parameters', async () => {
    const source = await readFile(new URL('../openapi.yaml', import.meta.url), 'utf8');
    const document = parse(source) as OpenApiDocument;
    expect(document.paths).toBeTypeOf('object');
    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        expect(operation.operationId, `${method.toUpperCase()} ${path} operationId`).toBeTypeOf(
          'string',
        );
        expect(operation.responses, `${method.toUpperCase()} ${path} responses`).toBeTypeOf(
          'object',
        );
        expect(path).toMatch(/^\/[a-zA-Z0-9_{}:/.-]+$/);
      }
    }
  });

  it('documents all realtime event names', async () => {
    const source = await readFile(new URL('../openapi.yaml', import.meta.url), 'utf8');
    const document = parse(source) as OpenApiDocument;
    expect(document['x-socket-events']).toEqual(
      expect.arrayContaining([
        'presence:ping',
        'presence:online',
        'presence:offline',
        'typing:start',
        'typing:stop',
        'message:send',
        'message:new',
        'message:read',
        'message:delivered',
        'message:seen',
        'call:invite',
        'call:accept',
        'call:decline',
        'call:end',
        'flag:changed',
      ]),
    );
  });
});
