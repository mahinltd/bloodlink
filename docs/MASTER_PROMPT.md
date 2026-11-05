# BloodLink — Backend Master Prompt

*For the backend AI agent · v1.1 · 5 Nov 2026 (owner decisions applied) · Written from a full review of the Figma exports (33 mobile screens + 10 admin screens, light and dark)*

---

## 0. How to use this prompt

You are the **senior backend engineer** for **BloodLink**. Build one Node.js backend that serves three clients: the **Android app**, the **Admin web dashboard** and the **public website**. Read this whole document before writing code.

Working rules:

- Build in the **phases in §17**. After each phase: run the tests, update `openapi.yaml`, and print a short "contract summary" the Android and Admin agents can use.
- Do not ask questions unless truly blocked. Every open decision already has a **default in §2.3**. Follow it.
- Everything user-facing must work in **Bengali (bn) and English (en)**. Never hard-code UI text in the API. Return keys or localized text (§5.5).
- The product promise is **"Blood is never sold."** Code that enables money-for-blood is a bug (§15).
- Free tier only. Do not add paid services. If something needs a paid service, build the free workaround described here and leave a clean adapter interface.

### 0.1 Owner decisions — final, they override anything else in this document

1. **OTP is by EMAIL only** (Resend). No SMS anywhere. Phone numbers are collected for contact only for blood, and `phoneVerified` is set by an admin.
2. **Support payments are manual.** No bKash, Nagad or Rocket API. The owner uses personal numbers: the user sends money by the provider's app, then submits the transaction ID; an admin confirms it (§11.9).
3. **All 8 divisions of Bangladesh** (Barishal, Chattogram, Dhaka, Khulna, Mymensingh, Rajshahi, Rangpur, Sylhet) must appear everywhere: seed data, filters, registration, and the admin Overview chart (the design showed only 6; the backend returns 8).
4. **Render free plan** for the backend, **UptimeRobot** for keep-alive and scheduled work (§13), **Firebase FCM** for push, **MongoDB Atlas**, **Cloudinary**, **Resend**, **Agora**. Vercel hosts the admin web and the website.
5. **Domain**: `bloodlink.tech` (taken exactly as the owner gave it) is already verified in Resend. Keep it in one env var `APP_DOMAIN`. Mail is sent from `BloodLink <no-reply@blodlink.tech>`. Website `https://blodlink.tech`, admin `https://admin.blodlink.tech`, API `https://api.APP_DOMAIN`.
6. **The app is NOT on Google Play.** Users download the APK from our own website, so the backend must run an **in-app self-update system** controlled from the admin panel (§8.1.1, §11.11).
7. **Nothing is hard-coded.** Every text, number, list, colour, toggle and rule that the designs let an admin control must be stored in the database and served by the API (§6.1). Where the designs have no admin screen for something, still build the admin API now; the admin-web agent adds the screen later.
8. **Every endpoint that any mobile screen or admin screen needs must exist.** Use §2 as the checklist.
9. The Android app and the admin web are built separately by other agents. The backend must not depend on any client toolkit; the contract is `openapi.yaml`, the Socket.IO event list and the error catalogue.

### 0.2 Starting from an empty folder

The owner opens an **empty folder** in VS Code and gives you this prompt. You create everything inside that folder and nothing outside it.

1. Check the working directory is empty (only a hidden `.git` is allowed). Run `node -v` (need 20 or newer). `git init`, `npm init`.
2. Install runtime packages: `express, mongoose, zod, socket.io, jsonwebtoken, argon2, helmet, cors, express-rate-limit, express-mongo-sanitize, pino, pino-http, resend, cloudinary, firebase-admin, agora-token, google-auth-library, nanoid, dotenv, @asteasolutions/zod-to-openapi`. Dev packages: `typescript, tsx, vitest, supertest, mongodb-memory-server, eslint, prettier, @types/*`. Use current stable versions, no deprecated packages, commit the lockfile.
3. Create `tsconfig` (strict), ESLint, Prettier and the scripts `dev, build, start, test, lint, seed:base, seed:demo, openapi:build`.
4. Create the folder structure from §4, `.env.example`, `.gitignore` (never commit `.env`), `README.md`, `render.yaml`, and `SETUP_CHECKLIST.md`. The checklist is for the human owner and lists the accounts and keys still to create: Atlas cluster and URI, Cloudinary keys, Resend API key, Firebase project (service account JSON and Google web client id), Agora project (app id and certificate), Render service with the two custom domains, UptimeRobot monitors, GitHub repository for APK releases.
5. **Driver switches so you can code before every key exists**: `MAIL_DRIVER=console/resend`, `PUSH_DRIVER=console/fcm`, `CALL_DRIVER=stub/agora`, `STORAGE_DRIVER=stub/cloudinary`. In `console` or `stub` mode the adapter logs what it would send (OTP codes appear in the terminal). `MONGODB_URI` is always required (Atlas free); tests use the in-memory database.
6. Commit at the end of every phase (conventional commit messages). Print the "contract summary" after each phase. Do not stop for questions; stop only if a step is impossible.
7. Code, comments and commit messages in English. All user-facing text in Bengali and English through the CMS (§6.1).

## 1. Product context

BloodLink is a **free, voluntary blood-donor connection network for Bangladesh**. People register as donors, patients' families post blood requests, nearby donors respond, and both sides talk through in-app chat and audio calls. It is **not a medical service**: hospital doctors decide eligibility. Admins moderate requests, handle abuse reports and control app content.

- **Members**: one `User` can be a donor, a requester, or both. There is no separate "donor account".
- **Admins**: separate `AdminUser` collection, separate login, roles (§7.3).
- **Languages**: Bengali first, English second. All dates are stored in UTC and shown in BST (Asia/Dhaka) by clients.
- **Privacy promise shown in the UI**: phone number and date of birth are never public; only an **approximate area** is shared; contact happens only through in-app chat/call.

**Distribution**: the app is installed from the BloodLink website, not from Google Play. So the backend also owns release management, update checks and the download counter (§8.1.1, §11.11, §12).

## 2. What the designs tell us

### 2.1 Mobile screens → backend responsibility

| Screens | Backend responsibility |
| --- | --- |
| Splash, Onboarding 1–3 | `GET /app/bootstrap` (config, flags, strings version, min app version). Onboarding is static. |
| Login, Create account, 6-digit OTP, Forgot password | Email+password auth, Google sign-in, email OTP, password-reset link. |
| Donor registration · Personal / Location / Health / Consent | Four-step donor profile saved step by step; consent records with version and timestamp. |
| Home | Availability toggle, nearby requests, nearby donors, unread counters. |
| Requests (tabs All / Urgent / Mine, search, chips: blood group, division, radius, sort nearest) | Geo-filtered paginated request list. |
| Create Request, Success | Create + auto-moderation + shareable link. |
| Request Detail | Detail, hospital location, requester summary, "I can help", chat, call, report. |
| Donor Profile (other person) | Public donor card, message, direct request, report. |
| Chat list, Conversation | Conversations, unread tab, messages: text, image, voice note, PDF, location; read receipts. |
| Incoming call (fullscreen + notification) | Agora token, FCM high-priority push, call state machine, quick reply on decline. |
| Profile, Settings, Appearance, Notifications | Profile edit, preferences, block list, change password, delete account, notification list + toggles. |
| Donation History, Review donation | Donation records (self-reported + confirmed), reviews with anonymous option. |
| Report user | Report with reason, description, evidence upload, optional block. |
| Empty / Error / Offline / Loading skeleton | Standard error envelope with a reference code (`BL-503`), `lastSyncedAt`, ETag caching, cursor pagination. |

### 2.2 Admin screens → backend responsibility

