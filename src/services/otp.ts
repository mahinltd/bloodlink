import argon2 from 'argon2';
import { Otp } from '../models/Otp.js';
import { EmailTemplate } from '../models/Template.js';
import { User } from '../models/User.js';
import { createDrivers } from './drivers.js';
import { randomInt } from 'node:crypto';
import { AppError } from '../middleware/error.js';

const drivers = createDrivers();

export async function sendOtp(
  subject: string,
  purpose: 'verify_email' | 'admin_2fa' | 'reset',
  recipient = subject,
): Promise<{ expiresInSec: number; resendInSec: number }> {
  const recent = await Otp.findOne({
    subject,
    purpose,
    sentAt: { $gt: new Date(Date.now() - 30_000) },
  });
  if (recent)
    throw new AppError(
      429,
      'OTP_COOLDOWN',
      'BL-104',
      'Please wait before requesting another code.',
    );
  const code = String(randomInt(100000, 1000000));
  await Otp.deleteMany({ subject, purpose });
  await Otp.create({
    subject,
    purpose,
    codeHash: await argon2.hash(code),
    attempts: 0,
    expiresAt: new Date(Date.now() + 300_000),
    sentAt: new Date(),
  });
  const templateKey = purpose === 'reset' ? 'reset_password' : purpose;
  const template = await EmailTemplate.findOne({ key: templateKey, active: { $ne: false } }).lean();
  if (!template?.subject?.bn || !template.subject.en || !template.html?.bn || !template.html.en)
    throw new Error(`EMAIL_TEMPLATE_MISSING:${templateKey}`);
  const user =
    purpose === 'admin_2fa'
      ? null
      : await User.findOne({ email: subject }).select('language').lean();
  const language = user?.language === 'en' ? 'en' : 'bn';
  await drivers.mailer.send({
    to: recipient,
    subject: template.subject[language].replaceAll('{code}', code),
    html: template.html[language].replaceAll('{code}', code),
  });
  if (process.env.NODE_ENV !== 'production')
    console.info('[otp:console]', { subject, purpose, code });
  return { expiresInSec: 300, resendInSec: 30 };
}

export async function verifyOtp(
  subject: string,
  purpose: 'verify_email' | 'admin_2fa' | 'reset',
  code: string,
): Promise<void> {
  const otp = await Otp.findOne({ subject, purpose, expiresAt: { $gt: new Date() } });
  if (!otp || otp.attempts >= 5 || !(await argon2.verify(otp.codeHash, code))) {
    if (otp) {
      otp.attempts += 1;
      await otp.save();
    }
    throw new AppError(400, 'OTP_INVALID', 'BL-103', 'The code is invalid or expired.');
  }
  await otp.deleteOne();
}
