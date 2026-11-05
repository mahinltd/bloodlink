import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/auth.js';
import { Call } from '../../models/Call.js';
import { Conversation } from '../../models/Conversation.js';
import { Block } from '../../models/Block.js';
import { createDrivers } from '../../services/drivers.js';
import { nextCode } from '../../services/counter.js';
import { AppError } from '../../middleware/error.js';

const router = Router();
const drivers = createDrivers();
const activeStates = ['ringing', 'accepted'] as const;
const uidFor = (id: string): number => {
  let value = 0;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value % 2_000_000_000;
};

router.post('/', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        calleeId: z.string().min(1),
        conversationId: z.string().min(1),
        requestId: z.string().optional(),
      })
      .parse(req.body);
    if (
      await Block.exists({
        $or: [
          { blockerId: req.auth?.userId, blockedId: input.calleeId },
          { blockerId: input.calleeId, blockedId: req.auth?.userId },
        ],
      })
    )
      throw new AppError(403, 'FORBIDDEN', 'BL-403', 'Calls are blocked between these users.');
    if (
      await Call.exists({
        $or: [{ callerId: req.auth?.userId }, { calleeId: req.auth?.userId }],
        state: { $in: activeStates },
      })
    )
      throw new AppError(409, 'USER_BUSY', 'BL-400', 'The user is currently busy on another call.');
    const conversation = await Conversation.findOne({
      _id: input.conversationId,
      participants: { $all: [req.auth?.userId, input.calleeId] },
    });
    if (!conversation) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Conversation not found.');
    const code = await nextCode('call');
    const call = await Call.create({
      code,
      callerId: req.auth?.userId,
      calleeId: input.calleeId,
      conversationId: input.conversationId,
      requestId: input.requestId,
      channel: `bl_${code}`,
    });
    const token = await drivers.caller.token(call.channel, uidFor(req.auth?.userId ?? ''), 3600);
    res.status(201).json({
      success: true,
      data: {
        callId: call.id,
        code,
        channel: token.channel,
        appId: token.appId,
        uid: token.uid,
        token: token.token,
        ringTimeoutSec: 45,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/accept', requireUser, async (req, res, next) => {
  try {
    const call = await Call.findOneAndUpdate(
      { _id: req.params.id, calleeId: req.auth?.userId, state: 'ringing' },
      { $set: { state: 'accepted', answeredAt: new Date() } },
      { new: true },
    );
    if (!call) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Call not found.');
    const token = await drivers.caller.token(call.channel, uidFor(req.auth?.userId ?? ''), 3600);
    res.json({ success: true, data: token, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/decline', requireUser, async (req, res, next) => {
  try {
    const call = await Call.findOneAndUpdate(
      { _id: req.params.id, calleeId: req.auth?.userId, state: 'ringing' },
      { $set: { state: 'declined', endReason: 'declined' } },
      { new: true },
    );
    if (!call) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Call not found.');
    res.json({ success: true, data: { state: call.state }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/cancel', requireUser, async (req, res, next) => {
  try {
    const call = await Call.findOneAndUpdate(
      { _id: req.params.id, callerId: req.auth?.userId, state: 'ringing' },
      { $set: { state: 'cancelled', endReason: 'cancelled' } },
      { new: true },
    );
    if (!call) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Call not found.');
    res.json({ success: true, data: { state: call.state }, meta: {} });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/end', requireUser, async (req, res, next) => {
  try {
    const call = await Call.findOne({
      _id: req.params.id,
      $or: [{ callerId: req.auth?.userId }, { calleeId: req.auth?.userId }],
      state: { $in: activeStates },
    });
    if (!call) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Call not found.');
    const endedAt = new Date();
    call.state = 'ended';
    call.endedAt = endedAt;
    call.durationSec = call.answeredAt
      ? Math.max(0, Math.floor((endedAt.getTime() - call.answeredAt.getTime()) / 1000))
      : 0;
    call.endReason = 'ended';
    await call.save();
    res.json({
      success: true,
      data: { state: call.state, durationSec: call.durationSec },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});
export default router;
