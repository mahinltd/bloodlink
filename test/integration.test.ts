import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'node:http';
import request from 'supertest';
import { io as connectSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let mongo: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnectDatabase: typeof import('../src/services/db.js').disconnectDatabase;
let seed: typeof import('../src/seed/base.js').seed;
let clearSettingsCache: typeof import('../src/services/settings.js').clearSettingsCache;
let User: typeof import('../src/models/User.js').User;
let BloodRequest: typeof import('../src/models/BloodRequest.js').BloodRequest;
let Pledge: typeof import('../src/models/Pledge.js').Pledge;
let Notification: typeof import('../src/models/Community.js').Notification;
let moderatedRequestId = '';
let supportPaymentId = '';
let socketToken = '';
let requesterToken = '';
let requesterUserId = '';
let conversationIdForRealtime = '';
let donorUserId = '';

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
  process.env.RELEASE_ALLOWED_HOSTS = 'downloads.example.com';
  process.env.SEED_DEMO = 'false';
}

function otpFrom(logs: unknown[][]): string {
  const entry = logs.find((args) => args[0] === '[otp:console]');
  const code = (entry?.[1] as { code?: unknown } | undefined)?.code;
  if (typeof code !== 'string') throw new Error('OTP was not logged by the console driver.');
  return code;
}