| Screen | Backend responsibility |
| --- | --- |
| Login | Work email + password, then **6-digit second-factor code**; sessions. |
| Overview | KPI aggregates, completed connections per division, recent activity, "needs attention" requests, report export. |
| Users | Search/filter/paginate, masked phone, verify phone, suspend/restore, export CSV. |
| Requests | Moderation queue (All / Under review / Urgent / Completed), checklist, Approve / Ask for info / Reject. |
| Reports | Triage (All / High / Closed), assign, internal notes, evidence, temporary restriction, resolve. |
| App config | Brand colours, theme, fonts, radii, safety settings; draft → publish; reset to default. |
| CMS strings | Bilingual strings, draft → in-review → published, version label (e.g. v1.3), completeness check. |
| Feature flags | Per-environment flags with rollout %, mandatory change reason. |
| Support payments | bKash / Nagad / Rocket toggles, voluntary app-support records, receipts. |
| Audit log | Append-only, filterable, before/after diff, integrity protected. |

### 2.3 Gaps and mismatches found in the designs — follow these defaults

Where an item below disagrees with §0.1, **§0.1 wins**: item 5 (manual payments are now confirmed, not optional), item 11 (release data lives in the `AppRelease` collection, not in `AppConfig`), and item 4 (all 8 divisions are mandatory).

1. **OTP is shown for a mobile number, but our email service is Resend.** Default: **verify the EMAIL with a 6-digit OTP** (same 6-box UI, same 5-minute validity, 30-second resend). The phone number is collected and stored, but `phoneVerified` is set **by an admin** (the audit log design already shows `USER_VERIFIED: phone_verified false → true`). Keep an `OtpChannel` interface so SMS can be plugged in later. Tell the Android agent the OTP screen text must say "email", not "mobile number".
2. **Registration step counter says "১/৮ · Step 1 of 4".** There are 4 steps (Personal, Location, Health, Consent). Use 4. Ask the designer to fix the label.
3. **Success screen says "Your request is live", but Admin has an "Under review" queue.** Default: `requestAutoPublish = true` for members whose email is verified and whose request passes the keyword scan (§15). Otherwise status becomes `pending_review` and the app shows "under review". Admin can switch auto-publish off in App config → Safety.
4. **Admin Overview lists 6 divisions; Bangladesh has 8** (Barishal, Chattogram, Dhaka, Khulna, Mymensingh, Rajshahi, Rangpur, Sylhet). Return all 8.
5. **Support payments has no mobile screen.** bKash/Nagad/Rocket merchant APIs are not free and need a business agreement. Default (phase 2): a **manual flow** — user sends money to the displayed number, submits the transaction ID, admin confirms (pending → success). The design's "pending: provider confirmation" matches this. Build the endpoints, gate them with the `support_payments` flag, and tell the Android agent no screen exists yet.
6. **Feature flags show only Demo and Staging.** Add a **Production** environment.
7. **Admin login mentions an approved phone for the 6-digit code.** Default: send the code by **email** (Resend). Optional TOTP later.
8. **App config has a "Safety" tab that was not designed.** Default contents are in §6 (`AppConfig.safety`).
9. **Hospital is a free field in Create Request, but admin checks "hospital name exists".** Keep a seeded `Hospital` collection with autocomplete; free text is allowed but marked `hospitalVerified:false` and shown in the admin checklist.
10. **Name is asked twice** (Create account and Donor registration · Personal). Store once; pre-fill step 1 from the account.
11. **No UI to publish the APK/Play link for the website.** Store `release` fields inside `AppConfig` and expose them publicly (§12).
12. **Numerals in the UI are Bengali digits (৬, ২০২৬).** The API always returns plain numbers and ISO dates; clients format them.

## 3. Tech stack

| Layer | Choice | Notes (verify current free limits before launch) |
| --- | --- | --- |
| Runtime | Node.js 20 LTS, TypeScript (strict) | Express, Zod validation, Pino logging |
| Database | **MongoDB Atlas M0** + Mongoose | Region near Bangladesh (Singapore or Mumbai). 2dsphere geo indexes work on M0. |
| File storage | **Cloudinary** | Signed direct uploads from the client; server never proxies files. |
| Email | **Resend** | Needs a verified sending domain to email arbitrary users. See §16. |
| Push | **Firebase Cloud Messaging** via `firebase-admin` | Also verify Google ID tokens (Google sign-in). |
| Audio calls | **Agora** voice (RTC) | Server only issues tokens (`agora-token`). Media never touches our server. |
| Realtime | Socket.IO on the same Render service | Chat, typing, presence, call signalling. FCM covers offline users. |
| Hosting | **Render** web service (backend) | Free plan sleeps when idle — see §16. |
| Admin + Website | **Vercel** (two projects) | Admin calls the API through a Vercel rewrite `/api/* → Render` to avoid cross-site cookies. |
| Passwords | argon2id |  |
| Tests | Vitest + Supertest + mongodb-memory-server |  |
| API docs | OpenAPI 3.1 generated from Zod (`/docs`, and `openapi.yaml` in repo) | The Android agent builds from this contract. |

Resend: the domain is already verified (§0.1 item 5), so send from `noreply@APP_DOMAIN` with a `Reply-To` of the support address kept in settings. Use plain, bilingual HTML email templates stored in the CMS-driven template service (subject and body in bn and en). UptimeRobot (free) watches `/healthz` and triggers scheduled work (§13).

**Environment variables** (document all in `.env.example`; these are only bootstrap values, anything an admin may tune lives in the database, §6.1): `NODE_ENV, PORT, APP_ENV (demo/staging/production), APP_DOMAIN (default blog.link.tech), API_URL, WEB_URL, ADMIN_URL, CORS_ORIGINS, MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ADMIN_JWT_SECRET, MAIL_DRIVER, MAIL_FROM, RESEND_API_KEY, SUPPORT_EMAIL, STORAGE_DRIVER, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, PUSH_DRIVER, FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_WEB_CLIENT_ID, CALL_DRIVER, AGORA_APP_ID, AGORA_APP_CERTIFICATE, JOB_SECRET, FIRST_SUPERADMIN_EMAIL, FIRST_SUPERADMIN_PASSWORD, SEED_DEMO, SENTRY_DSN (optional)`. Fail fast at boot if a required variable is missing for the selected drivers.

## 4. Repository structure

```
bloodlink-backend/
  src/
    config/         env.ts (zod-validated), constants.ts
    modules/        auth, users, donors, requests, pledges, chat, calls, notifications,
                    donations, reviews, reports, uploads, app (bootstrap/config/strings/flags),
                    geo, hospitals, support, public, jobs
      admin/        auth, overview, users, requests, reports, appConfig, cms, flags, support, audit
    models/         one file per Mongoose model
    realtime/       socket.ts, chatHandlers.ts, callHandlers.ts
    services/       mailer.ts, push.ts, cloudinary.ts, agora.ts, otp.ts, audit.ts, moderation.ts, geo.ts
    middleware/     auth.ts, adminAuth.ts, rbac.ts, validate.ts, rateLimit.ts, error.ts, requestId.ts, i18n.ts
    jobs/           handlers called by /internal/jobs/:name
    seed/           geo (divisions/districts), hospitals, demo data, strings
    app.ts server.ts
  test/             unit + integration
  openapi.yaml  README.md  .env.example  render.yaml
```

Code standards: one module = `routes.ts, controller.ts, service.ts, schema.ts` (Zod). Controllers are thin. All input validated with Zod. No `any`. Every mutating admin action calls `audit.log()`. ESLint + Prettier.

## 5. Global API conventions

