# MediTrack

A MERN monorepo (MongoDB, Express, React, Node) for organising medicines, doses, stock and
expiry dates for a family.

> MediTrack is a record-keeping tool. It does not diagnose illness, prescribe treatment, or
> decide whether a medicine is safe for you.

Live: frontend on Vercel — <https://medi-track-app-nine.vercel.app> · API on Render —
<https://medi-track-app-b7ig.onrender.com> (`/api/v1/health`) · database on MongoDB Atlas.

## What's in it

- Email/password accounts with a JWT HttpOnly session cookie (bcrypt hashing).
- Family hub: owner, connected adult accounts with permissions, and managed profiles.
- Medicines: manual entry with an autocomplete reference list (brand / generic, strength,
  form); schedules for daily, selected weekdays, every N days, specific dates or as-needed.
- Doses: generated from the schedule, with taken / skipped / snoozed and reminders from a
  background scheduler.
- Stock: quantity, low-stock threshold and a full transaction ledger (doses deduct once).
- Expiry: expiring-soon warnings, an expired list, and a separate **missing-expiry** list
  (a missing date is never treated as expired).
- Medicine-name pronunciation via the browser speech synthesis API (hidden if unsupported).
- Reports with adherence/stock summaries and CSV export; care plans; notifications.
- Light/dark modes with 12 palettes.
- Privacy: per-profile authorisation on every request, delete scans/allergies/profiles, and
  password-confirmed account deletion.

There is no image/AI scanning — medicines are entered by hand.

## Stack

- **Client** (`client/`): React 18, Vite 6, React Router 6, TanStack Query, react-hook-form +
  zod, Tailwind CSS.
- **Server** (`server/`): Express 4, Mongoose 8, zod, helmet, cors, jsonwebtoken, bcryptjs,
  express-rate-limit, multer.
- **Tests**: Vitest + Supertest (+ mongodb-memory-server) for the server; Vitest + Testing
  Library for the client.

```
client/   React SPA (src/pages, src/components, src/context, src/theme, src/lib)
server/   API (src/routes, src/models, src/services, src/middleware, src/validators, tests/)
```

## Run locally

Requires Node 18+.

```bash
npm install
cp server/.env.example server/.env     # Windows: copy server\.env.example server\.env
npm run dev                            # API :5000 + client :5173
```

Leave `MONGODB_URI` empty to use an in-memory database in development; in development an empty
database is seeded with `demo@meditrack.test` / `Password123`.

## Scripts

```
npm run dev            # API + client together
npm run build          # build the client into client/dist
npm start              # start the API
npm run seed           # write the demo workspace
npm test               # server tests, then client tests
npm run lint           # client ESLint
```

## Environment

- Server: see `server/.env.example` (database, `JWT_SECRET`, `CLIENT_ORIGIN`, cookie flags,
  rate limits, optional providers).
- Client: see `client/.env.example` (`VITE_API_BASE`, defaults to the relative `/api/v1`).

## Tests

```bash
npm test    # server: 93 tests · client: 37 tests
```

Server tests use an in-memory MongoDB, so no local database is needed.

## Deploying

Three services: **MongoDB Atlas** (database) → **Render** (API: `npm install` / `npm start`,
health check `/api/v1/health`) → **Vercel** (SPA: build `npm run build`, output `client/dist`).

The client calls a relative `/api/v1`, so Vercel must proxy `/api/*` to the Render URL. That
rewrite lives in `vercel.json` (repo root) and `client/vercel.json` — whichever matches the
Vercel Root Directory is used. The server allows the deployed origin via `CLIENT_ORIGIN` (plus
localhost for development).

## Notes

- The medicine reference list is a small curated sample, not a complete registry; any medicine
  can still be typed manually.
- Optional integrations default to off (`OCR_PROVIDER=none`, `MEDICINE_INFO_PROVIDER=none`) and
  report themselves as unavailable instead of inventing data.
- Render's free tier sleeps when idle, so the first request may be slow.
