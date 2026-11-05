import { Router } from 'express';
import { z } from 'zod';
import { DonorProfile } from '../../models/DonorProfile.js';
import { User } from '../../models/User.js';
import { Device } from '../../models/Device.js';
import { Block } from '../../models/Block.js';
import { requireUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { BloodRequest } from '../../models/BloodRequest.js';

const router = Router();
const profile = (req: Parameters<typeof requireUser>[0]) => req.auth?.userId ?? '';
const fuzz = (value: number): number => Math.round(value * 10) / 10 + (Math.random() - 0.5) * 0.01;
const nextEligible = (date: Date): Date => new Date(date.getTime() + 120 * 86400_000);

router.get('/me', requireUser, async (req, res, next) => {
  try {
    const user = await User.findById(profile(req)).lean();
    const donor = await DonorProfile.findOne({ userId: profile(req) }).lean();
    if (!user) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Account not found.');
    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        code: user.code,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        language: user.language,
        preferences: user.preferences,
        donorProfile: donor ? { ...donor, dob: undefined, locationPrecise: undefined } : null,
        registrationStep: donor?.registrationStep ?? 1,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        language: z.enum(['bn', 'en']).optional(),
      })
      .parse(req.body);
    const user = await User.findByIdAndUpdate(profile(req), { $set: input }, { new: true }).lean();
    res.json({
      success: true,
      data: { id: user?._id.toString(), name: user?.name, language: user?.language },
      meta: {},
    });
    router.patch('/me/preferences', requireUser, async (req, res, next) => {
      try {
        const input = z
          .object({
            notifications: z.boolean().optional(),
            nearbyRequests: z.boolean().optional(),
            language: z.enum(['bn', 'en']).optional(),
            theme: z.enum(['light', 'dark']).optional(),
          })
          .parse(req.body);
        const user = await User.findByIdAndUpdate(
          profile(req),
          {
            $set: Object.fromEntries(
              Object.entries(input).map(([key, value]) => [`preferences.${key}`, value]),
            ),
          },
          { new: true },
        ).lean();
        if (!user) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Account not found.');
        res.json({
          success: true,
          data: { preferences: user.preferences, language: user.language },
          meta: {},
        });
      } catch (error) {
        next(error);
      }
    });
    router.get('/home', requireUser, async (req, res, next) => {
      try {
        const [urgentRequests, donor] = await Promise.all([
          BloodRequest.find({ status: 'approved', priority: 'urgent' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
          DonorProfile.findOne({ userId: profile(req) })
            .select('available nextEligibleDate')
            .lean(),
        ]);
        res.json({
          success: true,
          data: {
            urgentRequests: urgentRequests.map((item) => ({
              id: item._id.toString(),
              code: item.code,
              bloodGroup: item.bloodGroup,
              units: item.units,
              area: item.area,
              neededBy: item.neededBy,
            })),
            donorStatus: donor ?? null,
          },
          meta: {},
        });
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/me/donor-profile/steps/1', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        dob: z.coerce.date(),
        gender: z.string().min(1).max(30),
        phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
      })
      .parse(req.body);
    const age = (Date.now() - input.dob.getTime()) / 31557600000;
    if (age < 18)
      throw new AppError(400, 'DONOR_UNDERAGE', 'BL-200', 'Donors must be at least 18 years old.');
    const donor = await DonorProfile.findOneAndUpdate(
      { userId: profile(req) },
      { $set: { dob: input.dob, gender: input.gender, registrationStep: 2 } },
      { upsert: true, new: true },
    );
    await User.updateOne({ _id: profile(req) }, { $set: { phone: input.phone } });
    res.json({ success: true, data: { registrationStep: donor.registrationStep }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.put('/me/donor-profile/steps/2', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        division: z.string().min(1),
        district: z.string().min(1),
        area: z.string().min(1),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      })
      .parse(req.body);
    const location =
      input.lat !== undefined && input.lng !== undefined
        ? { type: 'Point' as const, coordinates: [fuzz(input.lng), fuzz(input.lat)] }
        : undefined;
    const precise =
      input.lat !== undefined && input.lng !== undefined
        ? { type: 'Point' as const, coordinates: [input.lng, input.lat] }
        : undefined;
    const donor = await DonorProfile.findOneAndUpdate(
      { userId: profile(req) },
      {
        $set: {
          ...input,
          ...(location ? { location, locationPrecise: precise } : {}),
          registrationStep: 3,
        },
      },
      { new: true, upsert: true },
    );
    res.json({ success: true, data: { registrationStep: donor.registrationStep }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.put('/me/donor-profile/steps/3', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
        lastDonationDate: z.coerce.date().optional(),
        weightKg: z.number().min(1).max(300),
        selfDeclaredHealthy: z.literal(true),
      })
      .parse(req.body);
    const donor = await DonorProfile.findOneAndUpdate(
      { userId: profile(req) },
      {
        $set: {
          ...input,
          nextEligibleDate: input.lastDonationDate
            ? nextEligible(input.lastDonationDate)
            : undefined,
          healthDeclaredAt: new Date(),
          registrationStep: 4,
        },
      },
      { new: true, upsert: true },
    );
    res.json({ success: true, data: { registrationStep: donor.registrationStep }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.put('/me/donor-profile/steps/4', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        consents: z.array(z.object({ type: z.string().min(1), version: z.string().min(1) })).min(3),
      })
      .parse(req.body);
    const now = new Date();
    const donor = await DonorProfile.findOneAndUpdate(
      { userId: profile(req) },
      {
        $set: {
          consents: input.consents.map((consent) => ({
            ...consent,
            acceptedAt: now,
            ip: req.ip,
            userAgent: req.get('user-agent') ?? '',
          })),
          registrationStep: 4,
          registrationCompletedAt: now,
          available: true,
        },
      },
      { new: true, upsert: true },
    );
    res.json({
      success: true,
      data: { registrationStep: donor.registrationStep, available: donor.available },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.patch('/me/availability', requireUser, async (req, res, next) => {
  try {
    const input = z.object({ available: z.boolean() }).parse(req.body);
    const donor = await DonorProfile.findOneAndUpdate(
      { userId: profile(req) },
      { $set: { available: input.available } },
      { new: true },
    );
    if (!donor) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Donor profile not found.');
    res.json({
      success: true,
      data: {
        available: donor.available,
        nextEligibleDate: donor.nextEligibleDate,
        warning:
          donor.nextEligibleDate && donor.nextEligibleDate > new Date() ? 'RECENT_DONATION' : null,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/donors/:userId', async (req, res, next) => {
  try {
    const donor = await DonorProfile.findOne({ userId: req.params.userId, available: true }).lean();
    const user = await User.findById(req.params.userId).lean();
    if (!donor || !user || user.status !== 'active')
      throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Donor not found.');
    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        displayName: user.name,
        area: donor.area,
        bloodGroup: donor.bloodGroup,
        phoneVerified: user.phoneVerified,
        donationsCount: donor.donationsCount,
        available: donor.available,
        lastDonationDate: donor.lastDonationDate?.toISOString().slice(0, 10),
        languages: donor.languages,
        bio: donor.bio,
      },
      meta: {},
    });
    router.get('/donors', requireUser, async (req, res, next) => {
      try {
        const filter: Record<string, unknown> = { available: true };
        if (typeof req.query.bloodGroup === 'string') filter.bloodGroup = req.query.bloodGroup;
        if (typeof req.query.district === 'string') filter.district = req.query.district;
        const donors = await DonorProfile.find(filter).limit(50).lean();
        const users = await User.find({
          _id: { $in: donors.map((donor) => donor.userId) },
          status: 'active',
        })
          .select('name phoneVerified')
          .lean();
        const byId = new Map(users.map((user) => [user._id.toString(), user]));
        res.json({
          success: true,
          data: donors.flatMap((donor) => {
            const user = byId.get(donor.userId.toString());
            return user
              ? [
                  {
                    id: user._id.toString(),
                    displayName: user.name,
                    bloodGroup: donor.bloodGroup,
                    area: donor.area,
                    phoneVerified: user.phoneVerified,
                  },
                ]
              : [];
          }),
          meta: {},
        });
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});
router.post('/me/devices', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        fcmToken: z.string().min(10),
        platform: z.string(),
        appVersion: z.string(),
        locale: z.enum(['bn', 'en']).default('bn'),
      })
      .parse(req.body);
    const device = await Device.findOneAndUpdate(
      { fcmToken: input.fcmToken },
      { $set: { ...input, userId: profile(req), lastSeenAt: new Date() } },
      { upsert: true, new: true },
    );
    res.json({ success: true, data: { id: device.id }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.post('/users/:id/block', requireUser, async (req, res, next) => {
  try {
    await Block.updateOne(
      { blockerId: profile(req), blockedId: req.params.id },
      { $setOnInsert: { blockerId: profile(req), blockedId: req.params.id } },
      { upsert: true },
    );
    res.status(201).json({ success: true, data: { blocked: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.delete('/users/:id/block', requireUser, async (req, res, next) => {
  try {
    await Block.deleteOne({ blockerId: profile(req), blockedId: req.params.id });
    res.json({ success: true, data: { blocked: false }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
