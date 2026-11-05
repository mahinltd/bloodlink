import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from '../../models/User.js';
import { Session } from '../../models/Session.js';
import { AppError } from '../../middleware/error.js';
import { issueTokens, rotateRefreshToken } from '../../services/tokens.js';
import { nextCode } from '../../services/counter.js';
import { sendOtp, verifyOtp } from '../../services/otp.js';

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  password: z.string().min(8),
  acceptTerms: z.literal(true),
  language: z.enum(['bn', 'en']).default('bn'),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().default(true),
  device: z.record(z.string(), z.unknown()).optional(),
  fcmToken: z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    if (await User.exists({ email }))
      throw new AppError(409, 'CONFLICT', 'BL-409', 'An account already exists for this email.');
    const user = await User.create({
      code: await nextCode('user'),
      email,
      phone: input.phone,
      name: input.name,
      passwordHash: await argon2.hash(input.password),
      language: input.language,
    });
    const otp = await sendOtp(email, 'verify_email');
    res.status(201).json({
      success: true,
      data: { id: user.id, code: user.code, otp: { sentTo: email, ...otp } },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const input = z
      .object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
        device: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(req.body);
    const email = input.email.toLowerCase();
    await verifyOtp(email, 'verify_email', input.code);
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { emailVerified: true, status: 'active' } },
      { new: true },
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'BL-404', 'Account not found.');
    const tokens = await issueTokens(user.id, 'user', input.device, req.ip);
    res.json({
      success: true,
      data: { user: { id: user.id, code: user.code, name: user.name, email: user.email }, tokens },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/resend-otp', async (req, res, next) => {
  try {
    const input = z
      .object({ email: z.string().email(), purpose: z.enum(['verify_email', 'reset']) })
      .parse(req.body);
    const otp = await sendOtp(input.email.toLowerCase(), input.purpose);
    res.json({ success: true, data: { otp }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, input.password)))
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'BL-102',
        'The email or password is incorrect.',
      );
    if (user.status === 'suspended')
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'BL-101', 'The account is suspended.');
    if (!user.emailVerified)
      throw new AppError(403, 'EMAIL_UNVERIFIED', 'BL-100', 'Email is not verified.');
    user.lastLoginAt = new Date();
    await user.save();
    const tokens = await issueTokens(user.id, 'user', input.device, req.ip, input.rememberMe);
    res.json({
      success: true,
      data: { user: { id: user.id, code: user.code, name: user.name, email: user.email }, tokens },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const input = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    res.json({
      success: true,
      data: await rotateRefreshToken(input.refreshToken, 'user'),
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const input = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    const result = await Session.updateOne(
      {
        refreshHash: (await import('../../services/tokens.js')).hashToken(input.refreshToken),
        subjectType: 'user',
      },
      { $set: { revokedAt: new Date() } },
    );
    res.json({ success: true, data: { revoked: result.modifiedCount > 0 }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email() }).parse(req.body);
    if (await User.exists({ email: input.email.toLowerCase() }))
      await sendOtp(input.email.toLowerCase(), 'reset');
    res.json({ success: true, data: { accepted: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const input = z
      .object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
        password: z.string().min(8),
      })
      .parse(req.body);
    await verifyOtp(input.email.toLowerCase(), 'reset', input.code);
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) return res.json({ success: true, data: { reset: true }, meta: {} });
    user.passwordHash = await argon2.hash(input.password);
    await user.save();
    await Session.updateMany(
      { subjectId: user._id, subjectType: 'user' },
      { $set: { revokedAt: new Date() } },
    );
    res.json({ success: true, data: { reset: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});

export default router;
