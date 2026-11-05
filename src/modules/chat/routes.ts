import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/auth.js';
import { Conversation } from '../../models/Conversation.js';
import { Message } from '../../models/Message.js';
import { Block } from '../../models/Block.js';
import { User } from '../../models/User.js';
import { scanMoneyKeywords } from '../../services/moderation.js';
import { AppError } from '../../middleware/error.js';

const router = Router();
const current = (req: Request): string => req.auth?.userId ?? '';
const pairKey = (a: string, b: string): string => [a, b].sort().join(':');

router.get('/conversations', requireUser, async (req, res, next) => {
  try {
    const items = await Conversation.find({ participants: current(req) })
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean();
    res.json({
      success: true,
      data: items.map((item) => ({
        id: item._id.toString(),
        participants: item.participants.map(String),
        lastMessage: item.lastMessage,
        lastMessageAt: item.lastMessageAt,
        unreadCount: Number(
          (item.unread as Record<string, number> | undefined)?.[current(req)] ?? 0,
        ),
      })),
      meta: { total: items.length },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/conversations', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({ userId: z.string().min(1), requestId: z.string().optional() })
      .parse(req.body);
    if (input.userId === current(req))
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'BL-400',
        'You cannot start a conversation with yourself.',
      );
    if (
      await Block.exists({
        $or: [
          { blockerId: current(req), blockedId: input.userId },
          { blockerId: input.userId, blockedId: current(req) },
        ],
      })
    )
      throw new AppError(403, 'FORBIDDEN', 'BL-403', 'This conversation is blocked.');
    const user = await User.findById(input.userId).lean();
    if (!user || user.status !== 'active')
      throw new AppError(404, 'NOT_FOUND', 'BL-404', 'User not found.');
    const conversation = await Conversation.findOneAndUpdate(
      { pairKey: pairKey(current(req), input.userId) },
      {
        $setOnInsert: {
          pairKey: pairKey(current(req), input.userId),
          participants: [current(req), input.userId],
          requestId: input.requestId,
        },
      },
      { upsert: true, new: true },
    );
    res.status(201).json({
      success: true,
      data: { id: conversation.id, participants: conversation.participants },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:id/messages', requireUser, async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: current(req),
    });
    if (!conversation) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Conversation not found.');
    const limit = Math.min(Number(req.query.limit ?? 30), 50);
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
    res.json({
      success: true,
      data: messages,
      meta: { nextCursor: messages.at(-1)?._id.toString() ?? null },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:id/messages', requireUser, async (req, res, next) => {
  try {
    const input = z
      .object({
        clientMessageId: z.string().min(1).max(100),
        type: z.enum(['text', 'image', 'audio', 'file', 'location', 'system']),
        text: z.string().max(5000).optional(),
        media: z.record(z.string(), z.unknown()).optional(),
        location: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(req.body);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: current(req),
    });
    if (!conversation) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Conversation not found.');
    const existing = await Message.findOne({
      conversationId: conversation._id,
      clientMessageId: input.clientMessageId,
    });
    if (existing) return res.json({ success: true, data: existing, meta: { idempotent: true } });
    const flags = input.text ? await scanMoneyKeywords(input.text) : [];
    const message = await Message.create({
      ...input,
      conversationId: conversation._id,
      senderId: current(req),
      flags,
    });
    const peer = conversation.participants.find((id) => id.toString() !== current(req));
    const unread = { ...((conversation.unread as Record<string, number> | undefined) ?? {}) };
    if (peer) unread[peer.toString()] = (unread[peer.toString()] ?? 0) + 1;
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: {
            type: message.type,
            preview: message.type === 'text' ? message.text?.slice(0, 100) : message.type,
            senderId: current(req),
            at: new Date(),
          },
          lastMessageAt: new Date(),
          unread,
        },
      },
    );
    res.status(201).json({ success: true, data: message, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:id/read', requireUser, async (req, res, next) => {
  try {
    await Message.updateMany(
      { conversationId: req.params.id, senderId: { $ne: current(req) }, status: { $ne: 'read' } },
      { $set: { status: 'read', readAt: new Date() } },
    );
    await Conversation.updateOne(
      { _id: req.params.id, participants: current(req) },
      { $set: { [`unread.${current(req)}`]: 0 } },
    );
    res.json({ success: true, data: { read: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});
export default router;
