# ai-test

A small monorepo for prototyping app features end to end.

```
apps/
  api/   Hono API (Node) — JWT-protected routes → services → database
  web/   Vite + React app — login + calls the API
packages/
  shared/   zod schemas + types shared by both apps
```

**Stack:** React + Vite → Hono → [Supabase](https://supabase.com) (auth + Postgres).
You log in through Supabase, which hands the web app a JWT; the web app sends
that token with every API request, and the API verifies it before touching the
database.

## What you need

- [Node](https://nodejs.org) 20+
- pnpm — `corepack enable` (or `npm i -g pnpm`)
- A [Supabase](https://supabase.com) project for login + data (the owner
  provides the URL and keys)

## Run it locally

**1. Install**

```bash
pnpm install
```

**2. Add your config**

Copy each app's example env file and fill in the Supabase values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

- **api** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **web** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

You can find all of these in the [Supabase dashboard](https://supabase.com/dashboard)
under **Project Settings → API**.

**3. Set up the database (once)**

Run [apps/api/supabase/schema.sql](apps/api/supabase/schema.sql) in your
project's [Supabase SQL editor](https://supabase.com/dashboard) to create the
example table.

**4. Start**

```bash
pnpm dev
```

- Web → http://localhost:5173
- API → http://localhost:3001

That's it. The app boots even without Supabase configured, but login and data
features need it.

> Run one app at a time with `pnpm dev:api` or `pnpm dev:web`.

## API docs

Routes are defined with Zod schemas that also generate an OpenAPI spec:

- Interactive docs: http://localhost:3001/ui
- Raw spec: http://localhost:3001/doc

## Deploying

Both apps deploy to [Railway](https://railway.app) as two separate services in
one project, each pointing at this repo. See [CLAUDE.md](CLAUDE.md) for the full
setup, including the env vars each service needs.
