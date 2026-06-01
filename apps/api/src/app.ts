import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const openApiConfig = {
  openapi: "3.1.0",
  info: {
    title: "ai-test api",
    version: "1.0.0",
    description: "Hono API for the ai-test monorepo.",
  },
} as const;

export const app = new OpenAPIHono();

app.use("*", logger());

// Allow the web app to call this API. Set WEB_ORIGIN in production
// (e.g. https://your-web-service.up.railway.app) to lock it down.
app.use(
  "*",
  cors({
    origin: process.env.WEB_ORIGIN ?? "*",
  }),
);

// ---- Schemas ----------------------------------------------------------------

const RootResponse = z
  .object({
    name: z.string().openapi({ example: "ai-test api" }),
    status: z.string().openapi({ example: "ok" }),
  })
  .openapi("RootResponse");

const HealthResponse = z
  .object({
    status: z.string().openapi({ example: "ok" }),
    uptime: z.number().openapi({ example: 12.34 }),
  })
  .openapi("HealthResponse");

const HelloResponse = z
  .object({
    message: z.string().openapi({ example: "Hello, world!" }),
  })
  .openapi("HelloResponse");

// ---- Routes -----------------------------------------------------------------

const rootRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["meta"],
  summary: "Service info",
  responses: {
    200: {
      content: { "application/json": { schema: RootResponse } },
      description: "Basic service info",
    },
  },
});
app.openapi(rootRoute, (c) => c.json({ name: "ai-test api", status: "ok" }));

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  tags: ["meta"],
  summary: "Health check",
  responses: {
    200: {
      content: { "application/json": { schema: HealthResponse } },
      description: "Health status and process uptime",
    },
  },
});
app.openapi(healthRoute, (c) =>
  c.json({ status: "ok", uptime: process.uptime() }),
);

const helloRoute = createRoute({
  method: "get",
  path: "/api/hello",
  tags: ["greeting"],
  summary: "Greet by name",
  request: {
    query: z.object({
      name: z
        .string()
        .optional()
        .openapi({ param: { name: "name", in: "query" }, example: "Railway" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: HelloResponse } },
      description: "A greeting message",
    },
  },
});
app.openapi(helloRoute, (c) => {
  const { name } = c.req.valid("query");
  return c.json({ message: `Hello, ${name ?? "world"}!` });
});

// ---- OpenAPI spec + docs ----------------------------------------------------

// Live spec (JSON) and interactive docs.
app.doc31("/doc", openApiConfig);
app.get("/ui", swaggerUI({ url: "/doc" }));
