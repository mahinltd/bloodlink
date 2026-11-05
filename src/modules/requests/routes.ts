import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/auth.js';
import { BloodRequest } from '../../models/BloodRequest.js';
import { Pledge } from '../../models/Pledge.js';
import { DonorProfile } from '../../models/DonorProfile.js';
import { nextCode } from '../../services/counter.js';
import { scanMoneyKeywords } from '../../services/moderation.js';
import { isCompatible } from '../../services/compatibility.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../config/env.js';

const router = Router();
const requestInput = z.object({
  patientName: z.string().trim().min(1).max(120),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
  units: z.number().int().min(1).max(10),
  hospitalId: z.string().optional(),
  hospitalNameText: z.string().trim().min(1).max(200),
  division: z.string().min(1),
  district: z.string().min(1),
  area: z.string().min(1),
  neededBy: z.coerce.date(),
  priority: z.enum(['urgent', 'routine']),
  contactPhone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  notes: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

router.post('/', requireUser, async (req, res, next) => {
  try {
    const input = requestInput.parse(req.body);
    if (input.neededBy <= new Date())
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'BL-400',
        'The needed-by date must be in the future.',
      );
    const hits = await scanMoneyKeywords(`${input.notes ?? ''} ${input.hospitalNameText}`);
    const request = await BloodRequest.create({
      ...input,
      code: await nextCode('request'),
      requesterId: req.auth?.userId,
      status: hits.length ? 'pending_review' : 'approved',
      hospitalVerified: Boolean(input.hospitalId),
      moderation: { flags: hits, noMoneyKeywords: hits.length === 0 },
      location:
        input.lat !== undefined && input.lng !== undefined
          ? { type: 'Point', coordinates: [input.lng, input.lat] }
          : undefined,
    });
    res.status(201).json({
      success: true,
      data: {
        id: request.id,
        code: request.code,
        status: request.status,
        shareUrl: `${env.WEB_URL}/r/${request.code}`,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireUser, async (req, res, next) => {
  try {
    const tab = z.enum(['all', 'urgent', 'mine']).catch('all').parse(req.query.tab);
    const filter: Record<string, unknown> =
      tab === 'mine'
        ? { requesterId: req.auth?.userId }
        : { status: 'approved', ...(tab === 'urgent' ? { priority: 'urgent' } : {}) };
    if (typeof req.query.bloodGroup === 'string') filter.bloodGroup = req.query.bloodGroup;
    if (typeof req.query.division === 'string') filter.division = req.query.division;
    const items = await BloodRequest.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      success: true,
      data: items.map((item) => ({
        id: item._id.toString(),
        code: item.code,
        patientName: item.patientName,
        bloodGroup: item.bloodGroup,
        units: item.units,
        hospitalName: item.hospitalNameText,
        area: item.area,
        neededBy: item.neededBy,
        priority: item.priority,
        status: item.status,
      })),
      meta: {
        total: items.length,
        urgentCount: items.filter((item) => item.priority === 'urgent').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireUser, async (req, res, next) => {
  try {
    const item = await BloodRequest.findById(req.params.id).select('+contactPhone').lean();
    if (!item)
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
    const owner = item.requesterId.toString() === req.auth?.userId;
    res.json({
      success: true,
      data: {
        id: item._id.toString(),
        code: item.code,
        patientName: item.patientName,
        bloodGroup: item.bloodGroup,
        units: item.units,
        hospitalName: item.hospitalNameText,
        area: item.area,
        neededBy: item.neededBy,
        priority: item.priority,
        status: item.status,
        contactPhone: owner ? item.contactPhone : undefined,
        canEdit: owner,
        myPledge: await Pledge.findOne({ requestId: item._id, donorId: req.auth?.userId }).lean(),
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pledge', requireUser, async (req, res, next) => {
  try {
    const input = z.object({ note: z.string().max(300).optional() }).parse(req.body);
    const item = await BloodRequest.findOne({ _id: req.params.id, status: 'approved' }).lean();
    if (!item)
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
    if (item.requesterId.toString() === req.auth?.userId)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'BL-400',
        'You cannot pledge to your own request.',
      );
    const donor = await DonorProfile.findOne({ userId: req.auth?.userId }).lean();
    if (!donor?.bloodGroup || !isCompatible(item.bloodGroup, donor.bloodGroup))
      throw new AppError(403, 'FORBIDDEN', 'BL-403', 'This blood group is not compatible.');
    const pledge = await Pledge.create({
      requestId: item._id,
      donorId: req.auth?.userId,
      note: input.note,
    });
    await BloodRequest.updateOne({ _id: item._id }, { $inc: { pledgeCount: 1 } });
    res
      .status(201)
      .json({ success: true, data: { id: pledge.id, status: pledge.status }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/pledge', requireUser, async (req, res, next) => {
  try {
    const pledge = await Pledge.findOneAndUpdate(
      { requestId: req.params.id, donorId: req.auth?.userId },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    res.json({ success: true, data: { withdrawn: Boolean(pledge) }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pledges/:pledgeId/accept', requireUser, async (req, res, next) => {
  try {
    const request = await BloodRequest.findOne({
      _id: req.params.id,
      requesterId: req.auth?.userId,
    });
    if (!request)
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'BL-300', 'The blood request was not found.');
    const pledge = await Pledge.findOneAndUpdate(
      { _id: req.params.pledgeId, requestId: request._id, status: 'offered' },
      { $set: { status: 'accepted' } },
      { new: true },
    );
    if (!pledge) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'The pledge was not found.');
    res.json({ success: true, data: { id: pledge.id, status: pledge.status }, meta: {} });
  } catch (error) {
    next(error);
  }
});

export default router;
