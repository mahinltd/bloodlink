import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { BloodRequest } from '../../models/BloodRequest.js';
import { Call } from '../../models/Call.js';
import { Otp } from '../../models/Otp.js';
import { JobRun } from '../../models/JobRun.js';
import { errorCatalogue } from '../../config/errors.js';
import { User } from '../../models/User.js';
import { Notification } from '../../models/Community.js';
import { DonorProfile } from '../../models/DonorProfile.js';
import { Device } from '../../models/Device.js';
import { isCompatible } from '../../services/compatibility.js';
import { createDrivers } from '../../services/drivers.js';
import { NotificationTemplate } from '../../models/Template.js';

const router = Router();
const jobNames = [
  'expire-requests',
  'missed-calls',
  'call-timeout',
  'cleanup',
  'daily-stats',
  'stale-moderation',
  'notification-fanout',
  'update-maintenance',
  'audit-verify',
  'anonymize-deleted',
] as const;
type JobName = (typeof jobNames)[number];

async function executeJob(name: JobName): Promise<void> {
  if (name === 'expire-requests') {
    await BloodRequest.updateMany(
      { status: 'approved', neededBy: { $lt: new Date() } },
      { $set: { status: 'expired' } },
    );
  }
  if (name === 'missed-calls' || name === 'call-timeout') {
    await Call.updateMany(
      { state: 'ringing', createdAt: { $lt: new Date(Date.now() - 45_000) } },
      { $set: { state: 'missed', endReason: 'timeout', endedAt: new Date() } },
    );
  }
  if (name === 'cleanup') await Otp.deleteMany({ expiresAt: { $lt: new Date() } });
  if (name === 'anonymize-deleted') {
    await User.updateMany(
      { status: 'deleted', deletedAt: { $lt: new Date(Date.now() - 30 * 86400_000) } },
      { $set: { phone: null, passwordHash: null } },
    );
  }
  if (name === 'notification-fanout') {
    await Notification.deleteMany({ expireAt: { $lt: new Date() } });
    const requests = await BloodRequest.find({
      status: 'approved',
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    })
      .limit(20)
      .lean();
    const pusher = createDrivers().pusher;
    const template = await NotificationTemplate.findOne({
      key: 'request_nearby',
      active: true,
    }).lean();
    if (!template?.title?.en || !template.body?.bn || !template.body.en)
      throw new Error('Notification template request_nearby is not seeded.');
    const title = { bn: template.title.bn ?? template.title.en, en: template.title.en };
    const body = { bn: template.body.bn, en: template.body.en };
    for (const request of requests) {
      const donors = await DonorProfile.find({ available: true }).limit(200).lean();
      const compatible = donors
        .filter((donor) => donor.bloodGroup && isCompatible(request.bloodGroup, donor.bloodGroup))
        .slice(0, 200);
      if (!compatible.length) continue;
      const devices = await Device.find({
        userId: { $in: compatible.map((donor) => donor.userId) },
      })
        .select('userId fcmToken')
        .lean();
      const tokens = devices.map((device) => device.fcmToken);
      if (tokens.length) {
        await pusher.send({
          tokens,
          data: { type: 'request_nearby', requestId: request._id.toString() },
          title: title.en,
          body: body.en,
        });
      }
      await Notification.insertMany(
        compatible.map((donor) => ({
          userId: donor.userId,
          type: 'request_nearby',
          title,
          body,
          data: { requestId: request._id.toString() },
          expireAt: new Date(Date.now() + 30 * 86400_000),
        })),
        { ordered: false },
      );
    }
  }
}

async function runOnce(name: JobName): Promise<'completed' | 'already_completed'> {
  const runKey = `${name}:${new Date().toISOString().slice(0, 16)}`;
  const existing = await JobRun.findOne({ runKey }).lean();
  if (existing) return 'already_completed';
  const run = await JobRun.create({ name, runKey, status: 'running', startedAt: new Date() });
  try {
    await executeJob(name);
    run.status = 'completed';
    run.finishedAt = new Date();
    await run.save();
    return 'completed';
  } catch (error) {
    run.status = 'failed';
    run.finishedAt = new Date();
    run.error = error instanceof Error ? error.message : 'Unknown job error';
    await run.save();
    throw error;
  }
}

router.post(`/:name(${jobNames.join('|')})`, async (req, res, next) => {
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
    const name = z.enum(jobNames).parse(req.params.name);
    const status = await runOnce(name);
    res.json({ success: true, data: { job: name, status }, meta: {} });
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
    const jobs = ['expire-requests', 'call-timeout', 'cleanup'] as const;
    const results: Array<{ job: string; status: string }> = [];
    for (const name of jobs) {
      results.push({ job: name, status: await runOnce(name) });
    }
    res.json({ success: true, data: { results }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
