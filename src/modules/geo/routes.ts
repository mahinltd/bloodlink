import { Router } from 'express';
import { z } from 'zod';
import { GeoArea, GeoDistrict, GeoDivision, Hospital } from '../../models/Reference.js';
import { requireUser } from '../../middleware/auth.js';

const router = Router();
router.get('/divisions', async (_req, res, next) => {
  try {
    const items = await GeoDivision.find().sort({ order: 1 }).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.get('/districts', async (req, res, next) => {
  try {
    const division = z.string().min(1).parse(req.query.division);
    const items = await GeoDistrict.find({ division }).sort({ order: 1 }).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.get('/areas', async (req, res, next) => {
  try {
    const district = z.string().min(1).parse(req.query.district);
    const items = await GeoArea.find({ district }).sort({ order: 1 }).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
router.get('/hospitals', requireUser, async (req, res, next) => {
  try {
    const q = z.string().trim().min(1).max(100).parse(req.query.q);
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const filter = district ? { $text: { $search: q }, district } : { $text: { $search: q } };
    const items = await Hospital.find(filter).limit(20).lean();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (error) {
    next(error);
  }
});
export default router;
