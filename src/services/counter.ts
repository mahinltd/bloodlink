import { Counter } from '../models/Counter.js';

const prefixes: Record<string, string> = {
  user: 'USR',
  request: 'REQ',
  report: 'RPT',
  support: 'SUP',
  audit: 'AUD',
  call: 'CALL',
  session: 'SESSION',
};

export async function nextCode(kind: keyof typeof prefixes): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { key: kind },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  const prefix = prefixes[kind];
  if (!prefix) throw new Error(`Unknown counter kind: ${kind}`);
  return `${prefix}-${String(counter.seq).padStart(4, '0')}`;
}
