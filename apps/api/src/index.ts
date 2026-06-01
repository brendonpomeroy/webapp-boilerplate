import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());

// Allow the web app to call this API. Set WEB_ORIGIN in production
// (e.g. https://your-web-service.up.railway.app) to lock it down.
app.use(
  "*",
  cors({
    origin: process.env.WEB_ORIGIN ?? "*",
  }),
);

app.get("/", (c) => c.json({ name: "ai-test api", status: "ok" }));

app.get("/api/health", (c) =>
  c.json({ status: "ok", uptime: process.uptime() }),
);

app.get("/api/hello", (c) => {
  const name = c.req.query("name") ?? "world";
  return c.json({ message: `Hello, ${name}!` });
});

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
