import { Counter } from '../models/Counter.js';

const prefixes: Record<string, string> = {
  user: 'USR',
  request: 'REQ',
  report: 'RPT',
  support: 'SUP',
  support_payment: 'SUPPAY',
  audit: 'AUD',
  call: 'CALL',
  session: 'SESSION',
};

export async function nextSequence(kind: keyof typeof prefixes): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { key: kind },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return counter.seq;
}

export async function nextCode(kind: keyof typeof prefixes): Promise<string> {
  const sequence = await nextSequence(kind);
  const prefix = prefixes[kind];
  if (!prefix) throw new Error(`Unknown counter kind: ${kind}`);
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}
