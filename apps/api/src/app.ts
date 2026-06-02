import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  CreateNoteSchema,
  NoteListSchema,
  NoteSchema,
} from "@ai-test/shared";
import { requireAuth, type AppEnv } from "./middleware/auth.js";
import { NoteService } from "./services/note-service.js";

export const openApiConfig = {
  openapi: "3.1.0",
  info: {
    title: "ai-test api",
    version: "1.0.0",
    description: "Hono API for the ai-test monorepo.",
  },
} as const;

export const app = new OpenAPIHono<AppEnv>();

// Bearer (Supabase JWT) auth scheme, referenced by protected routes below.
app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

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

// Notes feature — schemas come from @ai-test/shared (the single source of
// truth shared with the web app). We register them with the OpenAPI document
// here so they appear as named components in the spec.
const Note = NoteSchema.openapi("Note");
const NoteList = NoteListSchema.openapi("NoteList");
const CreateNoteBody = CreateNoteSchema.openapi("CreateNote");

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

// ---- Notes (example feature: route → service → DB, JWT-protected) -----------
//
// These routes mirror the architecture for any new feature:
//   * `requireAuth` validates the Supabase JWT and identifies the user.
//   * the handler stays thin — it only reads the user + validated input and
//     delegates to NoteService.
//   * NoteService is the only thing that touches the database.

const listNotesRoute = createRoute({
  method: "get",
  path: "/api/notes",
  tags: ["notes"],
  summary: "List the authenticated user's notes",
  security: [{ Bearer: [] }],
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: { "application/json": { schema: NoteList } },
      description: "The notes belonging to the authenticated user",
    },
    401: { description: "Missing or invalid token" },
  },
});
app.openapi(listNotesRoute, async (c) => {
  const user = c.get("user");
  const notes = await NoteService.listForUser(user.id);
  return c.json({ notes }, 200);
});

const createNoteRoute = createRoute({
  method: "post",
  path: "/api/notes",
  tags: ["notes"],
  summary: "Create a note for the authenticated user",
  security: [{ Bearer: [] }],
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: { "application/json": { schema: CreateNoteBody } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: Note } },
      description: "The created note",
    },
    401: { description: "Missing or invalid token" },
  },
});
app.openapi(createNoteRoute, async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");
  const note = await NoteService.createForUser(user.id, input);
  return c.json(note, 201);
});

// ---- OpenAPI spec + docs ----------------------------------------------------

// Live spec (JSON) and interactive docs.
app.doc31("/doc", openApiConfig);
app.get("/ui", swaggerUI({ url: "/doc" }));
