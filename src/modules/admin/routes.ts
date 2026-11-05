import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { requireRole } from '../../middleware/rbac.js';
import { AdminUser } from '../../models/AdminUser.js';
import { User } from '../../models/User.js';
import { BloodRequest } from '../../models/BloodRequest.js';
import { Report } from '../../models/Community.js';
import { AppConfig } from '../../models/AppConfig.js';
import { CmsString } from '../../models/CmsString.js';
import { FeatureFlag } from '../../models/FeatureFlag.js';
import { AppRelease } from '../../models/AppRelease.js';
import { ProviderSetting, SupportPayment, AuditLog } from '../../models/AdminOperations.js';
import { sendOtp, verifyOtp } from '../../services/otp.js';
import { issueTokens } from '../../services/tokens.js';
import { verifyAuditChain, writeAudit } from '../../services/audit.js';
import { clearSettingsCache } from '../../services/settings.js';
import { AppError } from '../../middleware/error.js';

const router = Router();
router.post('/auth/login', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const admin = await AdminUser.findOne({
      email: input.email.toLowerCase(),
      status: 'active',
    }).select('+passwordHash');
    if (!admin || !(await argon2.verify(admin.passwordHash, input.password)))
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'BL-102',
        'The email or password is incorrect.',
      );
    const challengeId = nanoid(24);
    await sendOtp(`${challengeId}:${admin.email}`, 'admin_2fa', admin.email);
    res.json({ success: true, data: { challengeId }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.post('/auth/verify-2fa', async (req, res, next) => {
  try {
    const input = z
      .object({
        challengeId: z.string().min(1),
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(req.body);
    await verifyOtp(`${input.challengeId}:${input.email.toLowerCase()}`, 'admin_2fa', input.code);
    const admin = await AdminUser.findOne({ email: input.email.toLowerCase() });
    if (!admin) throw new AppError(401, 'UNAUTHORIZED', 'BL-401', 'Please sign in.');
    const tokens = await issueTokens(admin.id, 'admin', undefined, req.ip);
    await writeAudit({
      actorId: admin.id,
      actorName: admin.name,
      actorRole: admin.role,
      event: 'ADMIN_SIGN_IN',
      result: 'success',
      ip: req.ip,
    });
    res.json({
      success: true,
      data: {
        tokens,
        admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/me', requireAdmin, async (req, res, next) => {
  try {
    const admin = await AdminUser.findById(req.auth?.userId).lean();
    res.json({
      success: true,
      data: admin
        ? { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role }
        : null,
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/overview', requireAdmin, async (_req, res, next) => {
  try {
    const [donors, activeRequests, pendingReports, completedConnections] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      BloodRequest.countDocuments({ status: 'approved' }),
      Report.countDocuments({ status: { $in: ['open', 'in_review'] } }),
      BloodRequest.countDocuments({ status: 'fulfilled' }),
    ]);
    const byDivision = await Promise.all(
      [
        'Barishal',
        'Chattogram',
        'Dhaka',
        'Khulna',
        'Mymensingh',
        'Rajshahi',
        'Rangpur',
        'Sylhet',
      ].map(async (division) => ({
        division,
        completed: await BloodRequest.countDocuments({ division, status: 'fulfilled' }),
      })),
    );
    res.json({
      success: true,
      data: {
        kpis: {
          donors: { total: donors },
          activeRequests: { total: activeRequests },
          completedConnections: { total: completedConnections },
          pendingReports: { total: pendingReports },
        },
        byDivision,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const filter = q
      ? {
          $or: [
            { name: new RegExp(q, 'i') },
            { email: new RegExp(q, 'i') },
            { code: new RegExp(q, 'i') },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      User.find(filter)
        .select('code email name status phoneVerified createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: items.map((item) => ({
        id: item._id.toString(),
        code: item.code,
        email: item.email,
        name: item.name,
        status: item.status,
        phoneVerified: item.phoneVerified,
        createdAt: item.createdAt,
      })),
      meta: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});
router.get('/reports', requireAdmin, async (_req, res, next) => {
  try {
    const items = await Report.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.post(
  '/requests/:id/approve',
  requireAdmin,
  requireRole('super_admin', 'admin', 'moderator'),
  async (req, res, next) => {
    try {
      const before = await BloodRequest.findById(req.params.id).lean();
      const item = await BloodRequest.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ['pending_review', 'needs_info'] } },
        {
          $set: {
            status: 'approved',
            'moderation.reviewedBy': req.auth?.userId,
            'moderation.reviewedAt': new Date(),
          },
        },
        { new: true },
      ).lean();
      if (!item)
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
      await writeAudit({
        actorId: req.auth?.userId ?? '',
        event: 'REQUEST_APPROVED',
        resourceType: 'BloodRequest',
        resourceId: item._id.toString(),
        result: 'success',
        before,
        after: item,
        ip: req.ip,
      });
      res.json({ success: true, data: { id: item._id.toString(), status: item.status }, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
router.get('/app-config', requireAdmin, async (_req, res, next) => {
  try {
    const [draft, published] = await Promise.all([
      AppConfig.findOne({ status: 'draft' }).sort({ version: -1 }).lean(),
      AppConfig.findOne({ status: 'published' }).sort({ version: -1 }).lean(),
    ]);
    res.json({ success: true, data: { draft, published }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.put(
  '/app-config/draft',
  requireAdmin,
  requireRole('super_admin'),
  async (req, res, next) => {
    try {
      const input = z.record(z.string(), z.unknown()).parse(req.body);
      const draft = await AppConfig.findOneAndUpdate(
        { status: 'draft' },
        { $set: { ...input, status: 'draft' } },
        { upsert: true, new: true },
      );
      await writeAudit({
        actorId: req.auth?.userId ?? '',
        event: 'CONFIG_DRAFT_SAVED',
        resourceType: 'AppConfig',
        resourceId: draft.id,
        result: 'success',
        after: draft,
        ip: req.ip,
      });
      res.json({ success: true, data: draft, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/app-config/publish',
  requireAdmin,
  requireRole('super_admin'),
  async (req, res, next) => {
    try {
      const draft = await AppConfig.findOne({ status: 'draft' }).sort({ version: -1 });
      if (!draft) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Draft configuration not found.');
      draft.status = 'published';
      draft.version += 1;
      if (req.auth?.userId) draft.publishedBy = req.auth.userId;
      draft.publishedAt = new Date();
      await draft.save();
      clearSettingsCache();
      await writeAudit({
        actorId: req.auth?.userId ?? '',
        event: 'CONFIG_PUBLISHED',
        resourceType: 'AppConfig',
        resourceId: draft.id,
        result: 'success',
        after: draft,
        ip: req.ip,
      });
      res.json({ success: true, data: draft, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
router.get('/cms/strings', requireAdmin, async (_req, res, next) => {
  try {
    const items = await CmsString.find().sort({ key: 1 }).limit(100).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.post(
  '/cms/strings',
  requireAdmin,
  requireRole('super_admin', 'content_editor'),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          key: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_.]+$/),
          bn: z.string().min(1),
          en: z.string().min(1),
          screen: z.string().min(1),
        })
        .parse(req.body);
      const item = await CmsString.create({
        ...input,
        status: 'draft',
        version: 1,
        updatedBy: req.auth?.userId,
      });
      await writeAudit({
        actorId: req.auth?.userId ?? '',
        event: 'CMS_DRAFT_SAVED',
        resourceType: 'CmsString',
        resourceId: item.id,
        result: 'success',
        after: item,
        ip: req.ip,
      });
      res.status(201).json({ success: true, data: item, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
router.get('/flags', requireAdmin, async (_req, res, next) => {
  try {
    const items = await FeatureFlag.find().lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.put(
  '/flags/:key',
  requireAdmin,
  requireRole('super_admin', 'admin'),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          environment: z.enum(['demo', 'staging', 'production']),
          enabled: z.boolean(),
          rolloutPercent: z.number().min(0).max(100),
          reason: z.string().min(1).max(500),
        })
        .parse(req.body);
      const item = await FeatureFlag.findOneAndUpdate(
        { key: req.params.key, environment: input.environment },
        { $set: { ...input, updatedBy: req.auth?.userId, lastReason: input.reason } },
        { new: true },
      );
      if (!item) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Feature flag not found.');
      clearSettingsCache();
      await writeAudit({
        actorId: req.auth?.userId ?? '',
        event: 'FLAG_UPDATED',
        resourceType: 'FeatureFlag',
        resourceId: item.id,
        result: 'success',
        after: item,
        ip: req.ip,
      });
      res.json({ success: true, data: item, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
router.get('/releases', requireAdmin, async (_req, res, next) => {
  try {
    const items = await AppRelease.find().sort({ versionCode: -1 }).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.post(
  '/releases',
  requireAdmin,
  requireRole('super_admin', 'admin'),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          versionCode: z.number().int().positive(),
          versionName: z.string().min(1),
          channel: z.enum(['stable', 'beta']),
          apkUrl: z.string().url().startsWith('https://'),
          notes: z.object({ bn: z.string(), en: z.string() }),
          mandatory: z.boolean(),
          minSupportedVersionCode: z.number().int().nonnegative(),
          rolloutPercent: z.number().min(0).max(100),
        })
        .parse(req.body);
      const item = await AppRelease.create({
        ...input,
        status: 'draft',
        publishedBy: req.auth?.userId,
      });
      res.status(201).json({ success: true, data: item, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
router.get('/audit', requireAdmin, requireRole('super_admin', 'admin'), async (_req, res, next) => {
  try {
    const items = await AuditLog.find().sort({ ts: -1 }).limit(100).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.get(
  '/audit/verify',
  requireAdmin,
  requireRole('super_admin', 'admin'),
  async (_req, res, next) => {
    try {
      const items = await AuditLog.find().sort({ ts: 1 }).lean();
      const result = verifyAuditChain(items as unknown as Array<Record<string, unknown>>);
      res.json({ success: true, data: result, meta: { checked: items.length } });
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  '/audit/export',
  requireAdmin,
  requireRole('super_admin', 'admin'),
  async (_req, res, next) => {
    try {
      const items = await AuditLog.find().sort({ ts: 1 }).lean();
      res.type('application/json').send(JSON.stringify(items));
    } catch (error) {
      next(error);
    }
  },
);
router.get('/support/providers', requireAdmin, async (_req, res, next) => {
  try {
    const items = await ProviderSetting.find().lean();
    res.json({ success: true, data: items, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.get(
  '/support/payments',
  requireAdmin,
  requireRole('super_admin', 'admin', 'finance'),
  async (_req, res, next) => {
    try {
      const items = await SupportPayment.find().sort({ createdAt: -1 }).limit(100).lean();
      res.json({ success: true, data: items, meta: { total: items.length } });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/support/payments/:id/confirm',
  requireAdmin,
  requireRole('super_admin', 'finance'),
  async (req, res, next) => {
    try {
      const item = await SupportPayment.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        { $set: { status: 'success', verifiedBy: req.auth?.userId, verifiedAt: new Date() } },
        { new: true },
      );
      if (!item) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Payment not found.');
      await writeAudit({
        actorId: req.auth?.userId ?? '',
        event: 'SUPPORT_CONFIRMED',
        resourceType: 'SupportPayment',
        resourceId: item.id,
        result: 'success',
        after: item,
        ip: req.ip,
      });
      res.json({ success: true, data: item, meta: {} });
    } catch (error) {
      next(error);
    }
  },
);
export default router;
