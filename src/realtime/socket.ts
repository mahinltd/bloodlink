import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../services/tokens.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { scanMoneyKeywords } from '../services/moderation.js';
import { corsOrigins } from '../config/env.js';

type Ack = (response: { success: boolean; data?: unknown; error?: { code: string } }) => void;
let activeIo: Server | undefined;
export function attachSocket(server: HttpServer): Server {
  const io = new Server(server, { cors: { origin: corsOrigins, credentials: true } });
  activeIo = io;
  const connectedUsers = new Map<string, number>();
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
    const connectionCount = (connectedUsers.get(userId) ?? 0) + 1;
    connectedUsers.set(userId, connectionCount);
    if (connectionCount === 1) io.emit('presence:online', { userId });
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
        const peer = conversation.participants.find((item) => item.toString() !== userId);
        if (peer)
          io.to(`user:${peer.toString()}`).emit('message:seen', {
            conversationId: conversation.id,
            upToMessageId: payload.upToMessageId,
            userId,
          });
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
          if (peer) {
            io.to(`user:${peer.toString()}`).emit('message:new', message);
            io.to(`user:${peer.toString()}`).emit('message:delivered', {
              conversationId: conversation.id,
              messageId: message.id,
            });
          }
        } catch {
          ack?.({ success: false, error: { code: 'INTERNAL_ERROR' } });
        }
      },
    );
    for (const event of ['call:invite', 'call:accept', 'call:decline', 'call:end'] as const) {
      socket.on(event, (payload: { userId: string; callId: string }, ack?: Ack) => {
        if (!payload?.userId || !payload.callId)
          return ack?.({ success: false, error: { code: 'VALIDATION_ERROR' } });
        io.to(`user:${payload.userId}`).emit(event, {
          callId: payload.callId,
          userId,
        });
        ack?.({ success: true });
      });
    }
    socket.on('disconnect', () => {
      const remaining = (connectedUsers.get(userId) ?? 1) - 1;
      if (remaining > 0) connectedUsers.set(userId, remaining);
      else {
        connectedUsers.delete(userId);
        io.emit('presence:offline', { userId });
      }
    });
  });
  return io;
}

export function emitFlagChanged(io: Server, key: string, enabled: boolean): void {
  io.emit('flag:changed', { key, enabled });
}

export function broadcastFlagChanged(key: string, enabled: boolean): void {
  activeIo?.emit('flag:changed', { key, enabled });
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
