import { Router } from 'express';
import { z } from 'zod';
import { BloodRequest } from '../../models/BloodRequest.js';
import { AppRelease } from '../../models/AppRelease.js';
import { User } from '../../models/User.js';
import { AppError } from '../../middleware/error.js';
import { requireUser } from '../../middleware/auth.js';

const router = Router();
router.get('/share/requests/:code', async (req, res, next) => {
  try {
    const item = await BloodRequest.findOne({ code: req.params.code, status: 'approved' }).lean();
    if (!item)
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
    res.json({
      success: true,
      data: {
        code: item.code,
        patientName: item.patientName,
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
