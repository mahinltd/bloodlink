import type { RequestHandler } from 'express';
import { AppError } from './error.js';
import { verifyAccessToken } from '../services/tokens.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string; sessionId: string; subjectType: 'user' | 'admin' };
  }
}

export const requireUser: RequestHandler = (req, _res, next) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new AppError(401, 'UNAUTHORIZED', 'BL-401', 'Please sign in.'));
  try {
    const payload = verifyAccessToken(token, 'user');
    req.auth = { userId: payload.sub, sessionId: payload.sid, subjectType: 'user' };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'BL-401', 'Please sign in.'));
  }
};
