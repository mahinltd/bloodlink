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
- [x] `DELETE /api/v1/me`
- [x] `PATCH /api/v1/me/preferences`
- [x] `GET /api/v1/home`
- [x] `GET /api/v1/donors`
- [x] `POST /api/v1/requests/:id/fulfill`
- [x] `GET /api/v1/notifications/:tab`
- [x] `POST /api/v1/support/payments`

## Socket events (section 9)

- [x] `presence:ping`
- [x] `typing:start`
- [x] `typing:stop`
- [x] `message:send`
- [x] `message:read`
- [x] `presence:online` and `presence:offline` fan-out
- [x] `message:delivered` and `message:seen` receipts
- [x] `call:invite`, `call:accept`, `call:decline`, `call:end`
- [x] `flag:changed`

## Admin API checklist (section 11)

- [x] `POST /api/v1/admin/auth/login`
- [x] `POST /api/v1/admin/auth/verify-2fa`
- [x] `POST /api/v1/admin/auth/refresh`
- [x] `POST /api/v1/admin/auth/logout`
- [x] `GET /api/v1/admin/me`
- [x] `GET /api/v1/admin/overview`
- [x] `GET /api/v1/admin/users`
- [x] `GET /api/v1/admin/reports`
- [x] `POST /api/v1/admin/reports/:id/action`
- [x] `POST /api/v1/admin/requests/:id/reject`
- [x] `POST /api/v1/admin/users/:id/action`
- [x] `GET /api/v1/admin/app-config`
- [x] `PUT /api/v1/admin/app-config/draft`
- [x] `POST /api/v1/admin/app-config/publish`
- [x] `GET /api/v1/admin/cms/strings`
- [x] `POST /api/v1/admin/cms/strings`
- [x] `GET /api/v1/admin/flags`
- [x] `PUT /api/v1/admin/flags/:key`
- [x] `GET /api/v1/admin/releases`
- [x] `POST /api/v1/admin/releases`
- [x] `POST /api/v1/admin/releases/:id/verify`
- [x] `POST /api/v1/admin/releases/:id/publish`
- [x] `POST /api/v1/admin/releases/:id/revoke`
- [x] `GET /api/v1/admin/releases/stats`
- [x] `GET /api/v1/admin/audit`
- [x] `GET /api/v1/admin/audit/verify`
- [x] `GET /api/v1/admin/audit/export`
- [x] `GET /api/v1/admin/support/providers`
- [x] `GET /api/v1/admin/support/payments`
- [x] `POST /api/v1/admin/support/payments`
- [x] `POST /api/v1/admin/support/payments/:id/confirm`
- [x] `GET /api/v1/admin/reference/divisions`
- [x] `GET /api/v1/admin/reference/districts`
- [x] `GET /api/v1/admin/reference/areas`
- [x] `GET /api/v1/admin/reference/hospitals`

## Public API checklist (section 12)

- [x] `GET /api/v1/share/requests/:code`
- [x] `GET /api/v1/download/latest`
- [x] `GET /api/v1/download/:versionCode`
- [x] `DELETE /api/v1/me`
- [x] `GET /api/v1/public/content`
- [x] `GET /api/v1/public/requests`
- [x] `GET /api/v1/public/donors`

## Jobs (section 13)

- [x] `POST /internal/jobs/:name`
- [x] `POST /internal/tick` UptimeRobot tick
- [x] JobRun persistence and idempotent execution
- [x] OTP cleanup
- [x] expired request cleanup
- [x] notification fan-out with compatibility filtering and caps
- [x] 45-second call timeout
- [x] release/update maintenance
- [x] audit integrity monitoring

## Cross-cutting completion gates

- [x] OpenAPI contract covering current HTTP routes
- [x] Full OpenAPI validation and socket-event documentation
- [x] Console/stub and real mail, push, storage, and call driver foundations
- [x] 60-second settings cache
- [~] Base seed foundation
- [~] Full CMS, notification, email template, hospital, and demo seed data
- [ ] Bilingual template-backed user-facing text everywhere
- [ ] Async handler wrapper and module route/controller/service/schema split
- [ ] Rate limits for every abuse-prone flow
- [~] Authentication and OTP route rate limits
- [ ] 80% service/module coverage target
- [x] Public response sensitive-field scan
- [x] Security review against sections 7 and 15
- [x] README, setup checklist, and Postman collection complete
