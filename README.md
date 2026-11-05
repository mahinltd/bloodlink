# BloodLink Backend

Node.js 20+ and strict TypeScript backend for the BloodLink Android app, admin dashboard, and public website.

## P0 foundation

1. Copy `.env.example` to `.env`.
2. Set a reachable `MONGODB_URI` and replace development-only secret placeholders.
3. Install dependencies with `npm install`.
4. Run `npm run build`.
5. Start with `npm run dev` or `npm start`.

The service exposes `GET /healthz` and the initial `GET /api/v1/app/bootstrap` contract. Driver-specific credentials are required only when the corresponding non-stub driver is selected.

Production URLs are derived from environment configuration: website `https://bloodlink.tech`, admin `https://admin.bloodlink.tech`, and API `https://api.bloodlink.tech`.

All dates returned by the API are ISO-8601 UTC values. User-facing text is reserved for the CMS and will be added in later phases.
