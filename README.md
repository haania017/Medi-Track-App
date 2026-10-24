# MediTrack

MediTrack is a full-stack MERN application (MongoDB, Express, React, Node) for organising
medicines, doses, stock and expiry dates for a whole family. Each person you care for gets
their own profile with their own medicines, schedules, dose history, stock and expiry dates,
so nothing gets mixed up and nothing gets forgotten.

It is a **record-keeping tool**: it does not diagnose illness, prescribe or change treatment,
recommend alternative medicines, or decide whether a medicine is safe for you. Everything in
your records is entered and confirmed by you. Always follow the advice of a qualified
healthcare professional.

**Contents:** [Demo account](#demo-account) · [Features](#features) · [Tech stack](#tech-stack) ·
[Project structure](#project-structure) · [Prerequisites](#prerequisites) ·
[Setup](#installation-and-setup) · [Environment variables](#environment-variables) ·
[Database](#database-setup) · [Running the app](#running-the-app) ·
[Authentication](#authentication-and-authorization) · [API reference](#api-reference) ·
[Testing](#testing) · [Deployment](#deployment) · [Troubleshooting](#troubleshooting) ·
[Security](#security-notes) · [Future improvements](#future-improvements)

---

## Demo account

A working demo account is created by the seed script. It is a normal account created through
the same code path as a real sign-up, and it comes with sample data.

| | |
| --- | --- |
| **Email** | `demo@meditrack.test` |
| **Password** | `Password123` |
| **Role** | Family owner (full access to the demo workspace) |
| **Workspace** | `Demo Family` — 3 profiles: *Demo Caregiver* (Self, owner), *Ayesha* (Daughter, managed profile), *Imran* (Father, invited adult account) |

**Create it (or reset it):**

```bash
# from the project root
npm run seed
```

**Log in:** start the app (`npm run dev`), open <http://localhost:5173>, click **Log in**, and
enter the credentials above.

**What the demo data contains**

- 5 medicines — Metformin 500 mg, Atorvastatin 10 mg, Vitamin D3 2000 IU, Amoxicillin 250 mg
  suspension, Paracetamol 120 mg syrup — spread across two profiles, with schedules and stock.
- Expiry dates in three states: 2 expiring within 30 days, 1 already expired, so the Expiry
  page and its reminders are populated.
- Dose history (past doses recorded as taken / skipped / missed) plus doses due today.
- One care plan ("Chest infection — antibiotic course") awaiting review.
- One recorded allergy (Penicillin) for the child profile.

**Notes**

- In **development**, if the database is empty, the server seeds the demo workspace
  automatically on first boot. Production never seeds automatically — run `npm run seed`
  explicitly against a real database if you want the demo there.
- `npm run seed` rebuilds the demo account and *its* family only; it does not touch other
  accounts. Do not run it against a database that holds real patient records.
- You can also create your own account from **Sign up** and use the same features.
- The demo medicines all have an expiry date, so the **Missing expiry** list starts empty. Add
  a medicine and leave the expiry field blank to see that list populate.

---

## Features

- **Accounts & sessions** — email/password registration and login, bcrypt password hashing,
  JWT session in an HttpOnly cookie, per-request authorisation.
- **Family hub** — one workspace with the owner, consent-based connected adult accounts
  (granular permissions) and managed profiles for children (no login required).
- **Medicines** — manual entry with an autocomplete reference list (brand and generic name,
  strength, dosage form). Any medicine can be typed manually.
- **Schedules** — daily, selected weekdays, every N days, specific dates, or as-needed;
  interpreted in your account timezone.
- **Doses & reminders** — upcoming doses generated from the schedule; mark taken, skipped or
  snoozed; a background scheduler raises reminders, missed-dose alerts, low-stock alerts,
  expiry warnings and care-plan review prompts.
- **Stock** — quantity on hand, low-stock threshold and a full transaction ledger; recording a
  dose deducts stock exactly once.
- **Expiry tracking** — warnings at 30 / 7 / 1 days, an *expired* list, and a separate
  **missing-expiry** list. A missing date is never treated as expired.
- **Medicine name pronunciation** — a speaker button that reads the name aloud using the
  browser speech synthesis API; it disappears when speech is unavailable.
- **Reports** — adherence and stock history, filterable by profile, exportable as CSV.
- **Care plans** — short courses with a planned review date and a review decision.
- **Notifications** — in-app notification centre; optional Web Push when VAPID keys are set.
- **Appearance** — light and dark modes with 12 palettes.
- **Privacy controls** — per-profile authorisation, delete scans/allergies/profiles, and
  password-confirmed deletion of the whole account and the data it owns.

There is no image/AI medicine scanning — medicines are entered by hand.

---

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, React Router 6, TanStack Query 5, react-hook-form + zod, Tailwind CSS 3, lucide-react, recharts, dayjs |
| Backend | Node.js 18+, Express 4, Mongoose 8, zod (validation), helmet, cors, cookie-parser, jsonwebtoken, bcryptjs, express-rate-limit, morgan, multer, web-push |
| Database | MongoDB (local `mongod` or MongoDB Atlas; in-memory MongoDB for development/tests) |
| Testing | Vitest, Supertest, mongodb-memory-server (server) · Vitest, Testing Library, jsdom (client) |
| Tooling | npm workspaces (monorepo), ESLint, concurrently |

---

## Project structure

```
MediTrack/
├── client/                     # React single-page app (Vite)
│   ├── src/
│   │   ├── components/         # ui/ (primitives), app/ (app shell), public/ (marketing)
│   │   ├── context/            # Auth, Workspace, Toast providers
│   │   ├── pages/              # public/ pages and app/ pages
│   │   ├── theme/              # light/dark palettes
│   │   ├── lib/                # api client, formatting helpers
│   │   └── test/               # test setup
│   ├── .env.example
│   └── vercel.json             # Vercel config when Root Directory = client
├── server/                     # Express API
│   ├── src/
│   │   ├── config/             # env loading, database connection
│   │   ├── data/               # curated medicine reference sample
│   │   ├── jobs/               # background scheduler
│   │   ├── middleware/         # auth, validation, uploads, rate limits, errors
│   │   ├── models/             # Mongoose models
│   │   ├── routes/             # REST endpoints
│   │   ├── services/           # doses, stock, notifications, storage, seeding, …
│   │   ├── utils/              # helpers, logger, serializers
│   │   ├── validators/         # zod schemas
│   │   ├── app.js              # Express app factory
│   │   ├── seed.js             # `npm run seed`
│   │   └── server.js           # entry point
│   ├── tests/                  # Vitest + Supertest suites
│   └── .env.example
├── vercel.json                 # Vercel config when Root Directory = repo root
├── render.yaml                 # Render blueprint for the API
├── package.json                # npm workspaces (server, client) + scripts
└── README.md
```

---

> Note: server/.env.example is git-ignored and is **not** part of the repository - the tree above
> shows the working copy only. Create server/.env yourself (see Environment variables).

## Prerequisites

- **Node.js 18 or newer** — `node -v`
- **npm 9 or newer** — `npm -v` (ships with Node)
- **MongoDB 6+** — *optional for local development* (the server falls back to an in-memory
  MongoDB), **required for production** (local `mongod` or MongoDB Atlas)
- **Git** — to clone the repository

---

## Installation and setup

All commands are run from the **project root** (the folder containing the root
`package.json`) unless stated otherwise. The examples use a Unix-style shell; on Windows
Command Prompt use the `copy` variant shown, and on PowerShell they work as-is.

```bash
# 1. get the code
git clone <your-repository-url>
cd MediTrack

# 2. install dependencies for both workspaces (server + client)
npm install

# 3. create the server environment file
#    create server/.env yourself (it is git-ignored) with at least:
#      NODE_ENV=development
#      PORT=5000
#      CLIENT_ORIGIN=http://localhost:5173
#      JWT_SECRET=<any long random string>
#      MONGODB_URI=               # empty = in-memory MongoDB in development

# 4. (optional) create the client environment file
cp client/.env.example client/.env
#    Windows (cmd):      copy client\.env.example client\.env

# 5. seed the demo account (optional, but recommended — see "Demo account")
npm run seed

# 6. start the API and the client together
npm run dev
```

> `server/.env` is git-ignored. Never commit it, and never commit real credentials.

---

## Environment variables

**Only what you need locally is nothing at all** — the defaults boot a working development
setup. Configure the rest as you deploy.

### Server — `server/.env` (git-ignored - create it yourself)

| Variable | Example / default | Required | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | no | `production` enforces production behaviour |
| `PORT` | `5000` | no | Render supplies its own `PORT` |
| `CLIENT_ORIGIN` | `http://localhost:5173` | no | Allowed CORS origin(s). Comma-separated list is supported; a trailing slash is tolerated |
| `MONGODB_URI` | *(empty)* | **yes in production** | Empty in development starts an in-memory MongoDB |
| `MONGODB_DB_NAME` | `meditrack` | no | Database name |
| `DEV_PERSIST_DB` | `false` | no | `true` keeps the embedded development database on disk |
| `JWT_SECRET` | `change-me-to-a-long-random-string` | **yes** | Signing key for session tokens — use a long random value in production |
| `JWT_EXPIRES_IN` | `7d` | no | Session lifetime |
| `COOKIE_NAME` | `meditrack_token` | no | Session cookie name |
| `COOKIE_SECURE` | `false` (prod `true`) | no | Must be `true` when served over HTTPS |
| `COOKIE_SAME_SITE` | `lax` | no | Use `none` **only** if the API is called cross-origin |
| `UPLOAD_DIR` | `./storage/uploads` | no | Private storage for uploads |
| `MAX_UPLOAD_MB` | `10` | no | Upload size limit |
| `STORAGE_DRIVER` | `local` | no | `local` (S3 is not enabled in this build) |
| `OCR_PROVIDER` | `none` | no | `none` · `openai` · `mock` — optional text extraction |
| `OCR_API_KEY` | *(empty)* | no | Only for `OCR_PROVIDER=openai` |
| `OCR_BASE_URL` / `OCR_MODEL` | OpenAI defaults | no | Provider endpoint and model |
| `MEDICINE_INFO_PROVIDER` | `none` | no | `none` · `rxnorm` · `mock` — optional reference data |
| `MEDICINE_INFO_API_KEY` / `MEDICINE_INFO_BASE_URL` | *(empty)* / RxNav | no | Provider settings |
| `MEDICINE_INFO_CACHE_TTL_HOURS` | `168` | no | Reference-data cache lifetime |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | *(empty)* | no | Optional Web Push |
| `ENABLE_SCHEDULER` | `true` | no | Background reminder job |
| `SCHEDULER_INTERVAL_MS` | `60000` | no | How often the scheduler runs |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | `900000` / `300` / `30` | no | Rate limiting |

### Client — `client/.env` (template: `client/.env.example`)

| Variable | Example / default | Notes |
| --- | --- | --- |
| `VITE_API_BASE` | `/api/v1` | Base URL for API calls. The relative default is recommended (same origin as the API) |
| `VITE_API_TARGET` | `http://localhost:5000` | Dev-server proxy target, read by `vite.config.js` (not bundled) |

> Vite inlines every `VITE_*` value into the JavaScript bundle at build time, so anything in
> `client/.env` is **public**. Never put secrets there.

**Generating a strong `JWT_SECRET`:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Database setup

The API connects to MongoDB on start-up.

### Option A — in-memory (fastest, development only)

Leave `MONGODB_URI` empty in `server/.env`. The server starts an embedded MongoDB so you need
no local install. **Data is lost when the server restarts** (unless you set
`DEV_PERSIST_DB=true`, which keeps it on disk under `server/.data/mongo`).

In development, if the database is empty, the demo workspace is seeded automatically.

### Option B — local MongoDB

1. Install and start MongoDB (`mongod`) locally — the default port is `27017`.
2. In `server/.env`:

   ```
   MONGODB_URI=mongodb://localhost:27017/meditrack
   MONGODB_DB_NAME=meditrack
   ```

3. Seed the demo data:

   ```bash
   npm run seed
   ```

### Option C — MongoDB Atlas (production)

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → allow `0.0.0.0/0` for Render (its free tier has no static IPs).
4. Copy the connection string and put it in `server/.env` (or the hosting dashboard):

   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=meditrack
   ```

URL-encode any special characters in the password. `MONGODB_URI` is mandatory when
`NODE_ENV=production` — the server refuses to start without it.

**Check the connection:** `GET /api/v1/health` reports `"database": "connected"`.

---

## Running the app

| Command | What it starts |
| --- | --- |
| `npm run dev` | API **and** client together (recommended) |
| `npm run dev:server` | API only |
| `npm run dev:client` | Client only |
| `npm start` | API only, production style (`server/src/server.js`) |
| `npm run build` | Production build of the client into `client/dist` |

**Local URLs and ports**

| Service | URL |
| --- | --- |
| Client (SPA) | <http://localhost:5173> |
| API | <http://localhost:5000> |
| Health check | <http://localhost:5000/api/v1/health> |
| API base path | <http://localhost:5000/api/v1> |

The Vite dev server proxies `/api` to `http://localhost:5000` (override with
`VITE_API_TARGET`), so the browser stays on one origin throughout development.

---

## Authentication and authorization

**Authentication**

- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` issue a signed **JWT**
  (`HS256`, `JWT_SECRET`, `JWT_EXPIRES_IN`) and set it in an **HttpOnly** cookie
  (`COOKIE_NAME`, default `meditrack_token`). The SPA never reads the token from JavaScript —
  requests are sent with `credentials: 'include'`.
- Passwords are hashed with **bcrypt**; the hash is never returned by the API.
- Login returns the same message for an unknown email and a wrong password, so accounts
  cannot be enumerated.
- `POST /api/v1/auth/logout` clears the cookie. Changing the password increments the user's
  `tokenVersion`, which invalidates every previously issued token.
- `GET /api/v1/auth/me` returns the signed-in user.

**Cookie flags:** `httpOnly`, `secure` (on in production), `sameSite` from `COOKIE_SAME_SITE`
(`lax` by default), path `/`, 7-day lifetime.

**Authorization**

- Every route except `/health`, `/auth/register` and `/auth/login` requires a valid session.
- Requests are authorised against the **specific family profile** involved
  (`view`, `manageMedicines`, `markDoses`, `manageStock`, `manageCarePlans`, `manageProfile`).
  Ownership is never taken from the request body, and a profile you cannot access returns
  **404**, not 403, so family data cannot be probed.
- Family owners can change or revoke other members' permissions; owners always have full access.

**Rate limiting:** `apiLimiter` on all `/api/v1` routes, `authLimiter` on the auth routes, and
`uploadLimiter` on uploads. Limits are configurable and disabled during tests.

---

## API reference

Base path: `/api/v1`. All routes require a session unless marked *public*. Responses use a
`{ "data": ..., "meta": ... }` envelope; errors use `{ "error": { "message", "code" } }`.

| Method & path | Purpose |
| --- | --- |
| `GET /health` | *public* — service, database, scheduler and integration status |
| `POST /auth/register` | *public* — create an account and log in |
| `POST /auth/login` | *public* — log in |
| `POST /auth/logout` | Clear the session cookie |
| `GET /auth/me` | Current user |
| `GET /users/me` · `PATCH /users/me` | Read / update profile (name, timezone, locale) |
| `PATCH /users/me/preferences` | Appearance and notification preferences |
| `POST /users/me/password` | Change password |
| `GET /users/me/workspace` | User, family and accessible profiles in one call |
| `DELETE /users/me` | Delete the account and the data it owns (password-confirmed) |
| `GET|POST /families` · `GET /families/:id` | Family workspace and members |
| `POST /families/:id/members` | Add a managed profile or invite an adult |
| `GET|PATCH|DELETE /family-members/:id` | Read / update / remove a profile |
| `PATCH /family-members/:id/permissions` | Owner-only permission changes |
| `GET /family-members/invitations` · `POST /family-members/:id/accept` | Adult invitations |
| `GET|POST /medicines` | List (filter by profile, status, search, low stock) / create |
| `GET|PATCH /medicines/:id` | Medicine detail / update |
| `POST /medicines/:id/archive` | Archive (history preserved) |
| `GET|POST /medicines/:id/stock-transactions` | Stock ledger / record a change |
| `GET /medicines/expiring` · `GET /medicines/expired` | Expiry views |
| `GET /doses/today` · `GET /doses` | Today's doses / dose history |
| `POST /doses/:id/mark-taken` · `/mark-skipped` · `/snooze` | Record a dose action |
| `GET /stock/summary` | Stock overview |
| `GET|POST /care-plans` · `PATCH /care-plans/:id` | Care plans |
| `POST /care-plans/:id/review` | Complete or continue a plan |
| `GET /notifications` · `POST /notifications/:id/read` | Notification centre |
| `GET /reports/adherence` · `/stock-history` · `/expiry` · `/family-summary` | Reports (CSV via `?format=csv`) |
| `GET|POST /allergies` · `PATCH|DELETE /allergies/:id` | User-recorded allergies |
| `GET /medicine-info/status` · `GET /medicine-info/search?q=` · `GET /medicine-info/:medicineId` | Reference lookup and autocomplete |

---

## Testing

```bash
npm test              # server, then client
npm run test:server   # server only
npm run test:client   # client only
npm run lint          # ESLint (client)
npm run build         # production build of the client
```

**Current results (last run): server 93 tests in 13 files, client 37 tests in 7 files — all
passing.**

Server tests use an embedded MongoDB (`mongodb-memory-server`), so they never touch your real
database. Client tests run in jsdom with Testing Library.

---

## Deployment

The application runs as three services: **MongoDB Atlas** (database), **Render** (API) and
**Vercel** (client).

### 1. MongoDB Atlas

Create the cluster and database user as described in
[Database setup → Option C](#option-c--mongodb-atlas-production) and copy the connection
string.

### 2. Render — API

- **Repository / branch:** your repository, branch `main`
- **Root Directory:** leave empty (the repository root)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/v1/health`

Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string |
| `MONGODB_DB_NAME` | `meditrack` |
| `JWT_SECRET` | a long random string |
| `CLIENT_ORIGIN` | your deployed frontend origin, e.g. `https://your-app.vercel.app` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `lax` |
| `ENABLE_SCHEDULER` | `true` |

`render.yaml` contains the same service as a Render Blueprint. `PORT` is provided by Render.

### 3. Vercel — client

- **Root Directory:** the repository root (or `client`)
- **Build Command:** `npm run build`
- **Output Directory:** `client/dist` (or `dist` when Root Directory is `client`)
- **Install Command:** `npm install`

The client calls a **relative** `/api/v1`, so Vercel must proxy `/api/*` to the API service.
Keeping the browser on one origin means the session cookie stays first-party and no
cross-origin cookie or CORS problems arise. The rewrite is present in **both** config files so
the correct one applies whichever Root Directory you choose:

| File | Used when |
| --- | --- |
| `vercel.json` (repository root) | Root Directory = repository root |
| `client/vercel.json` | Root Directory = `client` |

Both contain:

```json
{ "source": "/api/:path*", "destination": "https://<your-api>.onrender.com/api/:path*" }
```

**After deploying the API, update that destination to your Render URL** and redeploy the
client. Finally, set Render's `CLIENT_ORIGIN` to the Vercel URL so the API accepts requests
from it.

---

## Troubleshooting

**`npm install` / build fails with `ENOENT: no such file or directory, open '.../package.json'`**
The repository root must contain `package.json` (it defines the npm workspaces and the
`start`/`build` scripts). If it is missing, the build fails before anything runs. Restore it
and redeploy.

**The frontend loads but API calls return `404 Not Found`**
Vercel is not proxying `/api`. Check that `vercel.json` (or `client/vercel.json`, depending on
the Root Directory) contains the `/api/:path*` rewrite and that its `destination` is your
actual API URL — not a Vercel URL.

**`Error: Not allowed by CORS` or a 500 on `/assets/*.js`**
`CLIENT_ORIGIN` on the API must match the frontend origin exactly (trailing slashes and letter
case are normalised). CORS is applied to `/api` routes only; if a build ever mounts it
globally, static asset requests get rejected too.

**Login succeeds but every following request says unauthenticated**
The API and the client are on different sites, so the cookie is third-party and browsers block
it. Use the same-origin Vercel proxy (recommended), or set `COOKIE_SAME_SITE=none` **and**
`COOKIE_SECURE=true` and accept that some browsers still refuse third-party cookies.

**All data disappears after a restart**
You are on the in-memory development database. Set `MONGODB_URI` (local `mongod` or Atlas), or
set `DEV_PERSIST_DB=true` to keep the embedded database on disk.

**`EADDRINUSE` / port already in use**
Another server is still running. Stop it (`Ctrl+C`, or kill the process) or change `PORT`.

**The demo login is rejected**
The demo account only exists after seeding. Run `npm run seed` against the same database the
server uses (or, in development, start the server against an empty database so it seeds
automatically). Production never seeds on its own.

**Scheduler reminders are not appearing**
The reminders are produced by the background scheduler. Confirm `ENABLE_SCHEDULER=true`, and
remember that the scheduler only runs while the API process is awake — Render's free tier
sleeps when idle.

---

## Security notes

- Secrets live only in environment variables; `.env` files are git-ignored and the client
  bundle never contains them.
- Passwords are hashed with bcrypt; tokens are signed with `JWT_SECRET` and delivered in
  HttpOnly cookie, and are invalidated on password change.
- Helmet sets security headers; CORS is restricted to the configured origin(s) with
  credentials enabled — never a wildcard.
- Every API request is authorised against the specific family profile, and unauthorised
  profiles return 404 to avoid leaking their existence.
- Request bodies are validated with zod on both the server (authoritative) and the client
  (fast feedback); rate limiting protects the API and the auth endpoints.
- Uploads are size- and MIME-restricted and stored privately; files are only served through an
  authenticated controller.
- Server logs avoid secrets and sensitive payloads.
- Medical safety: the app states plainly that it is not medical advice and never claims that an
  expired medicine is safe, guesses a missing expiry date, or invents medicine information.

Before a real deployment: use a strong `JWT_SECRET`, enable `COOKIE_SECURE`, restrict the
database network allow-list, and keep dependency updates current.

---

## Future improvements

- Replace the small curated medicine list with an official registered-products dataset.
- A real OCR provider for reading packaging, with the review step that already exists.
- Email delivery for adult invitations and account recovery.
- Refresh-token rotation, optional two-factor authentication and session management UI.
- Object storage (S3) for uploads and scheduled purging of retained files.
- Adherence trends and exportable printable reports; multi-language UI.
- Offline-capable PWA with background dose reminders.

---

## License

This project is provided for educational and demonstration purposes. MediTrack is not a
medical device and is not a substitute for professional medical advice.
