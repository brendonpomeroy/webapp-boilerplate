# ai-test

A pnpm-workspace monorepo for prototyping features end to end:

```
apps/
  api/   Hono API (Node server) — JWT-protected routes → services → Supabase
  web/   Vite + React app — Supabase login, calls the API with the JWT
packages/
  shared/   zod schemas + types shared by both apps
```

**Stack:** React + Vite → Hono (Node adapter) → Supabase (auth + Postgres).
Supabase issues a JWT on login; the web app sends it with every request; Hono
validates it in middleware, then routes to a service that owns the DB access.

## Prerequisites

- Node >= 20
- pnpm (`corepack enable` or `npm i -g pnpm`)
- A Supabase project (the owner provides URL + keys) for auth/DB to work

## Configuration

Each app has a `.env.example`; copy it to `.env` and fill in real values
(set by the project owner — never commit secrets):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

- **api**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- **web**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Apply the example feature's table once in your Supabase SQL editor:
[apps/api/supabase/schema.sql](apps/api/supabase/schema.sql). The app boots
without Supabase configured (public routes work), but auth/notes need it.

## Local development

```bash
pnpm install
pnpm dev          # builds shared, then runs API (:3001) and web (:5173) together
```

- Web: http://localhost:5173
- API: http://localhost:3001

In dev, Vite proxies `/api/*` to the API (see [apps/web/vite.config.ts](apps/web/vite.config.ts)), so the frontend uses same-origin requests with no CORS config needed.

Run them individually with `pnpm dev:api` / `pnpm dev:web`.

## API docs (OpenAPI)

The API uses [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi), so routes are defined with Zod schemas that drive both runtime validation and an OpenAPI 3.1 spec.

- Live spec: `GET /doc`
- Interactive docs (Swagger UI): `GET /ui`
- Committed snapshot: [apps/api/openapi.json](apps/api/openapi.json)

After **any** change to the API surface, regenerate the snapshot and commit it with your change:

```bash
pnpm --filter api spec:gen
```

See [CLAUDE.md](CLAUDE.md) for the full API-change checklist.

## Build

```bash
pnpm build        # builds both apps
```

- API → `apps/api/dist` (run with `pnpm --filter api start`)
- Web → `apps/web/dist` (served with `pnpm --filter web start`)

## Deploying to Railway

Deploy the two apps as **two separate services** in one Railway project, both pointing at this repo. Each app has a `railway.json` with its build/start commands.

For each service:

1. **New Project → Deploy from GitHub repo** (do this twice, or **+ New → Service** in the same project).
2. In the service's **Settings → Build**, set **Config-as-code path**:
   - API service → `apps/api/railway.json`
   - Web service → `apps/web/railway.json`
3. Railway installs the whole workspace and builds only that app via the pnpm `--filter` commands. `PORT` is injected automatically; both apps read it.

Each build also builds `@ai-test/shared` first (the apps import its compiled
output). The API runs as a long-running container with **app sleeping enabled**
— it scales to zero when idle and wakes on the next request (a brief cold start,
fine for a PoC). Supabase stays external.

### Service env vars

**api**
- `SUPABASE_URL` — your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role (secret) key used by the service layer. Server-side only.
- `SUPABASE_JWT_SECRET` — project JWT secret; the auth middleware verifies access tokens with it.
- `WEB_ORIGIN` — your web service's public URL (e.g. `https://web-production-xxxx.up.railway.app`) to lock down CORS. Optional; defaults to `*`.

**web**
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project URL + public anon key.
- `VITE_API_URL` — your api service's public URL (e.g. `https://api-production-xxxx.up.railway.app`).

> `VITE_*` vars are baked in at **build time**, so after setting/changing any of them you must redeploy the web service.

### Notes

- Generate a public domain for each service under **Settings → Networking → Public Networking**.
- The web service uses `vite preview` to serve the static build. That's fine to start; for higher traffic you may later prefer a dedicated static host or serving `dist/` from the API.
