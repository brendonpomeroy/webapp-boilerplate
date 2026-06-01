# ai-test

A pnpm-workspace monorepo:

```
apps/
  api/   Hono API (Node server)
  web/   Vite + React app
packages/   (empty — for shared code later)
```

## Prerequisites

- Node >= 20
- pnpm (`corepack enable` or `npm i -g pnpm`)

## Local development

```bash
pnpm install
pnpm dev          # runs API (:3001) and web (:5173) together
```

- Web: http://localhost:5173
- API: http://localhost:3001

In dev, Vite proxies `/api/*` to the API (see [apps/web/vite.config.ts](apps/web/vite.config.ts)), so the frontend uses same-origin requests with no CORS config needed.

Run them individually with `pnpm dev:api` / `pnpm dev:web`.

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

### Service env vars

**api**
- `WEB_ORIGIN` — your web service's public URL (e.g. `https://web-production-xxxx.up.railway.app`) to lock down CORS. Optional; defaults to `*`.

**web**
- `VITE_API_URL` — your api service's public URL (e.g. `https://api-production-xxxx.up.railway.app`). This is baked in at **build time**, so after setting/changing it you must redeploy the web service.

### Notes

- Generate a public domain for each service under **Settings → Networking → Public Networking**.
- The web service uses `vite preview` to serve the static build. That's fine to start; for higher traffic you may later prefer a dedicated static host or serving `dist/` from the API.