1. **Base URLs**: mobile/public `/api/v1/*`, admin `/api/v1/admin/*`, internal jobs `/internal/jobs/*`, health `/healthz`.
2. **Success envelope**: `{ "success": true, "data": ..., "meta": { "nextCursor": "...", "total": 86 } }`.
3. **Error envelope**: `{ "success": false, "error": { "code": "REQUEST_NOT_FOUND", "ref": "BL-404", "message": { "bn": "...", "en": "..." }, "fields": { "email": "INVALID" }, "requestId": "..." } }`. The `ref` is the short reference the Error screen shows (`BL-503`). Keep an error catalogue with Bengali and English messages. Never leak stack traces.
4. **Language**: read `Accept-Language: bn|en` (fallback to the user's saved language). Error messages and push texts are rendered in that language.
5. **IDs**: Mongo `_id` internally; human codes for display and support: `USR-0248`, `REQ-1042`, `RPT-018`, `SUP-0086`, `AUD-00218`, `CALL-…`, `SESSION-021`. Generate with an atomic `counters` collection. Expose both `id` and `code`.
6. **Pagination**: mobile uses **cursor** (`?cursor=&limit=20`, max 50). Admin tables show numbered pages, so admin uses **page/limit** (`?page=1&limit=20` → `meta.total, meta.pages`).
7. **Dates**: ISO-8601 UTC. Distances in **metres** (client shows "১.২ কিমি").
8. **Phone**: Bangladesh format. Validate `^(?:\+?88)?01[3-9]\d{8}$`, store E.164 (`+8801712345678`). Admin lists show masked `01712 ••5678`.
9. **Blood groups enum**: `A+, A-, B+, B-, O+, O-, AB+, AB-`.
10. **Caching**: `GET /app/strings`, `/app/config`, `/app/flags` support `ETag`/`If-None-Match` (304). List endpoints accept `updatedSince` so the app can show "Last synced" offline.
11. **Idempotency**: message send uses `clientMessageId`; create-request and create-report accept an `Idempotency-Key` header.
12. **Rate limits** (express-rate-limit, per IP and per user): auth 10/min, OTP send 5/hour/email, message send 60/min, report 10/day, request create 10/day. Return `429` with `retryAfterSec`.
13. **Logging**: Pino, one `requestId` per request, never log passwords, OTPs, tokens or full phone numbers.
14. **Security headers**: helmet, strict CORS allowlist from `CORS_ORIGINS`, `express-mongo-sanitize`, body size limit 100 kb (uploads go straight to Cloudinary).

## 6. Data model (Mongoose)

Add `createdAt/updatedAt` to all. Index what is listed.

**User** — `code, email (unique, lowercase), emailVerified, phone (unique sparse, E.164), phoneVerified, phoneVerifiedBy (adminId|null), passwordHash (null for Google-only), googleId, name, language (bn|en), status (unverified|active|under_review|suspended|deleted), suspendedUntil, preferences{ appearance{theme:light|dark, followSystem, textScale, highContrast}, notifications{urgentRequests, messagesCalls, donationReminders, appNews}, safety{shareApproxAreaOnly:true, allowCalls:true} }, lastLoginAt, deletedAt`.

**DonorProfile** (1:1 with User) — `userId (unique), dob (private, must be ≥ 18 years), gender, division, district, area, location (GeoJSON Point, **fuzzed** to about 1 km, 2dsphere), locationPrecise (select:false), bloodGroup, weightKg, lastDonationDate, nextEligibleDate (computed), available (default false until registration complete), bio (≤ 240 chars), languages[], consents[{type, version, acceptedAt, ip, userAgent}], healthDeclaredAt, registrationStep (1–4), registrationCompletedAt, donationsCount`.

**Hospital** — `nameBn, nameEn, aliases[], division, district, area, location (Point, 2dsphere), verified`.

**BloodRequest** — `code, requesterId, patientName, bloodGroup, units (1–10), hospitalId?, hospitalNameText, hospitalVerified, division, district, area, location (Point from hospital, 2dsphere), neededBy, priority (urgent|routine), contactPhone (private), notes (≤ 500), status (pending_review|needs_info|approved|rejected|fulfilled|cancelled|expired), moderation{flags[], reviewedBy, reviewedAt, reason, checklist{hospitalExists, phoneVerified, noMoneyKeywords, familyConsent}}, pledgeCount, fulfilledAt`. Indexes: `{status, priority, neededBy}`, `{location:'2dsphere'}`, `{requesterId}`, text index on `patientName, hospitalNameText`.

**Pledge** — `requestId, donorId, status (offered|accepted|declined|donated|cancelled), note`. Unique `(requestId, donorId)`.

**Donation** — `donorId, requestId?, date, hospitalName, bloodGroup, units, recipientName?, source (confirmed|self_reported)`. The Donation History screen is labelled "self-reported".

**Review** — `donationId, authorId, targetUserId, rating (1–5), text (≤ 300), anonymous`. Unique `(donationId, authorId)`. Never expose the author when `anonymous`.

**Conversation** — `pairKey (sorted userIds, unique), participants[2], requestId?, lastMessage{type, preview, senderId, at}, lastMessageAt, unread{userId:n}`. **Message** — `conversationId, senderId, clientMessageId, type (text|image|audio|file|location|call_log|system), text, media{url, publicId, mime, bytes, durationSec, width, height, name}, location{lat, lng, label}, status (sent|delivered|read), deliveredAt, readAt, flags[]`. Index `{conversationId, _id:-1}`.

**Call** — `code, callerId, calleeId, conversationId, requestId?, channel, state (ringing|accepted|declined|missed|cancelled|ended|failed), answeredAt, endedAt, durationSec, endReason`.

**Notification** — `userId, type, title{bn,en}, body{bn,en}, data, readAt, expireAt (TTL 90 days)`. Types: `urgent_request_nearby, chat_message, incoming_call, missed_call, request_approved, request_rejected, request_needs_info, pledge_received, pledge_accepted, donation_reminder, review_prompt, report_update, app_news`.

**Device** — `userId, fcmToken (unique), platform, appVersion, locale, lastSeenAt`. **Block** — `blockerId, blockedId` (unique pair).

**Report** — `code, reporterId, targetUserId, requestId?, reason (money_demand|fake_or_misleading|harassment|spam_other), description, evidence[{url, publicId}], anonymous, priority (high|normal|low), status (open|in_review|needs_info|restricted|resolved|dismissed), assignedTo, notes[{adminId, text, at}], decision{outcome, note, decidedBy, at}`. Money-demand reports default to `priority: high`.

**AdminUser** — `email, name, role, passwordHash, status, lastLoginAt, totpSecret?`. **Session** — `code, subjectType (user|admin), subjectId, refreshHash, device, ip, expiresAt, revokedAt`. **Otp** — `subject, purpose (verify_email|admin_2fa|reset), codeHash, attempts, expiresAt (TTL)`.

**AppConfig** (versioned) — `version, status (draft|published), brand{ruby:'#B3123F', rose:'#F0466A', teal:'#12B5A6'}, theme{allowDark:true, followSystem:true, bnFont:'Hind Siliguri', enFont:'Inter', cardRadius:20, controlRadius:16}, safety{supportEmail, donationIntervalDays:120, searchRadiusKm:10, urgentRadiusKm:25, matchMode:'compatible', requestAutoPublish:true, moneyKeywords[], disclaimers{bn,en}}, limits{otpTtlSec:300, otpResendSec:30, otpMaxAttempts:5, minAge:18, softMinWeightKg:50, maxUnits:10, callRingSec:45, uploadMaxMb{image:5, audio:5, file:5}, audioMaxSec:180, urgentPushPerUserPerDay:3, fanoutCap:200, requestsPerDay:10}, contact{supportEmail, supportPhone}, publishedBy, publishedAt`.

**CmsString** — `key (unique), bn, en, screen, status (draft|in_review|published), translatorNote, version, updatedBy`. **CmsRelease** — `label ('v1.3'), stringCount, publishedBy, publishedAt`.

**FeatureFlag** — `key, titleBn, titleEn, description, environment (demo|staging|production), enabled, rolloutPercent (0–100), updatedBy, lastReason`. Unique `(key, environment)`.

**SupportPayment** — `code, userId, provider (bkash|nagad|rocket), amount (BDT), trxId (unique per provider), status (pending|success|failed), verifiedBy, verifiedAt`. **ProviderSetting** — `provider, enabled, receiverNumber`.

**AuditLog (append-only)** — `code, ts, actorId, actorName, actorRole, sessionCode, event, resourceType, resourceId, result, before, after, ip, prevHash, hash`. See §11.10.

**AppRelease** — `versionCode (int, unique, always increasing), versionName, channel (stable/beta), status (draft/verified/published/revoked), apkUrl (https), apkSha256, apkSizeBytes, signerCertSha256, mandatory, minSupportedVersionCode, rolloutPercent (0–100), notes{bn,en}, publishedBy, publishedAt, downloads, installs, failures`.

**ReportReason** — `key, label{bn,en}, defaultPriority, active, order` (seeded: money\_demand, fake\_or\_misleading, harassment, spam\_other). **NotificationTemplate** — `key, title{bn,en}, body{bn,en}, active`. **EmailTemplate** — `key, subject{bn,en}, html{bn,en}`. **JobRun** — `name, lastRunAt, lastStatus, lastDurationMs`. **DailyStats** — `date, donorsTotal, newDonors, activeRequests, urgentRequests, completedConnections, pendingReports, byDivision{8 keys}`. **Counter** — `key, seq`.

### 6.1 Nothing is hard-coded

Rule: any number, text, list or toggle a product owner could want to change is **data with a seeded default**, read through a cached `settings` service (in-memory, 60 s, cleared when an admin publishes). The code keeps only fallbacks, never business values.

| What | Stored in | Admin control |
| --- | --- | --- |
| Every UI text (all screens, onboarding, errors, empty states, consent text, support instructions) | `CmsString` | CMS strings (designed) |
| Brand colours, light/dark options, fonts, radii | `AppConfig.brand`, `AppConfig.theme` | App config (designed) |
| Safety and limits: donation interval, search radii, match mode, auto-publish, money keywords, disclaimers, OTP rules, min age, upload limits, call ring time, push caps, support contact | `AppConfig.safety`, `AppConfig.limits`, `AppConfig.contact` | App config → Safety (tab designed, content ours) |
| Feature on/off and rollout % per environment | `FeatureFlag` | Feature flags (designed) |
| Payment providers on/off, receiver numbers | `ProviderSetting` | Support payments (designed) |
| App versions, forced updates, rollout | `AppRelease` | **Releases (new screen, API now)** |
| Report reasons | `ReportReason` | API now, screen later |
| Divisions, districts, areas, hospitals | `Geo*`, `Hospital` | API now, screen later |
| Push and email texts | `NotificationTemplate`, `EmailTemplate` | API now, screen later |
| Admin accounts and roles | `AdminUser` | API now, screen later |

Stays in code: blood-group list, status and state enums, API contracts, security algorithms, geo maths. Seeds (§14) create every default; a fresh database must produce a fully working app with no manual data entry.

## 7. Authentication and security

### 7.1 Member auth (mobile)

- Access JWT 15 min; refresh token 30 days, **rotating**, stored hashed in `Session`; reuse of an old refresh token revokes the whole session family.
- Google sign-in: client sends a Google ID token; verify it with `firebase-admin` (or `google-auth-library`) against `GOOGLE_WEB_CLIENT_ID`; create or link the user by verified email.
- Unverified email cannot create requests, send messages or become available. Login returns `403 EMAIL_UNVERIFIED` with the resend info.
- Suspended users get `403 ACCOUNT_SUSPENDED` with a localized reason.
- **OTP**: 6 digits, stored hashed, valid 5 minutes, 5 attempts, resend after 30 s, max 5 sends/hour/email.
- **Forgot password**: always answer 200 (do not reveal whether the email exists). Email a link `WEB_URL/reset-password?token=…` valid 15 minutes, single use. The website page posts to `/auth/reset-password`.

### 7.2 Admin auth

- `POST /admin/auth/login` checks email + password and returns a `challengeId`; the 6-digit code arrives by email; `POST /admin/auth/verify-2fa` issues tokens.
- Access token 10 min; refresh in an `httpOnly; Secure; SameSite=Lax` cookie (works because of the Vercel rewrite), 8 h absolute, 30 min idle. Each login creates a `Session` with code `SESSION-0xx`; the audit log records `ADMIN_SIGN_IN`.
- Lock after 5 failed passwords for 15 minutes. No public admin signup: the first super admin is created from env at boot; others are invited by email.

### 7.3 Admin roles (RBAC middleware `requireRole`)

| Role | Can do |
| --- | --- |
| `super_admin` | Everything, manage admins, publish app config |
| `admin` | Users, requests, reports, flags, view audit |
| `moderator` | Requests and reports only |
| `content_editor` | CMS strings (submit for review), cannot publish |
| `finance` | Support payments, read-only elsewhere |

### 7.4 Data protection

- Blood group, last donation date, weight and DOB are **sensitive**: never in public responses; DOB never leaves the server (return age band only to admin).
- Phone numbers are returned **only** to their owner and (masked) to admins. Admin "reveal phone" is an explicit audited action.
- Public donor search returns only: display name, area, blood group, distance, availability, phoneVerified badge, donation count.
- **Location fuzzing**: store a rounded/jittered point (about 1 km) for discovery; keep the precise point private. Distances are computed from fuzzed points and rounded to 0.1 km.
- Account deletion: soft-delete, anonymise personal fields within 30 days, keep audit and report records without personal data. The Play Store needs a deletion path inside the app **and** on the website (§12).

## 8. Mobile app API (`/api/v1`)

"Auth" column: **P** = public, **U** = signed-in member (verified email), **O** = owner only.

### 8.1 Bootstrap and reference data

| Method + path | Auth | Notes |
| --- | --- | --- |
| `GET /app/bootstrap?platform=android&version=1.0.0` | P | One call at Splash: `{config, flags, stringsVersion, minVersionCode, forceUpdate, serverTime}`. Flags are evaluated for the caller when a token is present. |
| `GET /app/strings?lang=bn&since=<version>` | P | Returns `{version, strings:{key:text}}`; 304 if unchanged. Source: published CMS strings. |
| `GET /app/config`, `GET /app/flags` | P | Published config; flags for the current `APP_ENV`. Percentage rollout is deterministic: `hash(userId + flagKey) % 100 < rolloutPercent`. |
| `GET /geo/divisions`, `/geo/districts?division=`, `/geo/areas?district=` | P | Seeded static data, bilingual names, all 8 divisions and 64 districts. |
| `GET /hospitals?q=&district=` | U | Autocomplete for Create Request; matches Bengali, English and aliases. |

### 8.1.1 In-app self-update (APK from our website)

The app is not on Google Play, so it must update itself. Everything is controlled by `AppRelease` records that an admin manages (§11.11). `/app/bootstrap` also returns the same `update` object as the check below.

| Method + path | Auth | Notes |
| --- | --- | --- |
| `GET /app/update/check?versionCode=&deviceId=&abi=&channel=stable` | P | Returns `{updateAvailable, mandatory, blocked, latest:{versionCode, versionName, apkUrl, sha256, sizeBytes, signerCertSha256, notes (in the requested language), publishedAt}, minSupportedVersionCode}`. `blocked:true` when the installed version is below `minSupportedVersionCode`: the app must update before use. Optional updates follow `rolloutPercent` using `hash(deviceId + versionCode) % 100`; mandatory updates ignore rollout. |
| `POST /app/update/events` | P | `{versionCode, deviceId, event: seen/download_started/downloaded/installed/failed, error?}`. Only increments counters for the admin stats. |
| `GET /download/latest`, `GET /download/:versionCode` | P | 302 redirect to the APK URL and increments `downloads`. The website Download button uses this. |

Rules the Android agent must follow (put them in your contract summary): check at launch and every 6 hours; download only over HTTPS; verify the **SHA-256** and the **signing certificate** before installing; install with the system package installer (needs the install-unknown-apps permission, the app guides the user); always sign with the **same release keystore** (a lost keystore means every user must reinstall); `versionCode` must always increase. When an admin publishes a release the backend also sends an FCM topic message `release-stable` with `{type:"app_update", versionCode, mandatory}` so devices check immediately.

**Hosting the APK**: the API never stores the file. Use GitHub Releases (free, large files, recommended) or a static `/downloads` path on the Vercel website. Cloudinary raw upload only if the free plan's per-file limit allows an APK. The admin pastes the HTTPS URL; the backend verifies it (§11.11).

### 8.2 Auth

| Method + path | Notes |
| --- | --- |
| `POST /auth/register` | `{name, email, phone, password (≥ 8 chars), acceptTerms:true, language}` → 201; sends OTP email. Returns `{otp:{sentTo, expiresInSec:300, resendInSec:30}}`. |
| `POST /auth/verify-email` | `{email, code}` → tokens + user. |
| `POST /auth/resend-otp` | `{email, purpose}`; honours cooldown. |
| `POST /auth/login` | `{email, password, rememberMe, device:{id, platform, appVersion}, fcmToken?}` → tokens. "Remember me" extends refresh life to 30 days, otherwise 24 h. |
| `POST /auth/google` | `{idToken, device, fcmToken?}` |
| `POST /auth/refresh`, `/auth/logout`, `/auth/logout-all` | Rotating refresh. |
| `POST /auth/forgot-password`, `/auth/reset-password` | See §7.1. |
| `POST /auth/change-password` | U — `{current, next}`; revokes other sessions. |
| `DELETE /me` | U — `{password or otp}`; soft delete (§7.4). |

### 8.3 Profile, donor registration, settings

| Method + path | Notes |
| --- | --- |
| `GET /me` | Account + donor profile + preferences + unread counters + `registrationStep`. |
| `PATCH /me` | `{name, language}` |
| `PUT /me/donor-profile/steps/1` | Personal: `{dob, gender, phone}` (name comes from the account). Reject under 18 with `DONOR_UNDERAGE`. Idempotent. |
| `PUT /me/donor-profile/steps/2` | Location: `{division, district, area, lat?, lng?}`. App passes GPS coordinates; reverse geocoding happens on the device. Backend fuzzes and stores. |
| `PUT /me/donor-profile/steps/3` | Health: `{bloodGroup, lastDonationDate?, weightKg, selfDeclaredHealthy:true}`. |
| `PUT /me/donor-profile/steps/4` | Consent: `{consents:[{type, version}], }` — the three checkboxes plus the "blood is never sold" pledge. Store IP and user agent. Completing step 4 sets `registrationCompletedAt` and `available=true`. |
| `GET/PATCH /me/donor-profile` | Edit profile: `bio, languages[], area, weightKg, lastDonationDate`. |
| `PATCH /me/availability` | `{available}`. Returns `{available, nextEligibleDate}`. If `nextEligibleDate` is in the future, still allow but return `warning: "RECENT_DONATION"` (the app is advisory, not medical). |
| `PATCH /me/location` | Update approximate location. |
| `GET/PATCH /me/preferences` | Appearance (theme, followSystem, textScale, highContrast), notification toggles, safety toggles, language. |
| `GET /me/blocks`, `POST /users/:id/block`, `DELETE /users/:id/block` | Blocking hides both users from each other in lists, chat and calls. |
| `POST /me/devices`, `DELETE /me/devices/:id` | Register/refresh FCM token on login and on token refresh. |
| `GET /me/stats` | `{donationsCount, joinedYear, lastDonationDate}` for the Profile screen. |

**Eligibility helper**: `nextEligibleDate = lastDonationDate + safety.donationIntervalDays` (default 120, editable in App config). It drives reminders and match filtering. It is never presented as a medical decision.

### 8.4 Home and donors

| Method + path | Notes |
| --- | --- |
| `GET /home?lat=&lng=` | `{availability, nearbyRequests (3), nearbyDonors (3), unread:{notifications, chats}}`. One call for the Home screen. |
| `GET /donors?bloodGroup=&radiusKm=&lat=&lng=&available=true&cursor=` | "Find donors". Uses `$geoNear` on fuzzed points. Excludes the caller, blocked users, unavailable and suspended users. |
| `GET /donors/:userId` | Public donor card: `{displayName, area, bloodGroup, phoneVerified, donationsCount, distanceM, available, lastDonationDate (date only), languages, bio}`. No phone, no DOB. |
| `POST /donors/:userId/request` | "Send blood donation request" to one donor: `{requestId}` (must be the caller's own approved request). Creates a notification and a chat message of type `system`. |

### 8.5 Blood requests and pledges

| Method + path | Notes |
| --- | --- |
| `GET /requests?tab=all/urgent/mine&q=&bloodGroup=&division=&radiusKm=&sort=nearest/newest/neededBy&lat=&lng=&cursor=` | Only `approved` requests are public. `tab=mine` shows the caller's own in any status. Response items: `{id, code, patientName, bloodGroup, units, hospitalName, area, neededBy, priority, distanceM, status}`. Meta includes `urgentCount` ("3 urgent requests"). |
| `POST /requests` | `{patientName, bloodGroup, units, hospitalId or hospitalNameText, neededBy (future), priority, contactPhone, notes}`. Run moderation (§15). Returns request + `shareUrl` (`WEB_URL/r/REQ-1042`). Status `approved` or `pending_review` per §2.3 item 3. |
| `GET /requests/:id` | Detail with hospital `{name, lat, lng, directionsUrl}`, requester `{displayName, relation?, phoneVerified}`, `myPledge`, `canEdit`. `contactPhone` only for the owner. |
| `PATCH /requests/:id` | O — allowed while not fulfilled; material edits send it back to review. |
| `POST /requests/:id/cancel`, `POST /requests/:id/fulfill` | O — fulfil `{donorIds[], units}` creates `Donation` records (source `confirmed`), moves pledges to `donated`, and queues review prompts for both sides. |
| `GET /me/requests?status=active/completed` | The "My requests" tabs and the Empty state. |
| `POST /requests/:id/pledge` | "I can help" — `{note?}`. Notifies the owner. Block if the donor's blood group is not compatible (§15) or the donor is the owner. |
| `DELETE /requests/:id/pledge` | Withdraw. |
| `GET /requests/:id/pledges`, `POST /pledges/:id/accept`, `POST /pledges/:id/decline` | O — accepting opens a chat thread automatically. |

### 8.6 Chat, uploads and calls (REST side)

| Method + path | Notes |
| --- | --- |
| `POST /uploads/sign` | `{purpose: chat_image/chat_audio/chat_file/report_evidence, mime, bytes}` → Cloudinary signed-upload params (folder per purpose and user, size and type allow-lists: images ≤ 5 MB, audio ≤ 5 MB / 3 min, PDF ≤ 5 MB). Client uploads directly. When the client later sends the asset URL, verify it starts with our cloud name and folder. |
| `GET /conversations?tab=all/unread&q=` | Chat list with `{peer:{id, displayName}, lastMessage:{type, preview}, lastMessageAt, unreadCount, requestCode}`. Preview for audio is a type, not text, so the app can show "Voice message · 0:18". |
| `POST /conversations` | `{userId, requestId?}` → get-or-create. Allowed only when there is a shared request/pledge or the peer's profile allows contact. Blocked users get `403`. |
| `GET /conversations/:id/messages?before=&limit=30` | Newest first. |
| `POST /conversations/:id/messages` | REST fallback; same payload as the socket event. Idempotent by `clientMessageId`. |
| `POST /conversations/:id/read` | Marks all read, resets `unread`. |
| `POST /calls` | `{calleeId, conversationId, requestId?}` → `{callId, code, channel, appId, uid, token, ringTimeoutSec:45}`. Requires flag `in_app_calls` for both users, `allowCalls` on the callee, no block. |
| `POST /calls/:id/accept` | Callee gets `{channel, appId, uid, token}`. |
| `POST /calls/:id/decline` | `{replyMessage?}` — the "reply with message" option sends it as a chat message. |
| `POST /calls/:id/cancel`, `POST /calls/:id/end` | Caller cancels while ringing; either side ends an active call. |

### 8.7 Donations, reviews, reports, notifications, support

| Method + path | Notes |
| --- | --- |
| `GET /me/donations?cursor=` | History with `{id, date, hospitalName, bloodGroup, units, recipientName, source, hasReview}` and `meta.totalCount` ("৬ বার"). |
| `POST /me/donations` | "Add donation info" — self-reported. Updates `lastDonationDate` if newer. |
| `POST /donations/:id/review` | `{rating 1–5, text, anonymous}`. One per donation per author. |
| `POST /reports` | `{targetUserId, requestId?, reason, description, evidence:[{url, publicId}], anonymous, alsoBlock}` → `{code}`. "Your report stays confidential": the reported user never sees who reported. |
| `GET /notifications?tab=all/requests/system&cursor=` | Items carry `type`, localized `title/body`, `data` for deep links, `readAt`. |
| `POST /notifications/read` | `{ids[]}` or `{all:true}`. |
| `GET /support/providers`, `POST /support/payments`, `GET /me/support/payments` | Phase 2, behind flag `support_payments`. Create `{provider, amount, trxId}` → `pending`. No donor or patient may be asked to pay anything. |

## 9. Realtime: chat and calls

**Socket.IO** on the same server. Auth: access JWT in the handshake (`auth.token`). Each user joins room `user:{id}`. If the token expires, the client reconnects with a fresh one.

Client → server events (all with ack callbacks): `message:send {conversationId, clientMessageId, type, text?, media?, location?}`, `message:read {conversationId, upToMessageId}`, `typing:start/stop {conversationId}`, `presence:ping`. Server → client events: `message:new`, `message:status {id, status}`, `typing`, `conversation:updated`, `call:incoming`, `call:state {callId, state}`, `notification:new`, `flag:changed`.

Message flow: validate membership and block status → persist → ack with the saved message → emit `message:new` to the peer → if the peer has no live socket, send an FCM push (if `messagesCalls` is on) → mark `delivered` when the peer acks. Scan text with the money/OTP keyword filter; flagged messages still deliver but set `flags` and create a low-priority admin signal. The chat safety banner ("don't share personal documents, OTP or money") is a client string.

**Call flow (Agora, audio only)**

1. Caller `POST /calls` → server creates `Call(state=ringing)`, builds an Agora RTC token for the caller (role publisher, 1 hour). Channel name `bl_<callCode>`. Agora needs a numeric uid: derive a stable 32-bit uid per user.
2. Server sends **FCM high-priority data message** `{type:"incoming_call", callId, callerName, requestCode, channel}` to all of the callee's devices, and emits `call:incoming` on the socket. The Android agent shows the full-screen incoming call UI (and the notification banner when the app is in the foreground state).
3. Callee `accept` → server issues the callee token, sets `accepted`, notifies the caller (`call:state`). `decline` → `declined`, optional quick reply message. No answer in 45 s → `missed` (job or timer), callee gets a `missed_call` notification.
4. Either side `end` → store `durationSec` and insert a `call_log` message into the conversation.
5. One active call per user. A second `POST /calls` while busy returns `409 USER_BUSY`.

## 10. Push notifications (Firebase)

- Use `firebase-admin` messaging with the HTTP v1 API. Remove tokens that return `UNREGISTERED`.
- Send **data messages** for calls and chat so the app builds its own notification; use notification + data for everything else.
- Texts are rendered server-side from bilingual templates, in the recipient's language.
- **Urgent request fan-out** (when a request becomes `approved`): find donors with `available=true`, completed registration, not blocked, `urgentRequests` on, `nextEligibleDate ≤ neededBy`, blood group matching per `safety.matchMode` (`exact` or `compatible`), inside `urgentRadiusKm` (urgent) or `searchRadiusKm` (routine). Cap at 200 recipients per request, at most 3 urgent pushes per user per day, skip the requester. Save a `Notification` row for each, then batch-send.
- Compatibility for whole blood (recipient → allowed donors): `A+`: A+, A−, O+, O−; `A−`: A−, O−; `B+`: B+, B−, O+, O−; `B−`: B−, O−; `AB+`: all; `AB−`: AB−, A−, B−, O−; `O+`: O+, O−; `O−`: O−. Hospital staff make the final call; the copy must say so.
- Other pushes: pledge received/accepted, request approved/rejected/needs info, report update, donation reminder (opt-in), review prompt after fulfilment, missed call, app news (opt-in, admin-triggered later).

## 11. Admin API (`/api/v1/admin`)

Every route needs an admin token and the role in §7.3. Every write creates an **audit event** with `before/after`. List endpoints use `page/limit` and return `meta.total`. The top-bar bell uses `GET /admin/notifications` (new high-priority report, request waiting over 30 min) plus `GET /admin/stream` (Server-Sent Events).

### 11.1 Auth and sessions

`POST /admin/auth/login` → `{challengeId}`; `POST /admin/auth/verify-2fa {challengeId, code}`; `POST /admin/auth/refresh`; `POST /admin/auth/logout`; `POST /admin/auth/forgot-password`, `/reset-password`; `GET /admin/me`; `GET /admin/sessions`, `DELETE /admin/sessions/:id`; `POST /admin/admins` (super\_admin: invite by email with role), `PATCH /admin/admins/:id`.

### 11.2 Overview

`GET /admin/overview?range=30d` returns:

- `kpis`: `donors {total:12480, deltaThisMonth}`, `activeRequests {total, urgent}`, `completedConnections {total}`, `pendingReports {total, highPriority}`.
- `byDivision`: all 8 divisions with completed-connection counts for the range.
- `recentActivity[]`: latest audit-style events (verification done, urgent request published, new report, content update, safety review).
- `attentionRequests`: page of requests needing action (`REQ code, patient, hospital, group, due, status`).

Precompute heavy numbers into a `DailyStats` collection (job §13) so the page is fast on the free database. `GET /admin/overview/export?format=csv` downloads the "report".

### 11.3 Users

`GET /admin/users?q=&status=all/active/under_review&bloodGroup=&district=&page=` (search by name, masked phone or `USR-` code) with `stats {donors, available, pendingVerification}`; `GET /admin/users/:id` (code, area, member since, self-reported donation count, last donation, flags, report count); `POST /admin/users/:id/verify-phone {note}`; `POST /admin/users/:id/reveal-phone {reason}` (audited); `POST /admin/users/:id/review {decision: approve/hold}`; `POST /admin/users/:id/suspend {reason, until?}`; `POST /admin/users/:id/restore`; `GET /admin/users/export?format=csv` (masked fields only).

### 11.4 Requests (moderation)

`GET /admin/requests?tab=all/review/urgent/completed&q=&division=&page=` with tab counts (`all 86, review 9, urgent 68`); `GET /admin/requests/:id` with the **checklist**: `hospitalExists`, `requesterPhoneVerified`, `noMoneyKeywords` (auto) and `familyConsent` (manual toggle); `POST /admin/requests/:id/approve` (triggers fan-out, notifies requester); `POST /admin/requests/:id/ask-info {message}` (status `needs_info`, push to requester); `POST /admin/requests/:id/reject {reason}`; `POST /admin/requests/:id/complete`. The UI shows one status badge mixing priority and state, so also return a `displayStatus`.

### 11.5 Reports

`GET /admin/reports?tab=all/high/closed&q=&page=`; `GET /admin/reports/:id` (reporter, reported user, linked request, statement, evidence thumbnails with short-lived signed URLs, notes); `POST /admin/reports/:id/assign {adminId}`; `POST /admin/reports/:id/notes {text}`; `POST /admin/reports/:id/ask-info {message}`; `POST /admin/reports/:id/restrict {days, reason}` (temporary restriction, applies to the reported user); `POST /admin/reports/:id/resolve {outcome: warning/restricted/dismissed, note}`. Resolving notifies the reporter in a neutral way. Decisions are written to the audit log.

### 11.6 App config

`GET /admin/app-config` (draft + published + diff), `PUT /admin/app-config/draft` (validate hex colours, radii 0–32, known font names, interval and radius ranges), `POST /admin/app-config/publish {reason}` (bumps `version`, 'save changes' button), `POST /admin/app-config/reset-draft` ("Restore default"), `GET /admin/app-config/history`. Add a contrast check: warn when brand colour on white or dark surface falls below WCAG AA 4.5:1. Android reads published config at Splash. Fonts are bundled in the app; the config only selects among bundled fonts.

### 11.7 CMS strings

`GET /admin/cms/strings?q=&status=all/draft/published&screen=&page=` plus summary (`total 628, drafts 8, completeness`); `POST /admin/cms/strings`; `PUT /admin/cms/strings/:key` (save draft); `POST /admin/cms/strings/:key/submit-review` ("Send for review"); `POST /admin/cms/strings/:key/approve`; `POST /admin/cms/releases/publish {label}` (snapshots all approved strings, bumps the version the app sees, e.g. `v1.3`); `GET /admin/cms/releases`; import/export JSON. **Validation to enforce** (the design says so): both `bn` and `en` required to publish; the Bengali text must contain Bengali script (reject Roman-letter Bangla); keys follow `area.name`; placeholders like `{name}` must match in both languages; translator note is optional.

### 11.8 Feature flags

`GET /admin/flags?env=demo/staging/production`; `POST /admin/flags`; `PUT /admin/flags/:key {env, enabled, rolloutPercent, reason}` where `reason` is **mandatory**; the response includes who changed it and when. After a change, emit socket event `flag:changed` and bump the flags ETag. Seed flags: `nearby_requests` 100%, `in_app_calls` 25%, `donation_reminders` 100%, `support_payments` 10%, `new_profile_layout` 0% (off).

### 11.9 Support payments

`GET /admin/support/summary` (`totalThisMonth: 18450`, `contributions: 86`, `pending: 3`); `GET/PUT /admin/support/providers/:provider {enabled, receiverNumber}` for bKash, Nagad, Rocket; `GET /admin/support/payments?q=&status=all/success/pending&page=`; `GET /admin/support/payments/:id` (receipt data); `POST /admin/support/payments/:id/confirm` and `/fail`. The page always carries the policy text: support is voluntary, never tied to blood, no priority for supporters. Enforce it in code: a support payment can never be linked to a request or donor.

**Manual payment flow (owner decision)**: no provider API is used. An admin sets, per provider, `enabled` and the personal `receiverNumber`; the instruction text for each provider comes from CMS keys `support.instruction.bkash/nagad/rocket`. The member sends money with the provider's own app, then submits `{provider, amount, trxId, senderLast4?}` (flag `support_payments`). It is saved as `pending`; the finance admin checks the transaction in their own provider app and presses **confirm** or **fail**. Rules: `trxId` unique per provider (duplicate → `409`), amount between configurable min and max, rate-limited, every decision audited (`SUPPORT_CONFIRMED`, `SUPPORT_FAILED`), receipts are generated from the stored record.

### 11.10 Audit log

- Collection is **append-only**: no update or delete routes, and Mongoose hooks that throw on `update*/delete*`.
- Event names seen in the design: `ADMIN_SIGN_IN, USER_VERIFIED, REQUEST_APPROVED, REPORT_ASSIGNED, CMS_DRAFT_SAVED, FLAG_UPDATED`. Add the rest in the same style (`REQUEST_REJECTED, REPORT_RESOLVED, USER_SUSPENDED, PHONE_REVEALED, CONFIG_PUBLISHED, CMS_RELEASE_PUBLISHED, SUPPORT_CONFIRMED, ADMIN_INVITED`).
- **Integrity**: `hash = sha256(prevHash + canonicalJson(event))`. `GET /admin/audit/verify` re-walks the chain and reports the first break ("Integrity protected").
- `GET /admin/audit?range=today/7d/30d&q=&actor=&event=&page=`; `GET /admin/audit/:id` returns the detail card (actor, session, resource, time in BST, before, after); `GET /admin/audit/export?format=csv`.
- Mask sensitive values in `before/after` (phones, emails, tokens).

### 11.11 App releases (new screen, API now)

The design has no screen for this; build the API and tell the admin-web agent to add an **App releases** page in the same style. Roles: `super_admin`, `admin`.

- `GET /admin/releases?status=&page=`; `POST /admin/releases` (draft) with `{versionCode, versionName, channel, apkUrl, notes{bn,en}, mandatory, minSupportedVersionCode, rolloutPercent}`; `PUT /admin/releases/:id` (drafts only).
- `POST /admin/releases/:id/verify`: the backend streams the file at `apkUrl` (never stores it), checks HTTPS, that it is a ZIP/APK (`PK` header), reads the size, computes `apkSha256`, and saves them. Streaming keeps memory low on Render free.
- `POST /admin/releases/:id/publish {reason}`: only when verified and `versionCode` is higher than every published one; sends the FCM topic message; audited as `RELEASE_PUBLISHED`.
- `POST /admin/releases/:id/revoke {reason}`: update checks fall back to the previous published release. `PATCH /admin/releases/:id/rollout {rolloutPercent}`.
- `GET /admin/releases/:id/stats` and `GET /admin/stats/versions`: downloads, installs, failures, and how many active devices run each `versionCode` (from `Device.appVersion`).

### 11.12 Reference data, rules and people (APIs now, screens later)

All writes are audited and take effect through the `settings` cache (§6.1).

- Geo: `GET/POST/PUT/DELETE /admin/geo/divisions`, `/districts`, `/areas` (always keep the 8 divisions).
- Hospitals: `GET/POST/PUT /admin/hospitals`, `POST /admin/hospitals/:id/verify`, `POST /admin/hospitals/import` (CSV).
- Report reasons: `GET/POST/PUT /admin/report-reasons`.
- Texts: `GET/PUT /admin/notification-templates/:key`, `GET/PUT /admin/email-templates/:key`.
- Broadcast: `POST /admin/broadcasts {title{bn,en}, body{bn,en}, audience:{all or division or bloodGroup}, scheduleAt?}` sends an "app news" push to users who allow it; rate-limited; audited.
- Admins: `GET/POST/PATCH /admin/admins` (invite, role, disable), see §11.1.

## 12. Public website API (`/api/v1/public`)

The Vercel website has: Home/landing, About, How it works, Safety and "Blood is never sold" promise, Donor eligibility FAQ (with the "not medical advice" notice), Download (Play link and APK), Support/Contact, Privacy Policy, Terms, **Delete my account**, and a request share page. Legal and marketing copy lives in the website repo.

| Method + path | Notes |
| --- | --- |
| `GET /public/stats` | Rounded donor count, completed connections, divisions covered. Cached 10 minutes. |
| `GET /public/app-release` | From `AppConfig.release`: version, `apkUrl`, `playUrl`, `sha256`, bilingual notes. |
| `GET /public/requests/:code` | Share page. Minimal and safe: blood group, units, hospital name, area, needed-by, status. **No patient name, no phone.** Includes an "Open in app" deep link and the Download button. |
| `POST /public/contact` | `{name, email, message}`; rate-limited; emails the support inbox through Resend; add a honeypot field. |
| `POST /public/account-deletion` | `{email}` → emails a confirmation link; the link calls `POST /public/account-deletion/confirm {token}`. This satisfies the Play Store web deletion requirement. |

**Download page (replaces the `app-release` row above)**: `GET /public/app-release` returns `{versionName, versionCode, sizeBytes, sha256, publishedAt, notes{bn,en}, downloadUrl}` from the latest published stable `AppRelease`, where `downloadUrl` is `API_URL/download/latest`. The page also shows install help ("allow installs from this source") from CMS keys `web.download.*`, the SHA-256 for people who want to check the file, and a link to older versions (`GET /public/app-releases`, published only). Add `Cache-Control: public, max-age=300`.

The `reset-password` page on the website posts to `/auth/reset-password`. Add `/.well-known/assetlinks.json` support so app links open the Android app.

## 13. Background jobs

Render's free plan has no cron and sleeps when idle, so **never rely on in-process timers**. Use **UptimeRobot** (free, 5-minute interval) with two HTTP monitors: `GET /healthz` (keeps the service awake and alerts on downtime) and `GET /internal/tick?key=<JOB_SECRET>` (runs the scheduled work). `/internal/tick` is idempotent and finishes in under 10 seconds: it reads `JobRun`, runs each job below only when it is due, processes heavy jobs in small batches, and returns `{ran:[...]}`. A late tick simply catches up on the next call. Also accept `POST /internal/jobs/:name` with header `X-Job-Secret` for manual runs. **Call timeouts must not wait for a tick**: keep a 45-second in-memory timer on the live instance, and also treat any `ringing` call older than 45 s as `missed` when it is next read.

| Job | Frequency | Action |
| --- | --- | --- |
| `expire-requests` | 15 min | `approved` requests past `neededBy + 24h` → `expired`; notify owner. |
| `missed-calls` | 1 min if any ringing | Ringing calls older than 45 s → `missed`. |
| `donor-reminders` | daily 09:00 BST | Opt-in users whose `nextEligibleDate` is today. |
| `stale-moderation` | 30 min | Notify admins about requests under review for more than 30 minutes. |
| `daily-stats` | daily | Fill `DailyStats` for the Overview page. |
| `cleanup` | daily | Expired OTPs, revoked sessions, orphan uploads (if tracked), account anonymisation after 30 days. |
| `audit-verify` | daily | Verify the hash chain; alert on break. |

## 14. Seed and demo data

- `npm run seed:base`: 8 divisions, 64 districts, main areas for Dhaka, 40+ hospitals (Dhaka Medical College Hospital, BSMMU, Square Hospital, Labaid Hospital Dhanmondi, Chattogram Medical, etc.) with coordinates, default AppConfig, feature flags, all CMS strings extracted from the designs (the Bengali and English lines on every screen), first super admin.
- `npm run seed:demo` (only if `SEED_DEMO=true`): users that match the Figma content so the apps look like the designs: Rafi Ahmed (B+, Dhanmondi, `USR-0248`), Nusrat Jahan (request `REQ-1042`, B+, Dhaka Medical College Hospital), Tanvir Hasan (`REQ-1041`), Mehedi Zaman, Sadia Rahman, Farhana Akter, Md. Kamal Hossain, plus 12,480-style bulk counts generated by script. Admin demo: Sadia Rahman (`admin`), Ariful Islam (`moderator`). Also demo reports `RPT-015…018`, support payments `SUP-0083…0086`, audit events.
- Never run demo seed in production.

## 15. Business and safety rules (must be enforced in code)

1. **Blood is never sold.** Scan request notes, chat text and report text for money terms (Bengali and English: টাকা, পেমেন্ট, বিকাশ, নগদ, রকেট, দাম, বিক্রি, `taka, tk, pay, payment, price, rate, sell, bkash, nagad, rocket`). A hit on a request → `pending_review` plus `noMoneyKeywords:false` in the checklist. A hit in chat → flag only (no auto-ban, to avoid false positives). Keep the list editable in `AppConfig.safety.moneyKeywords`.
2. **Donors must be 18 or older.** Reject otherwise.
3. **Phone and DOB are never public.** See §7.4.
4. **Consent is recorded**, versioned and timestamped; re-consent is required when the consent version changes.
5. **No medical claims.** The API never returns "eligible" or "safe to donate" as a verdict. Use `nextEligibleDate` and let hospitals decide.
6. **Blocking and suspension** are enforced in every list, chat, call and notification query.
7. **Abuse limits**: a user with 3 rejected requests in 30 days is auto-flagged `under_review`. A user with an upheld money-demand report is restricted automatically until an admin reviews.
8. **Self-contact rule**: a request owner's contact phone is only revealed to a donor whose pledge was accepted, and only inside the chat/call UI (never as plain text in lists).
9. **Emergencies**: the app is not an ambulance or emergency service. Keep the disclaimer in `AppConfig.safety.disclaimers`.

## 16. Deployment and free-tier realities

**Render (backend)**: Web Service, Node 20, region Singapore, build `npm ci && npm run build`, start `node dist/server.js`, health check `/healthz`, auto-deploy from `main`. Provide `render.yaml`. Set all env vars in the dashboard.

**Vercel**: two projects (`admin`, `website`). The admin project uses `vercel.json` rewrites: `/api/:path* → https://<render-service>/api/:path*`. The backend `CORS_ORIGINS` allows only the Vercel domains and the custom domain.

**Domains**: `APP_DOMAIN` (default `bloodlink.tech`) → website `https://bloodlink.tech`, admin `https://admin.bloodlink.tech`, API `https://api.bloodlink.tech` as a Render custom domain with its free TLS certificate. Put the Android `assetlinks.json` on the website domain. Check SPF, DKIM and DMARC for the Resend domain before the first real email.

**MongoDB Atlas M0**: create user with a strong password, network access `0.0.0.0/0` (Render free has no fixed IP, so credentials and TLS are the protection). Add all indexes at boot in code (`autoIndex` on for non-production, explicit `syncIndexes` script for production). Store backups manually (`mongodump`) because M0 has no automated backup.

Things the free plan **cannot** hide — handle them honestly:

| Item | Reality | Mitigation in this design |
| --- | --- | --- |
| Render free sleeps after \~15 min idle, cold start up to about a minute, sockets drop | Calls and chat feel broken after idle | FCM wakes the app and carries calls/messages; external cron ping every 5–10 min; reconnect logic in the app; **plan the low paid Render tier before public launch**. |
| bKash / Nagad / Rocket APIs | Need merchant onboarding | Manual TrxID flow (§2.3 item 5). Adapter interface `PaymentProvider` for later. |
| SMS OTP | Not free in Bangladesh | Email OTP + admin-verified phone (§2.3 item 1). |
| Agora free minutes, Cloudinary credits, Resend daily limit | All have monthly caps | Add usage counters and log warnings at 80%; compress images client-side; cap audio length. |
| Vercel Hobby plan | Intended for non-commercial projects | Fine for the start; revisit if you take support payments or sponsors. |
| Maps | Not in your service list | Backend only stores coordinates. The Android agent can use OpenStreetMap-based maps (free) or Google Maps (needs a billing account with free credit). |

Suggested free additions: **Sentry** (errors), **UptimeRobot** (uptime pings), **Firebase Crashlytics** (Android crashes), **GitHub Actions** (cron + CI). One-time paid item if you publish on Google Play: the developer registration fee.

## 17. Phases, testing and deliverables

| Phase | Scope | Done when |
| --- | --- | --- |
| P0 Foundation | Empty-folder scaffold (§0.2), env validation, error envelope, logging, health, Mongo connection, counters, OpenAPI skeleton, Render deploy | `/healthz` is live on Render |
| P1 Auth + bootstrap | §7, §8.1, §8.2, Resend OTP, Google sign-in, sessions, strings/config/flags read endpoints, app update check (§8.1.1) | Register → OTP → login works end to end |
| P2 Profile + geo | §8.3, §8.4 donors, geo seed, hospitals | 4-step donor registration saves and resumes |
| P3 Requests | §8.5, moderation, fan-out + FCM | Create → approve → push to nearby donor |
| P4 Chat + uploads | §8.6, §9 chat, Cloudinary signing | Text, image, voice, PDF, location messages with receipts |
| P5 Calls | §9 call flow, Agora tokens, FCM data push | Two phones complete an audio call |
| P6 Community | Donations, reviews, reports, blocks, notifications | Report appears in admin triage |
| P7 Admin | §11 (all admin screens incl. Releases), RBAC, audit chain | Every admin screen has working endpoints and demo data |
| P8 Website + jobs | §12, §13 | Share page, download page data and deletion flow live |
| P9 Hardening | Rate limits, load test, security review, backups, docs | Checklist below passes |

**Testing**: unit tests for services (OTP, moderation, compatibility, rollout hashing, audit chain); integration tests per module with Supertest and an in-memory MongoDB; one test per error code in the catalogue; a socket test for message + call flow. Target at least 80% coverage on `services/` and `modules/*/service.ts`.

**Deliverables each phase**: working code on `main`, updated `openapi.yaml`, Postman collection, `README` with run instructions, and a short "Contract summary" listing new endpoints, socket events and error codes.

**Final acceptance checklist**

- Every mobile screen in §2.1 and every admin screen in §2.2 maps to working endpoints and seed data.
- No public response contains phone, DOB, exact location, password hash, tokens or OTP.
- Bengali and English strings exist for every error, push and CMS key.
- Audit chain verifies; audit collection rejects updates and deletes.
- App runs correctly after a Render cold start (reconnect + FCM fallback tested).
- All secrets come from env; `.env.example` is complete; no secrets in git.
