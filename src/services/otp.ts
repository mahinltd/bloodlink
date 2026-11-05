import argon2 from 'argon2';
import { Otp } from '../models/Otp.js';
import { createDrivers } from './drivers.js';

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
  if (recent) throw new Error('OTP_COOLDOWN');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await Otp.deleteMany({ subject, purpose });
  await Otp.create({
    subject,
    purpose,
    codeHash: await argon2.hash(code),
    attempts: 0,
    expiresAt: new Date(Date.now() + 300_000),
    sentAt: new Date(),
  });
  await drivers.mailer.send({
    to: recipient,
    subject: 'BloodLink verification code',
    html: `<p>Your verification code is ${code}</p>`,
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
    throw new Error('OTP_INVALID');
  }
  await otp.deleteOne();
}
