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

Render Free is appropriate for a short judging demo, but its local disk is ephemeral: its SQLite database is lost after a redeploy, restart, or idle spin-down. Create a fresh judge account after deployment and do not treat this option as permanent storage.

### Persistent production deployment

For persistent SQLite, use an always-on host with a mounted disk and set `DATABASE_PATH` to the disk path (for example, `/var/data/abhyudaya.db`). The server supports that path and refuses to start in production without `JWT_SECRET`.

For a fully free persistent public build, migrate the SQLite layer to a managed Postgres database such as Supabase before deploying the Node service. Free web hosts do not preserve a local SQLite file. Keep the database connection string and JWT secret only in the host environment-variable dashboard, never in frontend code or Git.
