import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { BloodRequest } from '../../models/BloodRequest.js';
import { Call } from '../../models/Call.js';
import { Otp } from '../../models/Otp.js';
import { JobRun } from '../../models/JobRun.js';
import { errorCatalogue } from '../../config/errors.js';

const router = Router();
router.post('/:name', async (req, res, next) => {
  try {
    if (req.header('x-job-secret') !== env.JOB_SECRET)
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          ref: errorCatalogue.UNAUTHORIZED.ref,
          message: { bn: errorCatalogue.UNAUTHORIZED.bn, en: errorCatalogue.UNAUTHORIZED.en },
        },
      });
    const name = z
      .enum([
        'expire-requests',
        'missed-calls',
        'cleanup',
        'daily-stats',
        'stale-moderation',
        'audit-verify',
      ])
      .parse(req.params.name);
    const runKey = `${name}:${new Date().toISOString().slice(0, 16)}`;
    const run = await JobRun.create({
      name,
      runKey,
      status: 'running',
      startedAt: new Date(),
    });
    if (name === 'expire-requests')
      await BloodRequest.updateMany(
        { status: 'approved', neededBy: { $lt: new Date(Date.now() - 86400_000) } },
        { $set: { status: 'expired' } },
      );
    if (name === 'missed-calls')
      await Call.updateMany(
        { state: 'ringing', createdAt: { $lt: new Date(Date.now() - 45_000) } },
        { $set: { state: 'missed', endReason: 'timeout' } },
      );
    if (name === 'cleanup') await Otp.deleteMany({ expiresAt: { $lt: new Date() } });
    run.status = 'completed';
    run.finishedAt = new Date();
    await run.save();
    res.json({ success: true, data: { job: name, status: 'completed' }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/tick', async (req, res, next) => {
  try {
    if (req.header('x-job-secret') !== env.JOB_SECRET)
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          ref: errorCatalogue.UNAUTHORIZED.ref,
          message: { bn: errorCatalogue.UNAUTHORIZED.bn, en: errorCatalogue.UNAUTHORIZED.en },
        },
      });
    const jobs = ['expire-requests', 'missed-calls', 'cleanup'] as const;
    const results: Array<{ job: string; status: string }> = [];
    for (const name of jobs) {
      const runKey = `${name}:${new Date().toISOString().slice(0, 16)}`;
      const existing = await JobRun.findOne({ runKey }).lean();
      if (existing) {
        results.push({ job: name, status: 'already_completed' });
        continue;
      }
      results.push({ job: name, status: 'queued' });
    }
    res.json({ success: true, data: { results }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