function assertNoSensitiveFields(value: unknown): void {
  const forbidden = new Set([
    'passwordHash',
    'refreshHash',
    'contactPhone',
    'phone',
    'email',
    'locationPrecise',
    'resetToken',
  ]);
  if (Array.isArray(value)) {
    for (const item of value) assertNoSensitiveFields(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    expect(forbidden.has(key)).toBe(false);
    assertNoSensitiveFields(nested);
  }
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
    ({ Notification } = await import('../src/models/Community.js'));
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
    requesterToken = requesterVerified.body.data.tokens.accessToken as string;
    const requesterId = requesterVerified.body.data.user.id as string;
    requesterUserId = requesterId;

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
    socketToken = donorToken;
    const donorId = donorVerified.body.data.user.id as string;
    donorUserId = donorId;
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
    const preferences = await request(app)
      .patch('/api/v1/me/preferences')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ notifications: true, nearbyRequests: true, theme: 'dark' });
    expect(preferences.status).toBe(200);
    const home = await request(app)
      .get('/api/v1/home')
      .set('authorization', `Bearer ${donorToken}`);
    expect(home.status).toBe(200);
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
    const donorSearch = await request(app)
      .get('/api/v1/donors?bloodGroup=O+')
      .set('authorization', `Bearer ${requesterToken}`);
    expect(donorSearch.status).toBe(200);
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
    moderatedRequestId = moderated.body.data.id as string;

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
    const fulfilled = await request(app)
      .post(`/api/v1/requests/${requestId}/fulfill`)
      .set('authorization', `Bearer ${requesterToken}`)
      .send();
    expect(fulfilled.status).toBe(200);

    const conversation = await request(app)
      .post('/api/v1/conversations')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({ userId: donorId, requestId });
    expect(conversation.status).toBe(201);
    const conversationId = conversation.body.data.id as string;
    conversationIdForRealtime = conversationId;
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
    const unreadNotifications = await request(app)
      .get('/api/v1/notifications/unread')
      .set('authorization', `Bearer ${requesterToken}`);
    expect(unreadNotifications.status).toBe(200);
    const notificationsRead = await request(app)
      .post('/api/v1/notifications/read')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ all: true });
    expect(notificationsRead.status).toBe(200);
    const supportPayment = await request(app)
      .post('/api/v1/support/payments')
      .set('authorization', `Bearer ${donorToken}`)
      .send({ provider: 'bkash', amount: 100, trxId: 'integration-trx-1', senderLast4: '1234' });
    expect(supportPayment.status).toBe(201);
    supportPaymentId = supportPayment.body.data.id as string;
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
    await expect(BloodRequest.countDocuments({ status: 'fulfilled' })).resolves.toBe(1);
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
    const publicRequests = await request(app).get('/api/v1/public/requests');
    const publicDonors = await request(app).get('/api/v1/public/donors');
    const publicContent = await request(app).get('/api/v1/public/content');
    expect(publicRequests.status).toBe(200);
    expect(publicDonors.status).toBe(200);
    expect(publicContent.status).toBe(200);
    assertNoSensitiveFields(publicRequests.body);
    assertNoSensitiveFields(publicDonors.body);
    assertNoSensitiveFields(publicContent.body);
    const strings = await request(app).get('/api/v1/app/strings?lang=en');
    const config = await request(app).get('/api/v1/app/config');
    const flags = await request(app).get('/api/v1/app/flags');
    const update = await request(app).get(
      '/api/v1/app/update/check?versionCode=0&deviceId=integration-device',
    );
    const updateEvent = await request(app).post('/api/v1/app/update/events').send({
      versionCode: 1,
      deviceId: 'integration-device',
      event: 'seen',
    });
    expect(strings.status).toBe(200);
    expect(config.status).toBe(200);
    expect(flags.status).toBe(200);
    expect(update.status).toBe(200);
    expect(updateEvent.status).toBe(202);
  });

  it('covers admin 2FA, RBAC, moderation, settings, flags, releases, support, and audit APIs', async () => {
    const logs: unknown[][] = [];
    const info = vi.spyOn(console, 'info').mockImplementation((...args) => {
      logs.push(args);
    });
    const login = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@bloodlink.tech',
      password: 'test-password-for-development',
    });
    expect(login.status).toBe(200);
    const challengeId = login.body.data.challengeId as string;
    const adminVerification = await request(app)
      .post('/api/v1/admin/auth/verify-2fa')
      .send({
        challengeId,
        email: 'admin@bloodlink.tech',
        code: otpFrom(logs),
      });
    expect(adminVerification.status).toBe(200);
    const adminToken = adminVerification.body.data.tokens.accessToken as string;
    const adminRefreshToken = adminVerification.body.data.tokens.refreshToken as string;
    info.mockRestore();

    const me = await request(app)
      .get('/api/v1/admin/me')
      .set('authorization', `Bearer ${adminToken}`);
    const overview = await request(app)
      .get('/api/v1/admin/overview')
      .set('authorization', `Bearer ${adminToken}`);
    const users = await request(app)
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${adminToken}`);
    const reports = await request(app)
      .get('/api/v1/admin/reports')
      .set('authorization', `Bearer ${adminToken}`);
    expect(me.status).toBe(200);
    expect(overview.status).toBe(200);
    expect(overview.body.data.byDivision).toHaveLength(8);
    expect(users.status).toBe(200);
    expect(reports.status).toBe(200);
    const denied = await request(app).get('/api/v1/admin/overview');
    expect(denied.status).toBe(401);
    const refreshed = await request(app)
      .post('/api/v1/admin/auth/refresh')
      .send({ refreshToken: adminRefreshToken });
    expect(refreshed.status).toBe(200);
    const refreshedAdminToken = refreshed.body.data.tokens.accessToken as string;
    const divisions = await request(app)
      .get('/api/v1/admin/reference/divisions')
      .set('authorization', `Bearer ${refreshedAdminToken}`);
    const districts = await request(app)
      .get('/api/v1/admin/reference/districts')
      .set('authorization', `Bearer ${refreshedAdminToken}`);
    const areas = await request(app)
      .get('/api/v1/admin/reference/areas')
      .set('authorization', `Bearer ${refreshedAdminToken}`);
    const hospitals = await request(app)
      .get('/api/v1/admin/reference/hospitals')
      .set('authorization', `Bearer ${refreshedAdminToken}`);
    expect(divisions.status).toBe(200);
    expect(districts.status).toBe(200);
    expect(areas.status).toBe(200);
    expect(hospitals.status).toBe(200);

    const approved = await request(app)
      .post(`/api/v1/admin/requests/${moderatedRequestId}/approve`)
      .set('authorization', `Bearer ${adminToken}`)
      .send();
    expect(approved.status).toBe(200);
    const pendingRequest = await request(app)
      .post('/api/v1/requests')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({
        patientName: 'Rejected patient',
        bloodGroup: 'B+',
        units: 1,
        hospitalNameText: 'Dhaka Medical College Hospital',
        division: 'dhaka',
        district: 'Dhaka',
        area: 'Dhanmondi',
        neededBy: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'routine',
        contactPhone: '01711111111',
        notes: 'payment is not allowed',
      });
    expect(pendingRequest.status).toBe(201);
    const rejected = await request(app)
      .post(`/api/v1/admin/requests/${pendingRequest.body.data.id}/reject`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Does not meet moderation requirements.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('rejected');
    const reportId = reports.body.data[0].id ?? reports.body.data[0]._id;
    const reportAction = await request(app)
      .post(`/api/v1/admin/reports/${reportId}/action`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ action: 'resolve', note: 'Reviewed in integration test.' });
    expect(reportAction.status).toBe(200);
    const suspended = await request(app)
      .post(`/api/v1/admin/users/${requesterUserId}/action`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ action: 'suspend' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('suspended');
    const restored = await request(app)
      .post(`/api/v1/admin/users/${requesterUserId}/action`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ action: 'restore' });
    expect(restored.status).toBe(200);
    expect(restored.body.data.status).toBe('active');
    const config = await request(app)
      .get('/api/v1/admin/app-config')
      .set('authorization', `Bearer ${adminToken}`);
    expect(config.status).toBe(200);
    const draft = await request(app)
      .put('/api/v1/admin/app-config/draft')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ version: 2, safety: { matchMode: 'compatible' } });
    expect(draft.status).toBe(200);
    const published = await request(app)
      .post('/api/v1/admin/app-config/publish')
      .set('authorization', `Bearer ${adminToken}`)
      .send();
    expect(published.status).toBe(200);
    const cms = await request(app)
      .get('/api/v1/admin/cms/strings')
      .set('authorization', `Bearer ${adminToken}`);
    expect(cms.status).toBe(200);
    const cmsDraft = await request(app)
      .post('/api/v1/admin/cms/strings')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ key: 'integration.test', bn: 'পরীক্ষা', en: 'Test', screen: 'test' });
    expect(cmsDraft.status).toBe(201);
    const flags = await request(app)
      .get('/api/v1/admin/flags')
      .set('authorization', `Bearer ${adminToken}`);
    expect(flags.status).toBe(200);
    const flag = await request(app)
      .put('/api/v1/admin/flags/nearby_requests')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        environment: 'demo',
        enabled: true,
        rolloutPercent: 100,
        reason: 'integration test',
      });
    expect(flag.status).toBe(200);
    const releases = await request(app)
      .get('/api/v1/admin/releases')
      .set('authorization', `Bearer ${adminToken}`);
    expect(releases.status).toBe(200);
    const release = await request(app)
      .post('/api/v1/admin/releases')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        versionCode: 2,
        versionName: '1.1.0',
        channel: 'stable',
        apkUrl: 'https://downloads.example.com/bloodlink-1.1.0.apk',
        notes: { bn: 'আপডেট', en: 'Update' },
        mandatory: false,
        minSupportedVersionCode: 1,
        rolloutPercent: 100,
      });
    expect(release.status).toBe(201);
    const releaseId = release.body.data._id as string;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('integration-apk-content'), {
        status: 200,
        headers: { 'content-type': 'application/vnd.android.package-archive' },
      }),
    );
    const verifiedRelease = await request(app)
      .post(`/api/v1/admin/releases/${releaseId}/verify`)
      .set('authorization', `Bearer ${adminToken}`)
      .send();
    expect(verifiedRelease.status).toBe(200);
    expect(verifiedRelease.body.data.status).toBe('verified');
    expect(verifiedRelease.body.data.apkSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(verifiedRelease.body.data.apkSizeBytes).toBe(
      Buffer.byteLength('integration-apk-content'),
    );
    const publishedRelease = await request(app)
      .post(`/api/v1/admin/releases/${releaseId}/publish`)
      .set('authorization', `Bearer ${adminToken}`)
      .send();
    expect(publishedRelease.status).toBe(200);
    expect(publishedRelease.body.data.status).toBe('published');
    const revokedRelease = await request(app)
      .post(`/api/v1/admin/releases/${releaseId}/revoke`)
      .set('authorization', `Bearer ${adminToken}`)
      .send();
    expect(revokedRelease.status).toBe(200);
    expect(revokedRelease.body.data.status).toBe('revoked');
    fetchMock.mockRestore();
    const releaseStats = await request(app)
      .get('/api/v1/admin/releases/stats')
      .set('authorization', `Bearer ${adminToken}`);
    expect(releaseStats.status).toBe(200);
    const audit = await request(app)
      .get('/api/v1/admin/audit')
      .set('authorization', `Bearer ${adminToken}`);
    const auditVerify = await request(app)
      .get('/api/v1/admin/audit/verify')
      .set('authorization', `Bearer ${adminToken}`);
    const auditExport = await request(app)
      .get('/api/v1/admin/audit/export')
      .set('authorization', `Bearer ${adminToken}`);
    expect(audit.status).toBe(200);
    expect(auditVerify.status).toBe(200);
    expect(auditExport.status).toBe(200);
    const providers = await request(app)
      .get('/api/v1/admin/support/providers')
      .set('authorization', `Bearer ${adminToken}`);
    const payments = await request(app)
      .get('/api/v1/admin/support/payments')
      .set('authorization', `Bearer ${adminToken}`);
    expect(providers.status).toBe(200);
    expect(payments.status).toBe(200);
    const adminPayment = await request(app)
      .post('/api/v1/admin/support/payments')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        userId: '000000000000000000000001',
        provider: 'nagad',
        amount: 50,
        trxId: 'integration-trx-2',
        senderLast4: '5678',
      });
    expect(adminPayment.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/v1/admin/support/payments/${supportPaymentId}/confirm`)
      .set('authorization', `Bearer ${adminToken}`)
      .send();
    expect(confirmed.status).toBe(200);
    const logout = await request(app)
      .post('/api/v1/admin/auth/logout')
      .set('authorization', `Bearer ${refreshedAdminToken}`)
      .send();
    expect(logout.status).toBe(200);
  });

  it('executes the protected uptime tick idempotently', async () => {
    const first = await request(app)
      .post('/internal/tick')
      .set('x-job-secret', 'test-job-secret-that-is-at-least-32-characters');
    const second = await request(app)
      .post('/internal/tick')
      .set('x-job-secret', 'test-job-secret-that-is-at-least-32-characters');
    expect(first.status).toBe(200);
    expect(
      first.body.data.results.every((item: { status: string }) => item.status === 'completed'),
    ).toBe(true);
    expect(second.status).toBe(200);
    expect(
      second.body.data.results.every(
        (item: { status: string }) => item.status === 'already_completed',
      ),
    ).toBe(true);
    const audit = await request(app)
      .post('/internal/jobs/audit-verify')
      .set('x-job-secret', 'test-job-secret-that-is-at-least-32-characters');
    const maintenance = await request(app)
      .post('/internal/jobs/update-maintenance')
      .set('x-job-secret', 'test-job-secret-that-is-at-least-32-characters');
    expect(audit.status).toBe(200);
    expect(maintenance.status).toBe(200);
  });

  it('fans out approved requests only to compatible available donors', async () => {
    const requestResponse = await request(app)
      .post('/api/v1/requests')
      .set('authorization', `Bearer ${requesterToken}`)
      .send({
        patientName: 'Fanout patient',
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
    expect(requestResponse.status).toBe(201);
    const before = await Notification.countDocuments({
      userId: donorUserId,
      type: 'request_nearby',
    });
    const response = await request(app)
      .post('/internal/jobs/notification-fanout')
      .set('x-job-secret', 'test-job-secret-that-is-at-least-32-characters');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('completed');
    await expect(
      Notification.countDocuments({ userId: donorUserId, type: 'request_nearby' }),
    ).resolves.toBeGreaterThan(before);
  });

  it('covers authenticated realtime presence and flag events', async () => {
    const { attachSocket, broadcastFlagChanged } = await import('../src/realtime/socket.js');
    const httpServer = createServer(app);
    const ioServer = attachSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Socket server did not start.');
    const url = `http://127.0.0.1:${address.port}`;
    const socket = connectSocket(url, { auth: { token: socketToken } });
    const flagChanged = new Promise<{ key: string; enabled: boolean }>((resolve) => {
      socket.once('flag:changed', resolve);
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const presence = await new Promise<{ success: boolean }>((resolve) => {
      socket.emit('presence:ping', resolve);
    });
    expect(presence.success).toBe(true);
    broadcastFlagChanged('integration_flag', true);
    await expect(flagChanged).resolves.toEqual({ key: 'integration_flag', enabled: true });
    socket.close();
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('rejects chat read attempts from non-participants before updating messages', async () => {
    const { issueTokens } = await import('../src/services/tokens.js');
    const { Message } = await import('../src/models/Message.js');
    const outsider = await User.create({
      code: 'USR-SECURITY',
      email: 'chat-outsider@example.com',
      name: 'Chat Outsider',
      status: 'active',
    });
    const outsiderTokens = await issueTokens(outsider.id, 'user');
    const message = await Message.create({
      conversationId: conversationIdForRealtime,
      senderId: outsider.id,
      clientMessageId: 'security-message-1',
      type: 'text',
      text: 'Not a participant',
      status: 'sent',
    });
    const response = await request(app)
      .post(`/api/v1/conversations/${conversationIdForRealtime}/read`)
      .set('authorization', `Bearer ${outsiderTokens.accessToken}`)
      .send();
    expect(response.status).toBe(403);
    const persisted = await Message.findById(message.id).lean();
    expect(persisted?.status).toBe('sent');
  });

  it('covers realtime messaging, typing, receipts, presence, and call signalling', async () => {
    const { attachSocket } = await import('../src/realtime/socket.js');
    const httpServer = createServer(app);
    const ioServer = attachSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Socket server did not start.');
    const url = `http://127.0.0.1:${address.port}`;
    const requesterSocket = connectSocket(url, { auth: { token: requesterToken } });
    const donorOnline = new Promise<{ userId: string }>((resolve) => {
      requesterSocket.once('presence:online', resolve);
    });
    const donorSocket = connectSocket(url, { auth: { token: socketToken } });
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        requesterSocket.once('connect', () => resolve());
        requesterSocket.once('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        donorSocket.once('connect', () => resolve());
        donorSocket.once('connect_error', reject);
      }),
    ]);
    await expect(donorOnline).resolves.toHaveProperty('userId');

    const typing = new Promise<{ conversationId: string; userId: string; active: boolean }>(
      (resolve) => donorSocket.once('typing', resolve),
    );
    const typingAck = await new Promise<{ success: boolean }>((resolve) => {
      requesterSocket.emit('typing:start', { conversationId: conversationIdForRealtime }, resolve);
    });
    expect(typingAck.success).toBe(true);
    await expect(typing).resolves.toMatchObject({
      conversationId: conversationIdForRealtime,
      active: true,
    });

    const message = new Promise<{
      conversationId: string;
      clientMessageId: string;
      _id: string;
    }>((resolve) => {
      donorSocket.once('message:new', resolve);
    });
    const delivered = new Promise<{ conversationId: string; messageId: string }>((resolve) => {
      donorSocket.once('message:delivered', resolve);
    });
    const sent = await new Promise<{ success: boolean; data: { id: string } }>((resolve) => {
      requesterSocket.emit(
        'message:send',
        {
          conversationId: conversationIdForRealtime,
          clientMessageId: 'realtime-message-1',
          type: 'text',
          text: 'Realtime message',
        },
        resolve,
      );
    });
    expect(sent.success).toBe(true);
    await expect(message).resolves.toMatchObject({
      conversationId: conversationIdForRealtime,
      clientMessageId: 'realtime-message-1',
    });
    const receivedMessage = await message;
    await expect(delivered).resolves.toMatchObject({
      conversationId: conversationIdForRealtime,
      messageId: receivedMessage._id,
    });

    const seen = new Promise<{ conversationId: string; upToMessageId: string }>((resolve) => {
      requesterSocket.once('message:seen', resolve);
    });
    const readAck = await new Promise<{ success: boolean }>((resolve) => {
      donorSocket.emit(
        'message:read',
        { conversationId: conversationIdForRealtime, upToMessageId: receivedMessage._id },
        resolve,
      );
    });
    expect(readAck.success).toBe(true);
    await expect(seen).resolves.toMatchObject({
      conversationId: conversationIdForRealtime,
      upToMessageId: receivedMessage._id,
    });

    const callEvents = ['call:invite', 'call:accept', 'call:decline', 'call:end'] as const;
    for (const event of callEvents) {
      const received = new Promise<{ callId: string; userId: string }>((resolve) => {
        donorSocket.once(event, resolve);
      });
      const ack = await new Promise<{ success: boolean }>((resolve) => {
        requesterSocket.emit(event, { userId: donorUserId, callId: `call-${event}` }, resolve);
      });
      expect(ack.success).toBe(true);
      await expect(received).resolves.toMatchObject({
        callId: `call-${event}`,
      });
    }

    const offline = new Promise<{ userId: string }>((resolve) => {
      requesterSocket.once('presence:offline', resolve);
    });
    donorSocket.close();
    await expect(offline).resolves.toHaveProperty('userId');
    requesterSocket.close();
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });
});
