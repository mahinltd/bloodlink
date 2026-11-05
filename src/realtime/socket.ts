import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../services/tokens.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { scanMoneyKeywords } from '../services/moderation.js';

type Ack = (response: { success: boolean; data?: unknown; error?: { code: string } }) => void;
export function attachSocket(server: HttpServer): Server {
  const io = new Server(server, { cors: { origin: true, credentials: true } });
  io.use((socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : '';
      const payload = verifyAccessToken(token, 'user');
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    socket.on('presence:ping', (ack?: Ack) =>
      ack?.({ success: true, data: { at: new Date().toISOString() } }),
    );
    socket.on('typing:start', (payload: { conversationId: string }, ack?: Ack) => {
      void relayToPeer(io, userId, payload.conversationId, 'typing', { active: true });
      ack?.({ success: true });
    });
    socket.on('typing:stop', (payload: { conversationId: string }, ack?: Ack) => {
      void relayToPeer(io, userId, payload.conversationId, 'typing', { active: false });
      ack?.({ success: true });
    });
    socket.on(
      'message:read',
      async (payload: { conversationId: string; upToMessageId: string }, ack?: Ack) => {
        const conversation = await Conversation.findOne({
          _id: payload.conversationId,
          participants: userId,
        });
        if (!conversation) return ack?.({ success: false, error: { code: 'FORBIDDEN' } });
        await Message.updateMany(
          {
            conversationId: conversation._id,
            senderId: { $ne: userId },
            _id: { $lte: payload.upToMessageId },
          },
          { $set: { status: 'read', readAt: new Date() } },
        );
        ack?.({ success: true });
      },
    );
    socket.on(
      'message:send',
      async (
        payload: {
          conversationId: string;
          clientMessageId: string;
          type: string;
          text?: string;
          media?: unknown;
          location?: unknown;
        },
        ack?: Ack,
      ) => {
        try {
          const conversation = await Conversation.findOne({
            _id: payload.conversationId,
            participants: userId,
          });
          if (!conversation) return ack?.({ success: false, error: { code: 'FORBIDDEN' } });
          const existing = await Message.findOne({
            conversationId: conversation._id,
            clientMessageId: payload.clientMessageId,
          });
          if (existing) return ack?.({ success: true, data: existing });
          const flags = payload.text ? await scanMoneyKeywords(payload.text) : [];
          const message = await Message.create({ ...payload, senderId: userId, flags });
          ack?.({ success: true, data: message });
          const peer = conversation.participants.find((item) => item.toString() !== userId);
          if (peer) io.to(`user:${peer.toString()}`).emit('message:new', message);
        } catch {
          ack?.({ success: false, error: { code: 'INTERNAL_ERROR' } });
        }
      },
    );
  });
  return io;
}

async function relayToPeer(
  io: Server,
  userId: string,
  conversationId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).lean();
  const peer = conversation?.participants.find((item) => item.toString() !== userId);
  if (peer)
    io.to(`user:${peer.toString()}`).emit(event, {
      conversationId,
      userId,
      ...((data ?? {}) as object),
    });
}
