import { createHash } from 'node:crypto';
import { AuditLog } from '../models/AdminOperations.js';
import { nextSequence } from './counter.js';

let auditWriteQueue = Promise.resolve();

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function verifyAuditChain(items: Array<Record<string, unknown>>): {
  valid: boolean;
  brokenAt?: string;
} {
  let previousHash = '';
  for (const item of [...items].sort((a, b) => {
    return Number(a.sequence ?? 0) - Number(b.sequence ?? 0);
  })) {
    const { hash, prevHash, ...payload } = item;
    delete payload.code;
    delete payload.sequence;
    delete payload._id;
    delete payload.__v;
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
  auditWriteQueue = auditWriteQueue.then(async () => {
    const previous = await AuditLog.findOne().sort({ sequence: -1 }).lean();
    const sequence = await nextSequence('audit');
    const ts = new Date();
    const payload = {
      ...input,
      before:
        input.before && typeof input.before === 'object' && 'toObject' in input.before
          ? (input.before as { toObject: () => unknown }).toObject()
          : input.before,
      after:
        input.after && typeof input.after === 'object' && 'toObject' in input.after
          ? (input.after as { toObject: () => unknown }).toObject()
          : input.after,
      ts: ts.toISOString(),
    };
    const prevHash = previous?.hash ?? '';
    const hash = createHash('sha256')
      .update(prevHash + canonical(payload))
      .digest('hex');
    await AuditLog.create({
      ...input,
      sequence,
      code: `AUD-${String(sequence).padStart(4, '0')}`,
      ts,
      prevHash,
      hash,
    });
  });
  await auditWriteQueue;
}
