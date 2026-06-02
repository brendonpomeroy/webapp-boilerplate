# CLAUDE.md

Guidance for working in this repository.

## What this is

A pnpm-workspace monorepo for rapidly prototyping app features end to end:

```
apps/
  api/   Hono API (Node runtime via @hono/node-server), TypeScript
  web/   Vite + React 19 app, TypeScript
packages/
  shared/   @ai-test/shared — zod schemas + inferred types shared by api & web
```

**Stack:** React + Vite (frontend) → Hono Node adapter (API) → Supabase
(auth + Postgres). Supabase issues JWTs on login; the web app sends them with
every request; Hono validates them in middleware and routes to a **service**,
which is the only layer that touches the database.

Request path: **web → Hono route (validates JWT) → service → Supabase → back.**

These choices are pinned — do not swap them when adding features:
- Hono **Node adapter** only (no Workers/Bun/other runtimes).
- All DB access goes through the **service layer**, never from a route handler.
- Share types & zod schemas via **`packages/shared`**.
- Protect data routes with the **Supabase JWT** middleware.
- Imitate the **notes example feature** rather than inventing new patterns.

Root tooling:
- `pnpm-workspace.yaml` — workspace globs (`apps/*`, `packages/*`)
- `tsconfig.base.json` — shared compiler options; each package extends it
- Root `package.json` — orchestration scripts. `shared` is built before the
  apps (they import its compiled output), so use the root scripts / `build:shared`
  rather than running an app's `tsc` in isolation.

## Common commands

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspace deps |
| `pnpm dev` | Run API (:3001) and web (:5173) together |
| `pnpm dev:api` / `pnpm dev:web` | Run one app |
| `pnpm build` | Build both apps |
| `pnpm --filter api <script>` | Run a script in the API app |
| `pnpm --filter web <script>` | Run a script in the web app |

## packages/shared (`@ai-test/shared`)

The integration backbone. Put **zod schemas and the types inferred from them**
here and import them in **both** the API and the web app so the two never
disagree on a contract. Keep it framework-agnostic (plain `zod` only — no Hono
or React imports). It compiles to `dist/` and both apps consume the build, so it
must be built before they typecheck/run (the root scripts handle this).

## apps/api

Structure:
- `src/index.ts` — boots the Node server, reads `PORT` (default 3001).
- `src/app.ts` — the Hono app (exported so the spec generator imports it without
  starting a server). Defines routes + request/response schemas.
- `src/middleware/auth.ts` — `requireAuth`: validates the Supabase JWT
  (`Authorization: Bearer`) and puts the user on the context (`c.get("user")`).
  Supabase signs access tokens with asymmetric keys (ECC/ES256 by default), so
  the middleware verifies them against the project's JWKS — fetched and cached
  by `src/lib/jwks.ts` from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. It
  still accepts legacy HS256 tokens against `SUPABASE_JWT_SECRET` when that
  secret is set, to ease migration. Attach it to any data route.
- `src/lib/jwks.ts` — fetches and caches Supabase's public signing keys (JWKS)
  for the auth middleware; refreshes on a short TTL or on an unknown `kid`.
- `src/services/*` — the **service layer**. A service owns a domain and is the
  only code that touches the DB (e.g. `NoteService`).
- `src/lib/supabase.ts` — lazy service-role client used by services. The
  service-role key bypasses RLS, so every service query is scoped by the
  authenticated user id.

Conventions:
- Routes are defined with **`@hono/zod-openapi`**: each route pairs a Zod schema with `createRoute`, giving runtime request/response validation **and** OpenAPI metadata from a single source of truth.
- Route handlers stay thin: read `c.get("user")` + validated input, call a service, return. **No DB calls in handlers.**
- Reuse schemas from `@ai-test/shared`; call `.openapi("Name")` on them in `app.ts` to register named components in the spec.
- Live spec is served at `/doc` (OpenAPI 3.1 JSON) and interactive docs at `/ui` (Swagger UI).
- A committed snapshot of the spec lives at `apps/api/openapi.json`.

### ⚠️ Regenerate the OpenAPI spec after every API change

Any change to the API surface — adding/removing/renaming a route, changing a
request or response schema, query/path params, status codes, tags, or the
`info` block in `src/app.ts` — **must** be followed by regenerating the spec:

```bash
pnpm --filter api spec:gen
```

This rewrites `apps/api/openapi.json`. Commit that file together with the code
change so the snapshot never drifts from the routes. Do not hand-edit
`openapi.json` — it is generated.

Checklist for an API change:
1. Edit routes/schemas in `apps/api/src/app.ts`.
2. Run `pnpm --filter api spec:gen`.
3. Verify the build: `pnpm --filter api build`.
4. Commit the source changes **and** the updated `openapi.json` together.

## apps/web

- Vite + React 19. Entry: `src/main.tsx` → `src/App.tsx`.
- `src/lib/supabase.ts` — browser Supabase client (anon key); handles login/signup and the session.
- `src/lib/api.ts` — `apiFetch` attaches the session's JWT (`Authorization: Bearer`) to every API call. Parse responses with the matching `@ai-test/shared` schema.
- In dev, Vite proxies `/api/*` to `http://localhost:3001` (see `vite.config.ts`), so the frontend uses same-origin requests with no CORS setup.
- In production the API base comes from `VITE_API_URL` (baked in at build time).

## Auth & data flow (the notes example feature)

The `notes` feature is the end-to-end template — copy it for new features:
1. Schemas/types in `packages/shared` (`NoteSchema`, `CreateNoteSchema`, …).
2. A service (`apps/api/src/services/note-service.ts`) does the Supabase query.
3. JWT-protected routes in `app.ts` (`middleware: [requireAuth]`, `security: [{ Bearer: [] }]`) call the service.
4. The React UI logs in via Supabase and calls the routes through `apiFetch`, parsing results with the shared schema.

The DB table lives in `apps/api/supabase/schema.sql` — the **project owner**
applies it. Do not create Supabase accounts/projects or handle real keys.

## Environment / configuration

`.env.example` in each app documents required config (do not hardcode secrets;
real keys are set by the owner):
- **api** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service layer, secret),
  `SUPABASE_JWT_SECRET` (auth middleware), plus `PORT`/`WEB_ORIGIN`.
- **web** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public), plus `VITE_API_URL`.

## Deployment (Railway)

Two separate Railway services, both pointing at this repo, each using its own
`railway.json` (`apps/api/railway.json`, `apps/web/railway.json`) set as the
service's config-as-code path. Each build also builds `@ai-test/shared` first.
The API runs as a long-running container with **app sleeping enabled** (scales
to zero when idle, brief cold start on wake) — keep this; don't switch runtimes
or make it always-hot. Supabase stays external. See `README.md` for the full
walkthrough and the required env vars (Supabase keys per app, plus `WEB_ORIGIN`
for the API and `VITE_API_URL` for the web build).

## Conventions

- TypeScript everywhere; keep `strict` happy.
- Prefer schema-defined routes in the API so the OpenAPI spec stays accurate.
- Put contracts shared between `api` and `web` (zod schemas, types) in `packages/shared`.
- DB access only through services; data routes only through `requireAuth`.
