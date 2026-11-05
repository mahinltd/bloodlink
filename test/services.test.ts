import { describe, expect, it } from 'vitest';
import { isCompatible } from '../src/services/compatibility.js';
import { verifyAuditChain } from '../src/services/audit.js';

describe('compatibility matrix', () => {
  it('allows compatible donor groups and rejects incompatible groups', () => {
    expect(isCompatible('A+', 'O+')).toBe(true);
    expect(isCompatible('O-', 'O+')).toBe(false);
    expect(isCompatible('AB+', 'A-')).toBe(true);
  });

  describe('audit chain verification', () => {
    it('accepts an empty chain and rejects a tampered record', () => {
      expect(verifyAuditChain([])).toEqual({ valid: true });
      expect(
        verifyAuditChain([
          { code: 'AUD-1', ts: '2026-01-01T00:00:00.000Z', prevHash: '', hash: 'tampered' },
        ]),
      ).toMatchObject({ valid: false, brokenAt: 'AUD-1' });
    });
  });
});

describe('money moderation', () => {
  it('detects Bengali and English money terms', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'demo';
    process.env.APP_DOMAIN = 'bloodlink.tech';
    process.env.API_URL = 'http://localhost:3000';
    process.env.WEB_URL = 'https://bloodlink.tech';
    process.env.ADMIN_URL = 'https://admin.bloodlink.tech';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/bloodlink-test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.ADMIN_JWT_SECRET = 'test-admin-secret-that-is-at-least-32-characters';
    process.env.MAIL_DRIVER = 'console';
    process.env.MAIL_FROM = 'BloodLink <no-reply@bloodlink.tech>';
    process.env.SUPPORT_EMAIL = 'support@bloodlink.tech';
    process.env.STORAGE_DRIVER = 'stub';
    process.env.PUSH_DRIVER = 'console';
    process.env.CALL_DRIVER = 'stub';
    process.env.JOB_SECRET = 'test-job-secret-that-is-at-least-32-characters';
    process.env.FIRST_SUPERADMIN_EMAIL = 'admin@bloodlink.tech';
    process.env.FIRST_SUPERADMIN_PASSWORD = 'test-password-for-development';
    const { scanMoneyKeywords } = await import('../src/services/moderation.js');
    await expect(scanMoneyKeywords('রক্তের জন্য টাকা চাই')).resolves.toContain('টাকা');
    await expect(scanMoneyKeywords('Please pay via bKash')).resolves.toContain('bkash');
  });
});
