# BloodLink Traceability

Status rule: `[x]` means a passing test exercises the requirement through real HTTP or sockets; `[~]` means implementation exists but is incomplete or not proven; `[ ]` means missing.

## Summary

- Done: 4
- Partial: 39
- Missing: 16

| Requirement                                                                                                        | Route or file                                                   | Test file                  | Status |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------- | ------ |
| Bootstrap returns config, flags, strings version, update and server time                                           | `src/app.ts`, `src/modules/app/routes.ts`                       | `test/integration.test.ts` | [~]    |
| Published strings/config/flags endpoints and ETag/304                                                              | `src/modules/app/routes.ts`                                     | `test/integration.test.ts` | [~]    |
| Geo divisions, districts, areas and hospitals                                                                      | `src/modules/geo/routes.ts`                                     | `test/integration.test.ts` | [~]    |
| App update check and update events                                                                                 | `src/modules/app/routes.ts`                                     | `test/integration.test.ts` | [~]    |
| Member register, verify email, resend OTP and login                                                                | `src/modules/auth/routes.ts`, `src/services/otp.ts`             | `test/integration.test.ts` | [~]    |
| Google sign-in                                                                                                     | `src/modules/auth/routes.ts`                                    | none                       | [ ]    |
| Logout, logout-all, change password                                                                                | `src/modules/auth/routes.ts`                                    | none                       | [ ]    |
| Rotating refresh with reuse detection and session-family revocation                                                | `src/services/tokens.ts`                                        | `test/integration.test.ts` | [x]    |
| Forgot/reset password single-use flow                                                                              | `src/modules/auth/routes.ts`, `src/services/otp.ts`             | `test/integration.test.ts` | [~]    |
| Remember-me refresh lifetime                                                                                       | `src/modules/auth/routes.ts`, `src/services/tokens.ts`          | none                       | [~]    |
| Donor four-step registration, consent and age rule                                                                 | `src/modules/donors/routes.ts`                                  | `test/integration.test.ts` | [~]    |
| Donor profile GET/PATCH and location update                                                                        | `src/modules/donors/routes.ts`                                  | none                       | [ ]    |
| Availability and next eligible date from settings                                                                  | `src/modules/donors/routes.ts`, `src/services/settings.ts`      | `test/integration.test.ts` | [~]    |
| Preferences, blocks, devices and member stats                                                                      | `src/modules/donors/routes.ts`                                  | none                       | [ ]    |
| Nearby home, donor lists and ownership/block filtering                                                             | `src/modules/donors/routes.ts`                                  | `test/integration.test.ts` | [~]    |
| Create/list/detail/update/cancel requests with cursor and updatedSince                                             | `src/modules/requests/routes.ts`                                | `test/integration.test.ts` | [~]    |
| Pledge, decline, accept and pledge list aliases                                                                    | `src/modules/requests/routes.ts`                                | `test/integration.test.ts` | [~]    |
| Donation request to a donor                                                                                        | `src/modules/donors/routes.ts`                                  | none                       | [ ]    |
| Conversations, messages, read receipts and idempotency                                                             | `src/modules/chat/routes.ts`, `src/realtime/socket.ts`          | `test/integration.test.ts` | [~]    |
| Upload signing and ownership/cloud-folder URL validation                                                           | `src/modules/uploads/routes.ts`                                 | none                       | [~]    |
| Calls REST state machine and ownership                                                                             | `src/modules/calls/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Socket handshake CORS allowlist and authenticated events                                                           | `src/realtime/socket.ts`                                        | `test/integration.test.ts` | [x]    |
| Donations, reviews, reports and idempotency                                                                        | `src/modules/community/routes.ts`                               | `test/integration.test.ts` | [~]    |
| Notifications, read and updatedSince                                                                               | `src/modules/community/routes.ts`                               | `test/integration.test.ts` | [~]    |
| Support providers/payments behind flag and ownership                                                               | `src/modules/community/routes.ts`                               | `test/integration.test.ts` | [~]    |
| Public stats, release, release list, contact and deletion confirmation                                             | `src/modules/public/routes.ts`                                  | none                       | [ ]    |
| Public share page contains no patient name or phone                                                                | `src/modules/public/routes.ts`                                  | `test/integration.test.ts` | [~]    |
| Anonymous donor/request list routes are absent                                                                     | `src/modules/public/routes.ts`                                  | `test/integration.test.ts` | [x]    |
| Download redirects only to verified safe HTTPS release URLs                                                        | `src/modules/public/routes.ts`, `src/modules/admin/routes.ts`   | `test/integration.test.ts` | [x]    |
| Admin login, 2FA, lockout, refresh cookie and reset token                                                          | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin sessions, logout-all, invite and role management                                                             | `src/modules/admin/routes.ts`                                   | none                       | [ ]    |
| Admin overview reads DailyStats and returns all eight divisions                                                    | `src/modules/admin/routes.ts`, `src/jobs`                       | `test/integration.test.ts` | [~]    |
| Admin users detail, verify, reveal, review, suspend, restore and CSV                                               | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin request queue, counts, detail checklist and moderation actions                                               | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin report detail, assign, notes, ask-info, restrict, resolve, evidence                                          | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin app config reset/history/contrast and publish                                                                | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin CMS workflow, bilingual Bengali validation and import/export                                                 | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin feature flags create/update/reason and socket event                                                          | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin support summary/provider settings/receipt/fail                                                               | `src/modules/admin/routes.ts`                                   | `test/integration.test.ts` | [~]    |
| Admin releases verify, publish, revoke, rollout and per-version stats                                              | `src/modules/admin/routes.ts`, `src/modules/public/routes.ts`   | `test/integration.test.ts` | [~]    |
| Admin audit append-only chain and verification                                                                     | `src/services/audit.ts`, `src/models/AdminOperations.ts`        | `test/integration.test.ts` | [~]    |
| Admin geo/hospital/reason/template CRUD and broadcasts                                                             | `src/modules/admin/routes.ts`                                   | none                       | [ ]    |
| Admin notification bell and SSE stream                                                                             | `src/modules/admin/routes.ts`                                   | none                       | [ ]    |
| RBAC matrix for every admin route group                                                                            | `src/middleware/rbac.ts`, `src/modules/admin/routes.ts`         | none                       | [ ]    |
| Internal tick/jobs and idempotence                                                                                 | `src/modules/jobs`, `src/jobs`                                  | `test/integration.test.ts` | [~]    |
| Required jobs: donor reminders, stale moderation, daily stats, cleanup anonymisation, review prompts, missed calls | `src/jobs`                                                      | none                       | [ ]    |
| Location fuzzing and approximate-only discovery                                                                    | `src/modules/donors/routes.ts`, `src/models/DonorProfile.ts`    | `test/integration.test.ts` | [~]    |
| Money/OTP keyword moderation and no-sale policy                                                                    | `src/services/moderation.ts`                                    | `test/services.test.ts`    | [~]    |
| Three rejected requests auto-flag and upheld money report restriction                                              | `src/modules/requests`, `src/modules/community`                 | none                       | [ ]    |
| Accepted-pledge-only contact phone reveal                                                                          | `src/modules/requests`, `src/modules/chat`, `src/modules/calls` | none                       | [ ]    |
| Blocking enforced in every list, chat, call and notification query                                                 | `src/modules`                                                   | none                       | [ ]    |
| NoSQL injection, error leak and public sensitive-field scans                                                       | `src/app.ts`, `src/middleware/error.ts`                         | `test/integration.test.ts` | [~]    |
| Base seed: all divisions/districts/hospitals/config/flags/admin                                                    | `src/seed/base.ts`                                              | none                       | [~]    |
| CMS, notification, email templates and demo seed                                                                   | `src/seed`                                                      | none                       | [~]    |
| Template-backed bilingual user-facing text                                                                         | `src/services`, `src/modules`                                   | none                       | [ ]    |
| Module route/controller/service/schema split and async wrapper                                                     | `src/modules`                                                   | none                       | [ ]    |
| OpenAPI documents every real route and aliases                                                                     | `openapi.yaml`, `src/openapi`                                   | `test/openapi.test.ts`     | [~]    |
| Postman and setup docs                                                                                             | `postman`, `README.md`, `SETUP_CHECKLIST.md`                    | none                       | [~]    |
| Build, lint, format, full tests and 80% target                                                                     | repository scripts                                              | command baseline           | [~]    |
