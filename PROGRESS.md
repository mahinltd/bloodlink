# BloodLink backend progress

Status legend: `[ ]` not built, `[~]` implemented but without passing endpoint tests, `[x]` implemented and covered by passing tests.

## Stabilization

- [x] Strict TypeScript scaffold and environment validation
- [x] `.env` and local environment files ignored
- [x] Health endpoint and MongoDB status reporting
- [x] Initial repository snapshot committed
- [ ] Full integration test infrastructure with MongoDB memory server

## Mobile API checklist (sections 8 and 8.1.1)

- [~] `POST /api/v1/auth/register`
- [~] `POST /api/v1/auth/verify-email`
- [~] `POST /api/v1/auth/resend-otp`
- [~] `POST /api/v1/auth/login`
- [~] `POST /api/v1/auth/refresh`
- [~] `POST /api/v1/auth/logout`
- [~] `POST /api/v1/auth/forgot-password`
- [~] `POST /api/v1/auth/reset-password`
- [~] `GET /api/v1/app/strings`
- [~] `GET /api/v1/app/config`
- [~] `GET /api/v1/app/flags`
- [~] `GET /api/v1/app/update/check`
- [~] `POST /api/v1/app/update/events`
- [~] `GET /api/v1/geo/divisions`
- [~] `GET /api/v1/geo/districts`
- [~] `GET /api/v1/geo/areas`
- [~] `GET /api/v1/geo/hospitals`
- [~] `GET /api/v1/me`
- [~] `PATCH /api/v1/me`
- [~] `PUT /api/v1/me/donor-profile/steps/1`
- [~] `PUT /api/v1/me/donor-profile/steps/2`
- [~] `PUT /api/v1/me/donor-profile/steps/3`
- [~] `PUT /api/v1/me/donor-profile/steps/4`
- [~] `PATCH /api/v1/me/availability`
- [~] `GET /api/v1/donors/:userId`
- [~] `POST /api/v1/me/devices`
- [~] `POST /api/v1/users/:id/block`
- [~] `DELETE /api/v1/users/:id/block`
- [~] `POST /api/v1/requests`
- [~] `GET /api/v1/requests`
- [~] `GET /api/v1/requests/:id`
- [~] `POST /api/v1/requests/:id/pledge`
- [~] `DELETE /api/v1/requests/:id/pledge`
- [~] `POST /api/v1/uploads/sign`
- [~] `GET /api/v1/conversations`
- [~] `POST /api/v1/conversations`
- [~] `GET /api/v1/conversations/:id/messages`
- [~] `POST /api/v1/conversations/:id/messages`
- [~] `POST /api/v1/conversations/:id/read`
- [~] `POST /api/v1/calls`
- [~] `POST /api/v1/calls/:id/accept`
- [~] `POST /api/v1/calls/:id/decline`
- [~] `POST /api/v1/calls/:id/cancel`
- [~] `POST /api/v1/calls/:id/end`
- [~] `GET /api/v1/me/donations`
- [~] `POST /api/v1/me/donations`
- [~] `POST /api/v1/donations/:id/review`
- [~] `POST /api/v1/reports`
- [~] `GET /api/v1/notifications`
- [~] `POST /api/v1/notifications/read`
- [~] `DELETE /api/v1/me`
- [ ] Missing mobile preferences, home, donor search, request fulfillment, support payment, and complete notification-tab APIs

## Socket events (section 9)

- [~] `presence:ping`
- [~] `typing:start`
- [~] `typing:stop`
- [~] `message:send`
- [~] `message:read`
- [~] `presence:online` and `presence:offline` fan-out
- [~] `message:delivered` and `message:seen` receipts
- [~] `call:invite`, `call:accept`, `call:decline`, `call:end`
- [ ] `flag:changed`

## Admin API checklist (section 11)

- [~] `POST /api/v1/admin/auth/login`
- [~] `POST /api/v1/admin/auth/verify-2fa`
- [~] `GET /api/v1/admin/me`
- [~] `GET /api/v1/admin/overview`
- [~] `GET /api/v1/admin/users`
- [~] `GET /api/v1/admin/reports`
- [~] `POST /api/v1/admin/reports/:id/action`
- [~] `GET /api/v1/admin/app-config`
- [~] `PUT /api/v1/admin/app-config`
- [~] `POST /api/v1/admin/app-config/publish`
- [~] `GET /api/v1/admin/cms/strings`
- [~] `POST /api/v1/admin/cms/strings/review`
- [~] `GET /api/v1/admin/flags`
- [~] `PUT /api/v1/admin/flags/:key`
- [~] `GET /api/v1/admin/releases`
- [~] `POST /api/v1/admin/releases`
- [~] `GET /api/v1/admin/audit`
- [~] `GET /api/v1/admin/audit/verify`
- [~] `GET /api/v1/admin/audit/export`
- [~] `GET /api/v1/admin/support/providers`
- [~] `GET /api/v1/admin/support/payments`
- [~] `POST /api/v1/admin/support/payments`
- [ ] Admin refresh, logout, session management, user actions, request moderation, CMS publish validation, audit verify/export, release verify/publish/revoke/stats, and reference-data APIs

## Public API checklist (section 12)

- [~] `GET /api/v1/share/requests/:code`
- [~] `GET /api/v1/download/latest`
- [~] `GET /api/v1/download/:versionCode`
- [~] `DELETE /api/v1/me`
- [ ] Public website content and public donor/request discovery endpoints not yet implemented

## Jobs (section 13)

- [~] `POST /internal/jobs/:name`
- [ ] `POST /internal/tick` UptimeRobot tick
- [ ] JobRun persistence and idempotent execution
- [ ] OTP cleanup
- [ ] expired request cleanup
- [ ] notification fan-out
- [ ] 45-second call timeout
- [ ] release/update maintenance
- [ ] audit integrity monitoring

## Cross-cutting completion gates

- [~] OpenAPI skeleton
- [ ] Full OpenAPI coverage for every route and socket event
- [~] Console/stub and real mail, push, storage, and call driver foundations
- [~] 60-second settings cache
- [~] Base seed foundation
- [ ] Full CMS, notification, email template, hospital, and demo seed data
- [ ] Bilingual template-backed user-facing text everywhere
- [ ] Async handler wrapper and module route/controller/service/schema split
- [ ] Rate limits for every abuse-prone flow
- [~] Authentication and OTP route rate limits
- [ ] 80% service/module coverage target
- [ ] Public response sensitive-field scan
- [ ] Security review against sections 7 and 15
- [ ] README, setup checklist, and Postman collection complete
