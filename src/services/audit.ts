import { createHash } from 'node:crypto';
import { AuditLog } from '../models/AdminOperations.js';
import { nextCode } from './counter.js';

function canonical(value: unknown): string {
  return JSON.stringify(value, Object.keys((value ?? {}) as object).sort());
}

export function verifyAuditChain(items: Array<Record<string, unknown>>): {
  valid: boolean;
  brokenAt?: string;
} {
  let previousHash = '';
  for (const item of [...items].sort((a, b) => String(a.ts).localeCompare(String(b.ts)))) {
    const { hash, prevHash, ...payload } = item;
    delete payload._id;
    const expected = createHash('sha256')
      .update(previousHash + canonical(payload))
      .digest('hex');
    if (prevHash !== previousHash || hash !== expected)
      return { valid: false, brokenAt: String(item.code ?? '') };
    previousHash = String(hash);
  }
  return { valid: true };
}
export async function writeAudit(input: {
  actorId: string;
  actorName?: string | undefined;
  actorRole?: string | undefined;
  sessionCode?: string | undefined;
  event: string;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  result: string;
  before?: unknown;
  after?: unknown;
  ip?: string | undefined;
}): Promise<void> {
  const previous = await AuditLog.findOne().sort({ ts: -1 }).lean();
  const ts = new Date();
  const payload = { ...input, ts: ts.toISOString() };
  const prevHash = previous?.hash ?? '';
  const hash = createHash('sha256')
    .update(prevHash + canonical(payload))
    .digest('hex');
  await AuditLog.create({ ...input, code: await nextCode('audit'), ts, prevHash, hash });
}
