# MediTrack

A calm, private place to organise medicines, doses, stock and expiry dates for a whole
family — built as a MERN monorepo (MongoDB, Express, React, Node).

> **MediTrack is a record-keeping tool.** It does not diagnose illness, prescribe or change
> treatment, recommend alternative medicines, or decide whether a medicine is safe for you.
> Everything in your records is entered and confirmed by you. Always follow the advice of a
> qualified healthcare professional.

**Live deployment**
- Frontend (Vercel): <https://medi-track-app-nine.vercel.app>
- API (Render): <https://medi-track-app-b7ig.onrender.com> — health check at `/api/v1/health`
- Database: MongoDB Atlas

---

## Features

- **Accounts & sessions** — email + password (bcrypt), JWT in an HttpOnly, SameSite cookie.
- **Family hub** — one workspace, many profiles: the owner, connected adult accounts
  (consent-based, granular permissions) and managed profiles (children, no login needed).
- **Medicines** — manual entry with an autocomplete reference list (brand + generic name,
  strength and form). Schedules support daily, selected weekdays, every N days, specific
  dates, or as-needed.
- **Doses & reminders** — generated from the schedule in your timezone; mark taken /
  skipped / snoozed; a background scheduler raises reminders and missed-dose alerts.
- **Stock ledger** — every refill/adjustment recorded; doses deduct stock exactly once.
- **Expiry tracking** — warnings at 30/7/1 days, a separate *expired* list, and a dedicated
  **missing-expiry** list. A missing date is never treated as expired.
- **Medicine name pronunciation** — a small speaker button (browser speech synthesis) where
  speech is available, and it silently disappears where it is not.
- **Reports & history** — adherence and stock history, filterable by profile, with CSV export.
- **Care plans** — short courses with a planned review date.
- **Appearance** — light and dark modes, 12 selectable palettes.
- **Privacy controls** — per-profile authorisation on every request, delete scans/allergies/
  profiles, and full account + data deletion (password-confirmed).

There is **no image/AI medicine scanning** — medicines are entered by hand.

---

## Tech stack

| Layer | Stack |
| --- | --- |
| Client | React 18, Vite 6, React Router 6, TanStack Query 5, react-hook-form + zod, Tailwind CSS, lucide-react, recharts, dayjs |
| Server | Node 18+, Express 4, Mongoose 8, zod, helmet, cors, cookie-parser, jsonwebtoken, bcryptjs, express-rate-limit, morgan, multer, web-push |
| Tests | Vitest, Supertest, mongodb-memory-server (server) · Vitest, Testing Library, jsdom (client) |

---

## Project structure

```
.
├── client/                 # React SPA (Vite)
│   ├── src/
│   │   ├── components/     # ui/, app/, public/
│   │   ├── context/        # auth, workspace, toasts
│   │   ├── pages/          # public/ and app/ pages
│   │   ├── theme/          # light/dark palettes
│   │   └── lib/            # api client, formatting helpers
│   └── vercel.json         # Vercel config when Root Directory = client
├── server/                 # Express API
│   ├── src/
│   │   ├── config/         # env + database
│   │   ├── data/           # curated medicine reference sample
│   │   ├── jobs/           # background scheduler
│   │   ├── middleware/     # auth, validation, uploads, errors
│   │   ├── models/         # mongoose models
│   │   ├── routes/         # REST endpoints
│   │   ├── services/       # doses, stock, notifications, storage, …
│   │   └── validators/     # zod schemas
│   └── tests/              # Vitest + Supertest
├── vercel.json             # Vercel config when Root Directory = repo root
├── render.yaml             # Render blueprint for the API
└── package.json            # npm workspaces (server, client)
```

---

## Getting started (local)

**Requirements:** Node.js 18 or newer, npm.

```bash
# 1. install dependencies for both workspaces
npm install

# 2. configure the server
cp server/.env.example server/.env      # Windows: copy server\.env.example server\.env
#    leave MONGODB_URI empty for a zero-config in-memory database, or paste a
#    MongoDB connection string (local mongod or Atlas)

# 3. (optional) client environment
cp client/.env.example client/.env      # Windows: copy client\.env.example client\.env

# 4. run the API and the SPA together
npm run dev
```

- API: <http://localhost:5000> · health check <http://localhost:5000/api/v1/health>
- Client: <http://localhost:5173> (proxies `/api` to the API)

With an empty database in development the server seeds a demo workspace:

```
demo@meditrack.test / Password123
```

> The demo account is only created in development. Production never seeds data — sign up
> with a new account there.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + client together (concurrently) |
| `npm run dev:server` / `npm run dev:client` | One side only |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Start the API (`server/src/server.js`) |
| `npm run seed` | Write the synthetic demo workspace into the configured database |
| `npm test` | Server tests, then client tests |
| `npm run test:server` / `npm run test:client` | One side only |
| `npm run lint` | ESLint for the client |

---

