import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/auth.js';
import { Donation, Notification, Report, Review } from '../../models/Community.js';
import { nextCode } from '../../services/counter.js';
import { scanMoneyKeywords } from '../../services/moderation.js';
import { AppError } from '../../middleware/error.js';
import { SupportPayment } from '../../models/AdminOperations.js';

const router = Router();
router.post('/support/payments', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        provider: z.enum(['bkash', 'nagad', 'rocket']),
        amount: z.number().positive(),
        trxId: z.string().min(3).max(100),
        senderLast4: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
      })
      .parse(req.body);
    const payment = await SupportPayment.create({
      ...input,
      userId: req.auth?.userId,
      status: 'pending',
      code: await nextCode('support_payment'),
    });
    res.status(201).json({
      success: true,
      data: { id: payment.id, code: payment.code, status: payment.status },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.get('/me/donations', requireUser, async (req, res, next) => {
  try {
    const items = await Donation.find({ donorId: req.auth?.userId })
      .sort({ date: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: items, meta: { totalCount: items.length } });
  } catch (error) {
    next(error);
  }
});
router.post('/me/donations', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        date: z.coerce.date(),
        hospitalName: z.string().min(1).max(200),
        bloodGroup: z.string().min(1),
        units: z.number().int().min(1).max(10),
        recipientName: z.string().max(120).optional(),
      })
      .parse(req.body);
    const donation = await Donation.create({
      ...input,
      donorId: req.auth?.userId,
      source: 'self_reported',
    });
    res.status(201).json({ success: true, data: donation, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.post('/donations/:id/review', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        rating: z.number().int().min(1).max(5),
        text: z.string().max(300),
        anonymous: z.boolean(),
      })
      .parse(req.body);
    const donation = await Donation.findById(req.params.id).lean();
    if (!donation) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Donation not found.');
    const review = await Review.create({
      ...input,
      donationId: donation._id,
      authorId: req.auth?.userId,
      targetUserId: donation.donorId,
    });
    res.status(201).json({
      success: true,
      data: {
        id: review.id,
        rating: review.rating,
        text: review.text,
        anonymous: review.anonymous,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
router.post('/reports', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        targetUserId: z.string().min(1),
        requestId: z.string().optional(),
        reason: z.enum(['money_demand', 'fake_or_misleading', 'harassment', 'spam_other']),
        description: z.string().min(1).max(2000),
        evidence: z.array(z.record(z.string(), z.unknown())).max(5).default([]),
        anonymous: z.boolean().default(true),
        alsoBlock: z.boolean().default(false),
      })
      .parse(req.body);
    const hits = await scanMoneyKeywords(input.description);
    const report = await Report.create({
      ...input,
      code: await nextCode('report'),
      reporterId: req.auth?.userId,
      priority: input.reason === 'money_demand' || hits.length ? 'high' : 'normal',
    });
    res.status(201).json({ success: true, data: { code: report.code }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.get('/notifications', requireUser, async (req, res, next) => {
  try {
    const items = await Notification.find({ userId: req.auth?.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.post('/notifications/read', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() })
      .parse(req.body);
    const filter = input.all
      ? { userId: req.auth?.userId }
      : { userId: req.auth?.userId, _id: { $in: input.ids ?? [] } };
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    res.json({ success: true, data: { read: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
