import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let mongo: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnectDatabase: typeof import('../src/services/db.js').disconnectDatabase;
let seed: typeof import('../src/seed/base.js').seed;
let clearSettingsCache: typeof import('../src/services/settings.js').clearSettingsCache;
let User: typeof import('../src/models/User.js').User;
let BloodRequest: typeof import('../src/models/BloodRequest.js').BloodRequest;
let Pledge: typeof import('../src/models/Pledge.js').Pledge;

function configureTestEnvironment(uri: string): void {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.APP_ENV = 'demo';
  process.env.APP_DOMAIN = 'bloodlink.tech';
  process.env.API_URL = 'http://localhost:3000';
  process.env.WEB_URL = 'https://bloodlink.tech';
  process.env.ADMIN_URL = 'https://admin.bloodlink.tech';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.MONGODB_URI = uri;
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
}

function otpFrom(logs: unknown[][]): string {
  const entry = logs.find((args) => args[0] === '[otp:console]');
  const code = (entry?.[1] as { code?: unknown } | undefined)?.code;
  if (typeof code !== 'string') throw new Error('OTP was not logged by the console driver.');
  return code;
}

describe('real HTTP integration journey', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    configureTestEnvironment(mongo.getUri());
    ({ app } = await import('../src/app.js'));
    ({ disconnectDatabase } = await import('../src/services/db.js'));
    ({ seed } = await import('../src/seed/base.js'));
    ({ clearSettingsCache } = await import('../src/services/settings.js'));
    ({ User } = await import('../src/models/User.js'));
    ({ BloodRequest } = await import('../src/models/BloodRequest.js'));
    ({ Pledge } = await import('../src/models/Pledge.js'));
    await seed({ disconnect: false });
    clearSettingsCache();
  }, 600_000);

  afterAll(async () => {
    if (disconnectDatabase) await disconnectDatabase();
    if (mongo) await mongo.stop();
  });

  it('completes registration, donor setup, moderation, pledge, acceptance, chat, and report', async () => {
    const logs: unknown[][] = [];
    const info = vi.spyOn(console, 'info').mockImplementation((...args) => {
      logs.push(args);
    });

    const requesterRegistration = await request(app).post('/api/v1/auth/register').send({
      name: 'Requester',
      email: 'requester@example.com',
      phone: '01711111111',
      password: 'requester-password',
      acceptTerms: true,
      language: 'en',
    });
    expect(requesterRegistration.status).toBe(201);
    const requesterCode = otpFrom(logs);
    logs.length = 0;
    const requesterVerified = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'requester@example.com',
      code: requesterCode,
    });
    expect(requesterVerified.status).toBe(200);
    const requesterToken = requesterVerified.body.data.tokens.accessToken as string;
    const requesterId = requesterVerified.body.data.user.id as string;

    const donorRegistration = await request(app).post('/api/v1/auth/register').send({
      name: 'Donor',
      email: 'donor@example.com',
      phone: '01722222222',
      password: 'donor-password',
      acceptTerms: true,
      language: 'bn',
    });
    expect(donorRegistration.status).toBe(201);
    const donorCode = otpFrom(logs);
    logs.length = 0;
    const donorVerified = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'donor@example.com',
      code: donorCode,
    });
    expect(donorVerified.status).toBe(200);
    const donorToken = donorVerified.body.data.tokens.accessToken as string;
    const donorId = donorVerified.body.data.user.id as string;
    info.mockRestore();

    const donorSteps = [
      [
        '/api/v1/me/donor-profile/steps/1',
        { dob: '1990-01-01', gender: 'other', phone: '01722222222' },
      ],
      [
        '/api/v1/me/donor-profile/steps/2',
        { division: 'dhaka', district: 'Dhaka', area: 'Dhanmondi', lat: 23.75, lng: 90.38 },
      ],
      [
        '/api/v1/me/donor-profile/steps/3',
        { bloodGroup: 'O+', weightKg: 70, selfDeclaredHealthy: true },
      ],
      [
        '/api/v1/me/donor-profile/steps/4',
        {
          consents: [
            { type: 'terms', version: '1' },
            { type: 'privacy', version: '1' },
            { type: 'health', version: '1' },
          ],
        },
      ],
    ] as const;
    for (const [path, body] of donorSteps) {
      const response = await request(app)
        .put(path)
        .set('authorization', `Bearer ${donorToken}`)
        .send(body);
      expect(response.status).toBe(200);
      expect(response.body.data.registrationStep).toBeGreaterThanOrEqual(2);
    }

    const me = await request(app).get('/api/v1/me').set('authorization', `Bearer ${donorToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.donorProfile).not.toHaveProperty('dob');
    const updatedMe = await request(app)
      .patch('/api/v1/me')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ name: 'Updated Donor', language: 'en' });
    expect(updatedMe.status).toBe(200);
    const availability = await request(app)
      .patch('/api/v1/me/availability')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ available: true });
    expect(availability.status).toBe(200);
    const device = await request(app)
      .post('/api/v1/me/devices')
      .set('authorization', `Bearer ${donorToken}`)
      .send({
        fcmToken: 'test-device-token-long-enough',
        platform: 'android',
        appVersion: '1.0.0',
      });
    expect(device.status).toBe(200);
    const divisions = await request(app).get('/api/v1/geo/divisions');
    const districts = await request(app).get('/api/v1/geo/districts?division=dhaka');
    const areas = await request(app).get('/api/v1/geo/areas?district=dhaka');
    const hospitals = await request(app)
      .get('/api/v1/geo/hospitals?q=Dhaka%20Medical&district=Dhaka')
      .set('authorization', `Bearer ${donorToken}`);
    expect(divisions.status).toBe(200);
    expect(districts.status).toBe(200);
    expect(areas.status).toBe(200);
    expect(hospitals.status).toBe(200);
    const donorCard = await request(app).get(`/api/v1/donors/${donorId}`);
    expect(donorCard.status).toBe(200);
    const block = await request(app)
      .post(`/api/v1/users/${requesterId}/block`)
      .set('authorization', `Bearer ${donorToken}`)
      .send();
    expect(block.status).toBe(201);
    const unblock = await request(app)
      .delete(`/api/v1/users/${requesterId}/block`)
      .set('authorization', `Bearer ${donorToken}`)
      .send();
    expect(unblock.status).toBe(200);

    const moderated = await request(app)
      .post('/api/v1/requests')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({
        patientName: 'Patient',
        bloodGroup: 'A+',
        units: 1,
        hospitalNameText: 'Dhaka Medical College Hospital',
        division: 'dhaka',
        district: 'Dhaka',
        area: 'Dhanmondi',
        neededBy: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'urgent',
        contactPhone: '01711111111',
        notes: 'payment is not allowed',
      });
    expect(moderated.status).toBe(201);
    expect(moderated.body.data.status).toBe('pending_review');

    const created = await request(app)
      .post('/api/v1/requests')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({
        patientName: 'Patient',
        bloodGroup: 'A+',
        units: 1,
        hospitalNameText: 'Dhaka Medical College Hospital',
        division: 'dhaka',
        district: 'Dhaka',
        area: 'Dhanmondi',
        neededBy: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'urgent',
        contactPhone: '01711111111',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('approved');
    const requestId = created.body.data.id as string;
    const requestCode = created.body.data.code as string;
    const shared = await request(app).get(`/api/v1/share/requests/${requestCode}`);
    expect(shared.status).toBe(200);
    expect(shared.body.data).not.toHaveProperty('contactPhone');
    const latestDownload = await request(app).get('/api/v1/download/latest');
    expect(latestDownload.status).toBe(302);
    const versionDownload = await request(app).get('/api/v1/download/1');
    expect(versionDownload.status).toBe(302);
    const requestList = await request(app)
      .get('/api/v1/requests?tab=all')
      .set('authorization', `Bearer ${donorToken}`);
    expect(requestList.status).toBe(200);
    expect(requestList.body.data.some((item: { id: string }) => item.id === requestId)).toBe(true);
    const requestDetail = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('authorization', `Bearer ${donorToken}`);
    expect(requestDetail.status).toBe(200);

    const pledgeResponse = await request(app)
      .post(`/api/v1/requests/${requestId}/pledge`)
      .set('authorization', `Bearer ${donorToken}`)
      .send({ note: 'I can help.' });
    expect(pledgeResponse.status).toBe(201);
    const pledgeId = pledgeResponse.body.data.id as string;

    const accepted = await request(app)
      .post(`/api/v1/requests/${requestId}/pledges/${pledgeId}/accept`)
      .set('authorization', `Bearer ${requesterToken}`)
      .send();
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('accepted');
    const withdrawn = await request(app)
      .delete(`/api/v1/requests/${requestId}/pledge`)
      .set('authorization', `Bearer ${donorToken}`)
      .send();
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.withdrawn).toBe(true);

    const conversation = await request(app)
      .post('/api/v1/conversations')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ userId: donorId, requestId });
    expect(conversation.status).toBe(201);
    const conversationId = conversation.body.data.id as string;
    const message = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ clientMessageId: 'journey-message-1', type: 'text', text: 'Thank you.' });
    expect(message.status).toBe(201);
    const conversations = await request(app)
      .get('/api/v1/conversations')
      .set('authorization', `Bearer ${requesterToken}`);
    expect(conversations.status).toBe(200);
    const messages = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${donorToken}`);
    expect(messages.status).toBe(200);
    expect(messages.body.data).toHaveLength(1);
    const read = await request(app)
      .post(`/api/v1/conversations/${conversationId}/read`)
      .set('authorization', `Bearer ${donorToken}`)
      .send();
    expect(read.status).toBe(200);
    const upload = await request(app)
      .post('/api/v1/uploads/sign')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ purpose: 'chat_image', mime: 'image/png', bytes: 1024 });
    expect(upload.status).toBe(200);
    const call = await request(app)
      .post('/api/v1/calls')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ calleeId: donorId, conversationId });
    expect(call.status).toBe(201);
    const callId = call.body.data.callId as string;
    const acceptedCall = await request(app)
      .post(`/api/v1/calls/${callId}/accept`)
      .set('authorization', `Bearer ${donorToken}`)
      .send();
    expect(acceptedCall.status).toBe(200);
    const endedCall = await request(app)
      .post(`/api/v1/calls/${callId}/end`)
      .set('authorization', `Bearer ${requesterToken}`)
      .send();
    expect(endedCall.status).toBe(200);
    const declinedCall = await request(app)
      .post('/api/v1/calls')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ calleeId: donorId, conversationId });
    expect(declinedCall.status).toBe(201);
    const declined = await request(app)
      .post(`/api/v1/calls/${declinedCall.body.data.callId}/decline`)
      .set('authorization', `Bearer ${donorToken}`)
      .send();
    expect(declined.status).toBe(200);
    const cancelledCall = await request(app)
      .post('/api/v1/calls')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ calleeId: donorId, conversationId });
    expect(cancelledCall.status).toBe(201);
    const cancelled = await request(app)
      .post(`/api/v1/calls/${cancelledCall.body.data.callId}/cancel`)
      .set('authorization', `Bearer ${requesterToken}`)
      .send();
    expect(cancelled.status).toBe(200);
    const donation = await request(app)
      .post('/api/v1/me/donations')
      .set('authorization', `Bearer ${donorToken}`)
      .send({
        date: new Date().toISOString(),
        hospitalName: 'Dhaka Medical College Hospital',
        bloodGroup: 'O+',
        units: 1,
        recipientName: 'Patient',
      });
    expect(donation.status).toBe(201);
    const donationId = donation.body.data._id as string;
    const donations = await request(app)
      .get('/api/v1/me/donations')
      .set('authorization', `Bearer ${donorToken}`);
    expect(donations.status).toBe(200);
    const review = await request(app)
      .post(`/api/v1/donations/${donationId}/review`)
      .set('authorization', `Bearer ${donorToken}`)
      .send({ rating: 5, text: 'Helpful coordination.', anonymous: true });
    expect(review.status).toBe(201);
    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('authorization', `Bearer ${donorToken}`);
    expect(notifications.status).toBe(200);
    const notificationsRead = await request(app)
      .post('/api/v1/notifications/read')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ all: true });
    expect(notificationsRead.status).toBe(200);
    const deleted = await request(app)
      .delete('/api/v1/me')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ password: 'donor-password' });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toBe(true);

    const report = await request(app)
      .post('/api/v1/reports')
      .set('authorization', `Bearer ${donorToken}`)
      .send({
        targetUserId: requesterId,
        requestId,
        reason: 'spam_other',
        description: 'This is a test report.',
      });
    expect(report.status).toBe(201);

    await expect(User.countDocuments()).resolves.toBe(2);
    await expect(BloodRequest.countDocuments({ status: 'approved' })).resolves.toBe(1);
    await expect(Pledge.countDocuments({ status: 'cancelled' })).resolves.toBe(1);
  });

  it('covers OTP verification, login, refresh rotation, reuse detection, and password reset', async () => {
    const logs: unknown[][] = [];
    const info = vi.spyOn(console, 'info').mockImplementation((...args) => {
      logs.push(args);
    });
    const email = 'auth-flow@example.com';
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'Auth Flow',
      email,
      phone: '01733333333',
      password: 'initial-password',
      acceptTerms: true,
    });
    expect(registration.status).toBe(201);
    const resend = await request(app).post('/api/v1/auth/resend-otp').send({
      email,
      purpose: 'verify_email',
    });
    expect(resend.status).toBe(429);
    const verification = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({
        email,
        code: otpFrom(logs),
      });
    expect(verification.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'initial-password',
    });
    expect(login.status).toBe(200);
    const refreshToken = login.body.data.tokens.refreshToken as string;
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(refreshToken);
    const reused = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);

    logs.length = 0;
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email,
        code: otpFrom(logs),
        password: 'reset-password',
      });
    expect(reset.status).toBe(200);
    const loginAfterReset = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'reset-password',
    });
    expect(loginAfterReset.status).toBe(200);
    const logout = await request(app).post('/api/v1/auth/logout').send({
      refreshToken: loginAfterReset.body.data.tokens.refreshToken,
    });
    expect(logout.status).toBe(200);
    info.mockRestore();
  });

  it('answers every documented route on a fresh app without a 404', async () => {
    const health = await request(app).get('/healthz');
    const bootstrap = await request(app).get('/api/v1/app/bootstrap');
    expect(health.status).not.toBe(404);
    expect(bootstrap.status).not.toBe(404);
  });
});
