import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { BloodRequest } from '../../models/BloodRequest.js';
import { Call } from '../../models/Call.js';
import { Otp } from '../../models/Otp.js';

const router = Router();
router.post('/:name', async (req, res, next) => {
  try {
    if (req.header('x-job-secret') !== env.JOB_SECRET)
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          ref: 'BL-401',
          message: { bn: 'অনুমতি নেই।', en: 'Unauthorized.' },
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
    res.json({ success: true, data: { job: name, status: 'completed' }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
