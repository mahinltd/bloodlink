# Contract Notes

The backend keeps the existing routes for compatibility and adds the exact master-prompt paths below.

- Public share page: `/api/v1/public/requests/:code` and legacy `/api/v1/share/requests/:code`.
- Public website data: `/api/v1/public/stats`, `/api/v1/public/app-release`, `/api/v1/public/app-releases`, `/api/v1/public/contact`.
- Mobile request actions: `/api/v1/requests/:id/cancel`, `/api/v1/requests/:id/pledges`, and `/api/v1/requests/pledges/:pledgeId/accept`; the earlier nested accept path remains supported.
- Mobile account actions: `/api/v1/auth/logout-all`, `/api/v1/auth/change-password`, `/api/v1/me/donor-profile`, `/api/v1/me/location`, `/api/v1/me/preferences`, `/api/v1/me/blocks`, `/api/v1/me/devices/:id`, `/api/v1/me/stats`, and `/api/v1/me/requests`.

The API uses `/api/v1/geo/hospitals` in the current client contract; the exact `/api/v1/hospitals` alias remains to be added with the hospital route split.
