import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/auth.js';
import { createDrivers } from '../../services/drivers.js';
import { AppError } from '../../middleware/error.js';

const router = Router();
const drivers = createDrivers();
const purposeSchema = z.enum(['chat_image', 'chat_audio', 'chat_file', 'report_evidence']);
const mimeByPurpose: Record<string, RegExp> = {
  chat_image: /^image\//,
  chat_audio: /^audio\//,
  chat_file: /^application\/pdf$/,
  report_evidence: /^image\/|^application\/pdf$/,
};
router.post('/sign', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        purpose: purposeSchema,
        mime: z.string().min(1),
        bytes: z.number().int().positive(),
      })
      .parse(req.body);
    const maxBytes = input.purpose === 'chat_audio' ? 5_000_000 : 5_000_000;
    if (input.bytes > maxBytes || !mimeByPurpose[input.purpose]?.test(input.mime))
      throw new AppError(400, 'VALIDATION_ERROR', 'BL-400', 'The upload is not allowed.');
    const signature = await drivers.storage.signUpload(req.auth?.userId ?? '', input.purpose);
    res.json({ success: true, data: signature, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
