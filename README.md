# BookPrepper

Spoiler-free “prep” companion for thoughtful reading. This monorepo contains:

- `apps/api`: Fastify 5 + Prisma REST API (MySQL).
- `apps/web`: Vite + React client with AWS Amplify-authenticated UX.
- `packages/db`: Shared Prisma schema/client + seed data (75+ classics).
- `packages/config`: Environment parsing helpers.
- `deploy/`, `docs/`: Ops assets (Nginx example, deployment checklist).

## Quick start

```bash
pnpm install
cp .env.example .env         # update MySQL, Cognito, URLs
pnpm --filter db prisma generate
pnpm --filter db prisma migrate deploy
pnpm --filter db prisma db seed

pnpm --filter api dev        # Fastify API on http://localhost:4000
pnpm --filter web dev        # Vite SPA on http://localhost:5173
```

## Build & deploy

```bash
pnpm --filter config build
pnpm --filter db build
pnpm --filter api build
pnpm --filter web build
```

See `docs/deploy.md` for MySQL seeding, Cognito setup, systemd, and Nginx guidance. To keep the API running on a server, point systemd or pm2 at `apps/api/dist/server.js` and serve the SPA from `apps/web/dist`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter api dev` | Fastify API (hot reload with tsx) |
| `pnpm --filter api typecheck` / `lint` | TypeScript + ESLint |
| `pnpm --filter web dev` | Vite dev server |
| `pnpm --filter web typecheck` / `lint` | SPA linting/tsc |
| `pnpm covers:cache` | Cache Open Library covers into `apps/web/public/assets/covers` and refresh the API manifest (runs before `pnpm build`) |
| `pnpm --filter db prisma ...` | Prisma CLI (generate/migrate/seed) |

## Environment variables

- Backend: `MYSQL_*`, `DATABASE_URL`, `COGNITO_*`, `API_PORT`, `API_BASE_URL`, `WEB_BASE_URL`, `ADMIN_EMAIL`.
- Frontend: `VITE_API_BASE_URL`, `VITE_COGNITO_*`, `VITE_ADMIN_EMAIL`, `VITE_DEBUG_MODE` (optional).

Copy `.env.example`, populate values, and ensure both API and web builds load the same config.

### Cover assets

Running `pnpm covers:cache` fetches each ISBN’s cover art once, stores it under `apps/web/public/assets/covers`, and writes a runtime manifest to `apps/api/.cover-cache/cover-manifest.generated.json` (both outputs are gitignored so you can keep local caches without dirtying the repo). The Vite build copies the cached JPEGs to `apps/web/dist/assets/covers`, so the client can load `/assets/covers/<isbn>.jpg` without touching Open Library at runtime. Set `DATABASE_URL` so the script can query Prisma for ISBNs; if it’s missing, the script simply reindexes whatever covers already exist. If your API runs outside the repo tree, point it at a custom manifest using `COVER_MANIFEST_PATH=/absolute/path/to/cover-manifest.generated.json`.

### Library shuffle mode

The `/api/books` endpoint now accepts a `shuffle=true` query parameter, returning a randomly ordered slice of the catalog on each request. The web client enables shuffle mode by default and saves each signed-in user’s preference in their profile (anonymous visitors fall back to local storage), so they can keep browsing randomized picks across visits.

