import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: typeof import('../src/app.js').app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
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
  process.env.SEED_DEMO = 'false';

  ({ app } = await import('../src/app.js'));
});

describe('P0 foundation API', () => {
  it('returns the health envelope', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok', service: 'bloodlink-backend', version: '1' },
    });
    expect(response.body.meta.serverTime).toEqual(expect.any(String));
  });

  it('returns the bootstrap envelope', async () => {
    const response = await request(app).get('/api/v1/app/bootstrap?platform=android&version=1.0.0');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        config: {},
        flags: {},
        minVersionCode: 0,
        forceUpdate: false,
      },
    });
  });

  it('mounts API routers during app creation', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', ref: 'BL-400' });
  });
});
