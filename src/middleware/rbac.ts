import type { RequestHandler } from 'express';
import { AppError } from './error.js';
import { AdminUser } from '../models/AdminUser.js';

export function requireRole(
  ...roles: Array<'super_admin' | 'admin' | 'moderator' | 'content_editor' | 'finance'>
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const admin = await AdminUser.findById(req.auth?.userId).lean();
      if (!admin || !roles.includes(admin.role))
        return next(
          new AppError(403, 'FORBIDDEN', 'BL-403', 'You are not allowed to perform this action.'),
        );
      next();
    } catch (error) {
      next(error);
    }
  };
}
