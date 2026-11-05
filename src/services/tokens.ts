import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Session } from '../models/Session.js';
import { nextCode } from './counter.js';
import { AppError } from '../middleware/error.js';

type SubjectType = 'user' | 'admin';
type TokenPayload = { sub: string; sid: string; type: SubjectType };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueTokens(
  subjectId: string,
  subjectType: SubjectType,
  device: unknown,
  ip: string | undefined,
  rememberMe = true,
) {
  const refreshToken = randomBytes(48).toString('base64url');
  const expiresAt = new Date(
    Date.now() +
      (subjectType === 'admin' ? 8 * 60 * 60_000 : rememberMe ? 30 * 86400_000 : 86400_000),
  );
  const session = await Session.create({
    code: await nextCode('session'),
    subjectType,
    subjectId,
    refreshHash: hashToken(refreshToken),
    device,
    ip,
    expiresAt,
  });
  const secret = subjectType === 'admin' ? env.ADMIN_JWT_SECRET : env.JWT_ACCESS_SECRET;
  const accessToken = jwt.sign(
    { sub: subjectId, sid: session._id.toString(), type: subjectType } satisfies TokenPayload,
    secret,
    {
      expiresIn: subjectType === 'admin' ? '10m' : '15m',
    },
  );
  return { accessToken, refreshToken, expiresAt, sessionCode: session.code };
}

export async function rotateRefreshToken(refreshToken: string, subjectType: SubjectType) {
  const session = await Session.findOne({
    refreshHash: hashToken(refreshToken),
    subjectType,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw new AppError(401, 'UNAUTHORIZED', 'BL-401', 'Please sign in again.');
  const nextRefresh = randomBytes(48).toString('base64url');
  session.refreshHash = hashToken(nextRefresh);
  await session.save();
  const secret = subjectType === 'admin' ? env.ADMIN_JWT_SECRET : env.JWT_ACCESS_SECRET;
  const accessToken = jwt.sign(
    {
      sub: session.subjectId.toString(),
      sid: session._id.toString(),
      type: subjectType,
    } satisfies TokenPayload,
    secret,
    { expiresIn: subjectType === 'admin' ? '10m' : '15m' },
  );
  return {
    accessToken,
    refreshToken: nextRefresh,
    expiresAt: session.expiresAt,
    sessionCode: session.code,
    subjectId: session.subjectId.toString(),
  };
}

export function verifyAccessToken(token: string, subjectType: SubjectType): TokenPayload {
  return jwt.verify(
    token,
    subjectType === 'admin' ? env.ADMIN_JWT_SECRET : env.JWT_ACCESS_SECRET,
  ) as TokenPayload;
}

export { hashToken };