## Environment variables

### Server (`server/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` requires `MONGODB_URI` |
| `PORT` | `5000` | Render supplies this automatically |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin(s); comma-separated list supported, trailing slash is fine |
| `MONGODB_URI` | *(empty)* | Empty in development boots an in-memory MongoDB |
| `MONGODB_DB_NAME` | `meditrack` | |
| `JWT_SECRET` | dev placeholder | **Set a long random value in production** |
| `JWT_EXPIRES_IN` | `7d` | |
| `COOKIE_NAME` / `COOKIE_SECURE` / `COOKIE_SAME_SITE` | `meditrack_token` / prod `true` / `lax` | Set `COOKIE_SAME_SITE=none` only if the API is called cross-origin |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` / `STORAGE_DRIVER` | `./storage/uploads` / `10` / `local` | |
| `OCR_PROVIDER` / `OCR_API_KEY` | `none` | Optional text-extraction provider |
| `MEDICINE_INFO_PROVIDER` | `none` | Optional trusted medicine information source |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | *(empty)* | Optional Web Push |
| `ENABLE_SCHEDULER` / `SCHEDULER_INTERVAL_MS` | `true` / `60000` | Background reminder job |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | `900000` / `300` / `30` | |

### Client (`client/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_BASE` | `/api/v1` | Relative keeps the SPA and API on one origin — recommended |
| `VITE_API_TARGET` | `http://localhost:5000` | Dev-server proxy target (not bundled) |

`VITE_*` values are inlined into the browser bundle at build time — never put secrets there.

---

## Testing

```bash
npm test          # server: 93 tests · client: 37 tests
npm run lint      # client ESLint
npm run build     # production build of the client
```

Server tests run against an in-memory MongoDB, so no local database is required.

---

## API overview

Base path: `/api/v1` (all routes require an authenticated session except `/auth/*` and `/health`).

| Route | Purpose |
| --- | --- |
| `/health` | Service + database status |
| `/auth` | Register, log in, log out |
| `/users` | Profile, preferences, password, workspace, account deletion |
| `/families`, `/family-members` | Family workspace, members, permissions, invitations |
| `/medicines` | Medicine CRUD, expiry views, stock transactions |
| `/doses` | Today's doses and dose actions (taken / skipped / snoozed) |
| `/stock` | Stock summary |
| `/care-plans` | Temporary care plans and reviews |
| `/notifications` | In-app notifications |
| `/reports` | Adherence, stock history, expiry (including missing expiry), family summary |
| `/allergies` | User-recorded allergies |
| `/medicine-info` | Reference lookup **and** the autocomplete catalogue (`/search`) |

---

## Deployment

The project runs as three services: **MongoDB Atlas** (database), **Render** (API) and
**Vercel** (SPA).

### 1. MongoDB Atlas
1. Create a free **M0** cluster.
2. **Database Access** → add a user; **Network Access** → allow `0.0.0.0/0` (Render's free
   tier has no static IPs).
3. Copy the connection string for `MONGODB_URI`.

### 2. Render (API)
- **Build Command:** `npm install` · **Start Command:** `npm start`
- **Health Check Path:** `/api/v1/health`
- Environment: `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DB_NAME`,
  `JWT_SECRET`, `CLIENT_ORIGIN=https://<your-frontend>.vercel.app`,
  `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `ENABLE_SCHEDULER=true`
- `render.yaml` is a Blueprint for exactly this service.

### 3. Vercel (SPA)
- Root Directory: repo root (or `client`), Build Command `npm run build`,
  Output Directory `client/dist` (or `dist` when Root Directory is `client`).
- The client calls a **relative** `/api/v1`, so Vercel must proxy `/api/*` to the API. This
  repo keeps the rewrite in **both** config files on purpose, so the correct one is used
  whichever Root Directory you pick:

  | `vercel.json` location | Used when |
  | --- | --- |
  | `vercel.json` (repo root) | Root Directory = repo root |
  | `client/vercel.json` | Root Directory = `client` |

  Each contains:

  ```json
  { "source": "/api/:path*", "destination": "https://<your-api>.onrender.com/api/:path*" }
  ```

  **Update that destination** to your Render URL after deploying the API. The proxy keeps the
  browser on a single origin, so the session cookie stays first-party and no cross-origin
  cookie/CORS problems arise.

---

## Notes & limitations

- **No scanning UI.** The medicine-scanning screens were removed; medicines are added by hand.
  The `/api/v1/prescriptions` endpoints still exist in the API but are not reachable from the UI.
- **Medicine reference data is a small curated sample**, not a complete registry — the app
  never claims otherwise, and any medicine can still be entered manually.
- **Optional integrations are off by default** (`OCR_PROVIDER=none`,
  `MEDICINE_INFO_PROVIDER=none`); the app reports them as unavailable rather than inventing data.
- **Render's free tier sleeps** after a period of inactivity, so the first request may be slow.
