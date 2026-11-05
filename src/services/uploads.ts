import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

export function assertOwnedUploadUrl(value: unknown, userId: string, purpose: string): void {
  if (typeof value !== 'string')
    throw new AppError(400, 'VALIDATION_ERROR', 'BL-400', 'The upload URL is invalid.');
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !value.startsWith('https://'))
    throw new AppError(400, 'VALIDATION_ERROR', 'BL-400', 'The upload URL is invalid.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'BL-400', 'The upload URL is invalid.');
  }
  const folder = `/bloodlink/${purpose}/${userId}/`;
  if (
    url.hostname !== 'res.cloudinary.com' ||
    !url.pathname.includes(`/${cloudName}/`) ||
    !url.pathname.includes(folder)
  )
    throw new AppError(403, 'FORBIDDEN', 'BL-403', 'This upload does not belong to this account.');
}
