import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
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
  process.env.MAIL_FROM = 'BloodLink <noreply@bloodlink.tech>';
  process.env.SUPPORT_EMAIL = 'support@bloodlink.tech';
  process.env.STORAGE_DRIVER = 'stub';
  process.env.PUSH_DRIVER = 'console';
  process.env.CALL_DRIVER = 'stub';
  process.env.JOB_SECRET = 'test-job-secret-that-is-at-least-32-characters';
  process.env.FIRST_SUPERADMIN_EMAIL = 'admin@bloodlink.tech';
  process.env.FIRST_SUPERADMIN_PASSWORD = 'test-password-for-development';
});

describe('driver interfaces', () => {
  it('provides working console and stub implementations', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { createDrivers } = await import('../src/services/drivers.js');
    const drivers = createDrivers();
    await expect(
      drivers.mailer.send({ to: 'user@example.com', subject: 'Subject', html: '<p>Body</p>' }),
    ).resolves.toBeUndefined();
    await expect(
      drivers.pusher.send({ tokens: ['token'], data: { type: 'test' } }),
    ).resolves.toBeUndefined();
    await expect(drivers.storage.signUpload('user-1', 'avatar')).resolves.toMatchObject({
      signature: 'stub',
      folder: 'bloodlink/avatar/user-1',
    });
    await expect(drivers.caller.token('channel', 7, 60)).resolves.toMatchObject({
      appId: 'stub',
      channel: 'channel',
      uid: 7,
      token: 'stub',
    });
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });
});
