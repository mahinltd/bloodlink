# BloodLink backend progress

Status legend: `[ ]` not built, `[~]` implemented but without passing endpoint tests, `[x]` implemented and covered by passing tests.

## Stabilization

- [x] Strict TypeScript scaffold and environment validation
- [x] `.env` and local environment files ignored
- [x] Health endpoint and MongoDB status reporting
- [x] Initial repository snapshot committed
- [x] Full integration test infrastructure with MongoDB memory server
- [x] `uuid` advisory mitigated with an npm override without forced upgrades

## Mobile API checklist (sections 8 and 8.1.1)

- [x] `POST /api/v1/auth/register`
- [x] `POST /api/v1/auth/verify-email`
- [x] `POST /api/v1/auth/resend-otp`
- [x] `POST /api/v1/auth/login`
- [x] `POST /api/v1/auth/refresh`
- [x] `POST /api/v1/auth/logout`
- [x] `POST /api/v1/auth/forgot-password`
- [x] `POST /api/v1/auth/reset-password`
- [x] `GET /api/v1/app/strings`
- [x] `GET /api/v1/app/config`
- [x] `GET /api/v1/app/flags`
- [x] `GET /api/v1/app/update/check`
- [x] `POST /api/v1/app/update/events`
- [x] `GET /api/v1/geo/divisions`
- [x] `GET /api/v1/geo/districts`
- [x] `GET /api/v1/geo/areas`
- [x] `GET /api/v1/geo/hospitals`
- [x] `GET /api/v1/me`
- [x] `PATCH /api/v1/me`
- [x] `PUT /api/v1/me/donor-profile/steps/1`
- [x] `PUT /api/v1/me/donor-profile/steps/2`
- [x] `PUT /api/v1/me/donor-profile/steps/3`
- [x] `PUT /api/v1/me/donor-profile/steps/4`
- [x] `PATCH /api/v1/me/availability`
- [x] `GET /api/v1/donors/:userId`
- [x] `POST /api/v1/me/devices`
- [x] `POST /api/v1/users/:id/block`
- [x] `DELETE /api/v1/users/:id/block`
- [x] `POST /api/v1/requests`
- [x] `GET /api/v1/requests`
- [x] `GET /api/v1/requests/:id`
- [x] `POST /api/v1/requests/:id/pledge`
- [x] `DELETE /api/v1/requests/:id/pledge`
- [x] `POST /api/v1/requests/:id/pledges/:pledgeId/accept`
- [x] `POST /api/v1/uploads/sign`
- [x] `GET /api/v1/conversations`
- [x] `POST /api/v1/conversations`
- [x] `GET /api/v1/conversations/:id/messages`
- [x] `POST /api/v1/conversations/:id/messages`
- [x] `POST /api/v1/conversations/:id/read`
- [x] `POST /api/v1/calls`
- [x] `POST /api/v1/calls/:id/accept`
- [x] `POST /api/v1/calls/:id/decline`
- [x] `POST /api/v1/calls/:id/cancel`
- [x] `POST /api/v1/calls/:id/end`
- [x] `GET /api/v1/me/donations`
- [x] `POST /api/v1/me/donations`
- [x] `POST /api/v1/donations/:id/review`
- [x] `POST /api/v1/reports`
- [x] `GET /api/v1/notifications`
- [x] `POST /api/v1/notifications/read`
- [~] `DELETE /api/v1/me`
- [x] `PATCH /api/v1/me/preferences`
- [x] `GET /api/v1/home`
- [x] `GET /api/v1/donors`
- [x] `POST /api/v1/requests/:id/fulfill`
- [x] `GET /api/v1/notifications/:tab`
- [x] `POST /api/v1/support/payments`

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
- [x] `POST /api/v1/admin/auth/refresh`
- [x] `POST /api/v1/admin/auth/logout`
- [~] `GET /api/v1/admin/me`
- [~] `GET /api/v1/admin/overview`
- [~] `GET /api/v1/admin/users`
- [~] `GET /api/v1/admin/reports`
- [~] `POST /api/v1/admin/reports/:id/action`
- [~] `POST /api/v1/admin/requests/:id/reject`
- [~] `POST /api/v1/admin/users/:id/action`
- [~] `GET /api/v1/admin/app-config`
- [~] `PUT /api/v1/admin/app-config`
- [~] `POST /api/v1/admin/app-config/publish`
- [~] `GET /api/v1/admin/cms/strings`
- [~] `POST /api/v1/admin/cms/strings/review`
- [~] `GET /api/v1/admin/flags`
- [~] `PUT /api/v1/admin/flags/:key`
- [~] `GET /api/v1/admin/releases`
- [~] `POST /api/v1/admin/releases`
- [~] `POST /api/v1/admin/releases/:id/verify`
- [~] `POST /api/v1/admin/releases/:id/publish`
- [~] `POST /api/v1/admin/releases/:id/revoke`
- [x] `GET /api/v1/admin/releases/stats`
- [~] `GET /api/v1/admin/audit`
- [~] `GET /api/v1/admin/audit/verify`
- [~] `GET /api/v1/admin/audit/export`
- [~] `GET /api/v1/admin/support/providers`
- [~] `GET /api/v1/admin/support/payments`
- [~] `POST /api/v1/admin/support/payments`
- [~] `POST /api/v1/admin/support/payments/:id/confirm`
- [x] `GET /api/v1/admin/reference/divisions`
- [x] `GET /api/v1/admin/reference/districts`
- [x] `GET /api/v1/admin/reference/areas`
- [x] `GET /api/v1/admin/reference/hospitals`
- [ ] Admin refresh, logout, session management, user actions, request moderation, CMS publish validation, audit verify/export, release verify/publish/revoke/stats, and reference-data APIs

## Public API checklist (section 12)

- [x] `GET /api/v1/share/requests/:code`
- [x] `GET /api/v1/download/latest`
- [x] `GET /api/v1/download/:versionCode`
- [x] `DELETE /api/v1/me`
- [ ] Public website content and public donor/request discovery endpoints not yet implemented

## Jobs (section 13)

- [x] `POST /internal/jobs/:name`
- [x] `POST /internal/tick` UptimeRobot tick
- [x] JobRun persistence and idempotent execution
- [x] OTP cleanup
- [x] expired request cleanup
- [~] notification fan-out with compatibility filtering and caps
- [x] 45-second call timeout
- [ ] release/update maintenance
- [ ] audit integrity monitoring

## Cross-cutting completion gates

- [~] OpenAPI contract covering current HTTP routes
- [ ] Full OpenAPI validation and socket-event documentation
- [~] Console/stub and real mail, push, storage, and call driver foundations
- [~] 60-second settings cache
- [~] Base seed foundation
- [~] Full CMS, notification, email template, hospital, and demo seed data
- [ ] Bilingual template-backed user-facing text everywhere
- [ ] Async handler wrapper and module route/controller/service/schema split
- [ ] Rate limits for every abuse-prone flow
- [~] Authentication and OTP route rate limits
- [ ] 80% service/module coverage target
- [ ] Public response sensitive-field scan
- [ ] Security review against sections 7 and 15
- [ ] README, setup checklist, and Postman collection complete
