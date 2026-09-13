# Abhyudaya

Abhyudaya is a full-stack RPG productivity application. The existing `dashboard.html` Command Centre is the authenticated home, while `quests.html` is the dedicated Quest Log. Their shared menu connects the visual screens.

## Run locally

1. Copy `.env.example` to `.env` and set a long, unique `JWT_SECRET`.
2. Run `npm install`.
3. Run `npm start` and open `http://localhost:3000`.

Do not open the HTML files directly when using the application features: authentication and the API require the local server.

## Implemented systems

- Password-hashed account registration, login, logout, and HTTP-only JWT sessions
- SQLite-backed users, characters, onboarding choices, quests, immutable task history, shop inventory, ascension claims, achievement claims, and activity logs
- User-scoped API authorization for every protected record
- Create, list, edit, delete, and complete quests
- Server-side, transactional XP, gold, attribute, streak, and level updates
- Non-linear level thresholds (`100 × level²` XP) and immutable completion records
- Server-enforced shop purchases, inventory ownership, equipping, consuming, and salvaging
- Claimable achievement bounties and server-validated ascension allocations
- Persistent sound/motion preferences, live XP telemetry, and exportable activity data

The three ascension celebration variants remain available as `levelup.html`, `levelup-2.html`, and `levelup-3.html`.

## Public deployment for judges

This is a same-origin Express application: deploy the pages and `/api/*` backend together. Deploying only the HTML as a static site will break login and real-time progression.

### Fast free judge preview (Render)

1. Push this `lifequest` folder to a GitHub repository. Never commit `.env` or `lifequest.db`.
2. In Render select **New → Web Service**, connect the repository, and set:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment: `NODE_ENV=production`
   - Secret: `JWT_SECRET` set to a long random value (for example, `openssl rand -hex 32`).
3. Share the resulting `https://…onrender.com` address. First open `/api/health` and confirm it returns `status: ok`.

### Vercel + Supabase production deployment

The app now runs on Supabase Postgres, not a local SQLite file. In Supabase SQL Editor, run `supabase/schema.sql` once. In Vercel, add `DATABASE_URL` from **Supabase → Connect → Transaction pooler** (port 6543), `JWT_SECRET`, and `NODE_ENV=production` for Production and Preview. Do not set `DATABASE_PATH`, and do not expose the database URL, database password, or service-role key in browser code.

Vercel serves the app from `public/` and runs `api/[...path].js` for every `/api/*` route. The Postgres client is configured for serverless transaction pooling: one connection, TLS, and prepared statements disabled.
