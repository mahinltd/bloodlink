import { Router } from 'express';
import { z } from 'zod';
import { BloodRequest } from '../../models/BloodRequest.js';
import { AppRelease } from '../../models/AppRelease.js';
import { User } from '../../models/User.js';
import { DonorProfile } from '../../models/DonorProfile.js';
import { CmsString } from '../../models/CmsString.js';
import { AppError } from '../../middleware/error.js';
import { requireUser } from '../../middleware/auth.js';
import { authRateLimit } from '../../middleware/rateLimit.js';
import { createDrivers } from '../../services/drivers.js';
import { env } from '../../config/env.js';

const router = Router();
const drivers = createDrivers();

router.get('/public/stats', async (_req, res, next) => {
  try {
    const [donors, completedConnections, divisions] = await Promise.all([
      DonorProfile.countDocuments({ available: true }),
      BloodRequest.countDocuments({ status: 'fulfilled' }),
      DonorProfile.distinct('division', { available: true }),
    ]);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({
      success: true,
      data: {
        donorCount: Math.floor(donors / 10) * 10,
        completedConnections: Math.floor(completedConnections / 10) * 10,
        divisionsCovered: divisions.length,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.get('/public/app-release', async (_req, res, next) => {
  try {
    const release = await AppRelease.findOne({ channel: 'stable', status: 'published' })
      .sort({ versionCode: -1 })
      .lean();
    if (!release) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'No release is available.');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      data: {
        versionName: release.versionName,
        versionCode: release.versionCode,
        sizeBytes: release.apkSizeBytes,
        sha256: release.apkSha256,
        publishedAt: release.publishedAt,
        notes: release.notes,
        downloadUrl: `${env.API_URL}/api/v1/download/latest`,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.get('/public/app-releases', async (_req, res, next) => {
  try {
    const releases = await AppRelease.find({ channel: 'stable', status: 'published' })
      .sort({ versionCode: -1 })
      .select('versionCode versionName apkSizeBytes apkSha256 notes publishedAt')
      .lean();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: releases, meta: { total: releases.length } });
  } catch (error) {
    next(error);
  }
});

router.post('/public/contact', authRateLimit, async (req, res, next) => {
  try {
    const input = z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().email(),
        message: z.string().trim().min(1).max(2000),
        website: z.string().max(0).optional(),
      })
      .parse(req.body);
    if (!input.website) {
      await drivers.mailer.send({
        to: env.SUPPORT_EMAIL,
        subject: 'BloodLink website contact',
        html: `<p>${input.name}</p><p>${input.email}</p><p>${input.message}</p>`,
      });
    }
    res.status(202).json({ success: true, data: { accepted: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.get('/public/content', async (_req, res, next) => {
  try {
    const strings = await CmsString.find({ status: 'published' })
      .select('key bn en screen version')
      .lean();
    res.json({ success: true, data: strings, meta: { total: strings.length } });
  } catch (error) {
    next(error);
  }
});
router.get('/share/requests/:code', async (req, res, next) => {
  try {
    const item = await BloodRequest.findOne({ code: req.params.code, status: 'approved' }).lean();
    if (!item)
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
    res.json({
      success: true,
      data: {
        code: item.code,
        bloodGroup: item.bloodGroup,
        units: item.units,
        hospitalName: item.hospitalNameText,
        area: item.area,
        neededBy: item.neededBy,
        priority: item.priority,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/public/requests/:code', async (req, res, next) => {
  try {
    const item = await BloodRequest.findOne({ code: req.params.code, status: 'approved' }).lean();
    if (!item)
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
    res.json({
      success: true,
      data: {
        code: item.code,
        bloodGroup: item.bloodGroup,
        units: item.units,
        hospitalName: item.hospitalNameText,
        area: item.area,
        neededBy: item.neededBy,
        status: item.status,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/download/latest', async (_req, res, next) => {
  try {
    const release = await AppRelease.findOne({ channel: 'stable', status: 'published' }).sort({
      versionCode: -1,
    });
    if (!release) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'No release is available.');
    release.downloads += 1;
    await release.save();
    res.redirect(302, release.apkUrl);
  } catch (error) {
    next(error);
  }
});
router.get('/download/:versionCode', async (req, res, next) => {
  try {
    const versionCode = z.coerce.number().int().positive().parse(req.params.versionCode);
    const release = await AppRelease.findOne({ versionCode, status: 'published' });
    if (!release) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Release not found.');
    release.downloads += 1;
    await release.save();
    res.redirect(302, release.apkUrl);
  } catch (error) {
    next(error);
  }
});
router.delete('/me', requireUser, async (req, res, next) => {
  try {
    const input = z.object({ password: z.string().optional() }).parse(req.body);
    const user = await User.findById(req.auth?.userId).select('+passwordHash');
    if (!user) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Account not found.');
    if (
      user.passwordHash &&
      (!input.password ||
        !(await import('argon2')).default.verify(user.passwordHash, input.password))
    )
      throw new AppError(403, 'FORBIDDEN', 'BL-403', 'Account confirmation failed.');
    user.status = 'deleted';
    user.deletedAt = new Date();
    user.email = `deleted-${user._id.toString()}@deleted.invalid`;
    user.name = 'Deleted user';
    user.phone = null;
    user.passwordHash = null;
    await user.save();
    res.json({ success: true, data: { deleted: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
