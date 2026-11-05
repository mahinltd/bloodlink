import { env } from '../config/env.js';

if (!env.SEED_DEMO) {
  throw new Error('Demo seeding is disabled. Set SEED_DEMO=true explicitly.');
}

console.log(`Demo seed placeholder for ${env.APP_ENV}.`);
