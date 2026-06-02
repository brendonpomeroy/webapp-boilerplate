import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "@ai-test/shared";

/**
 * Hono environment shape: protected routes can read the authenticated user
 * off the context with `c.get("user")`. Parameterize the app with this:
 * `new OpenAPIHono<AppEnv>()`.
 */
export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};

/**
 * Supabase is the auth layer; Hono is the gatekeeper that trusts the JWTs
 * Supabase issues. This middleware:
 *
 *   1. Pulls the bearer token from the `Authorization` header.
 *   2. Verifies its signature + expiry locally against SUPABASE_JWT_SECRET
 *      (the project's JWT secret from the Supabase dashboard — HS256).
 *   3. Puts the identified user on the context for downstream handlers.
 *
 * Attach it to any route that needs a logged-in user. Unauthenticated or
 * invalid requests are rejected here, before the handler runs.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new HTTPException(500, {
      message:
        "Auth is not configured: SUPABASE_JWT_SECRET is missing (see apps/api/.env.example).",
    });
  }

  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token." });
  }

  let payload: Awaited<ReturnType<typeof verify>>;
  try {
    payload = await verify(token, secret, "HS256"); // Supabase JWT secret
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token." });
  }

  if (!payload.sub) {
    throw new HTTPException(401, { message: "Token is missing a subject." });
  }

  c.set("user", {
    id: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
  });

  await next();
});
