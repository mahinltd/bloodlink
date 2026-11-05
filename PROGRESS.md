# BloodLink backend progress

Status legend: `[ ]` not started, `[~]` written but not proven or incomplete, `[x]` written and proven by a passing real HTTP/socket test.

NEXT STEP: Complete release denial tests and continue the missing admin/public/mobile contract groups, then finish the seed/template/module-split quality work.

## Traceability

The authoritative requirement-by-requirement inventory is [TRACEABILITY.md](TRACEABILITY.md). This file tracks the current execution order and evidence state.

## Security and privacy

- [x] Remove anonymous `GET /public/donors` and `GET /public/requests`.
- [x] Make audit-chain sequence allocation atomic and unique; prove concurrent writes.
- [x] Refuse demo seed in production unless `SEED_DEMO=true`; remove production password documentation.
- [x] Restrict Socket.IO CORS to `CORS_ORIGINS`; test allowed and denied origins.
- [~] Verify release URLs with HTTPS, safe DNS/IP checks, size cap, timeout and streaming hash.
- [~] Add admin lockout, single-use reset tokens, refresh reuse detection and secure refresh cookies.
- [~] Add NoSQL injection, error leak, upload ownership and repository/history secret scans.
- [ ] Test the complete admin RBAC matrix.

## Mobile and public contract

- [~] Existing auth, app, geo, donor, request, chat, call, community and update routes.
- [ ] Add missing aliases and mobile routes from sections 8 through 10.
- [ ] Add public stats, releases, contact, deletion confirmation and asset links.
- [ ] Add ETag/304 and `updatedSince` behavior to all specified endpoints.
- [ ] Add cursor pagination and idempotency behavior to all specified creates.

## Admin contract

- [~] Existing auth, overview, users, requests, reports, config, CMS, flags, releases, audit and support foundations.
- [ ] Complete every screen action, CRUD group, export, SSE stream, session and admin-management route.
- [ ] Add exact master-prompt aliases and document both forms in `openapi.yaml` and `CONTRACT_NOTES.md`.
- [ ] Enforce role matrix across every admin route group.

## Jobs and business rules

- [~] Existing tick, job dispatch, cleanup foundations, notification fan-out and call timeout.
- [ ] Implement and test donor reminders, stale moderation, daily stats, review prompts, missed calls and 30-day anonymisation.
- [ ] Enforce consent re-consent, age, eligibility date, rejection auto-flag, report restriction, accepted-donor contact reveal and blocking everywhere.

## Quality and seeds

- [~] Base seed foundation and partial CMS/template/demo data.
- [ ] Seed all CMS strings, notification/email templates, eight divisions, 64 districts, 40+ hospitals and required demo data.
- [ ] Move all user-facing text behind bilingual templates/CMS keys.
- [ ] Split modules into routes/controllers/services/schemas with async handler wrappers and keep files near 300 lines.
- [~] OpenAPI, README, setup checklist and Postman cover the current implementation; complete them against the master prompt.
- [~] Baseline: build/lint/format/tests passed; coverage observed at 83.21% statements and 85.93% lines, but requirement-level coverage is incomplete.

## Blockers

None currently. External Atlas, Cloudinary, Resend, Firebase, Agora, Render, UptimeRobot and GitHub release credentials remain human setup steps, but local adapters/tests can proceed without them.
