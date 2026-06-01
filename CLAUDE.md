# CLAUDE.md

Guidance for working in this repository.

## What this is

A pnpm-workspace monorepo with two deployable apps:

```
apps/
  api/   Hono API (Node runtime via @hono/node-server), TypeScript
  web/   Vite + React 19 app, TypeScript
packages/   shared code (currently empty; add shared types/libs here)
```

Root tooling:
- `pnpm-workspace.yaml` — workspace globs (`apps/*`, `packages/*`)
- `tsconfig.base.json` — shared compiler options; each app extends it
- Root `package.json` — orchestration scripts that filter into the apps

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

## apps/api

- Entry point: `src/index.ts` boots the Node server and reads `PORT` (default 3001).
- The app itself lives in `src/app.ts` and is exported so the spec generator can import it without starting a server.
- Routes are defined with **`@hono/zod-openapi`**: each route pairs a Zod schema with `createRoute`, giving runtime request/response validation **and** OpenAPI metadata from a single source of truth.
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
- In dev, Vite proxies `/api/*` to `http://localhost:3001` (see `vite.config.ts`), so the frontend uses same-origin requests with no CORS setup.
- In production the API base comes from `VITE_API_URL` (baked in at build time).

## Deployment (Railway)

Two separate Railway services, both pointing at this repo, each using its own
`railway.json` (`apps/api/railway.json`, `apps/web/railway.json`) set as the
service's config-as-code path. See `README.md` for the full walkthrough and the
required env vars (`WEB_ORIGIN` for the API, `VITE_API_URL` for the web build).

## Conventions

- TypeScript everywhere; keep `strict` happy.
- Prefer schema-defined routes in the API so the OpenAPI spec stays accurate.
- Put code shared between `api` and `web` (e.g. response types) under `packages/`.
