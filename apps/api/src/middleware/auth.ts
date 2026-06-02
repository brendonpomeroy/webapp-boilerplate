import { createMiddleware } from "hono/factory";
import { decode, verify, verifyWithJwks } from "hono/jwt";
import type { AsymmetricAlgorithm } from "hono/utils/jwt/jwa";
import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "@ai-test/shared";
import { getSupabaseJwks } from "../lib/jwks.js";

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
 * Asymmetric algorithms Supabase may sign access tokens with. New projects
 * default to ES256 (ECC P-256); RSA and Ed25519 are also offered.
 */
const ALLOWED_ALGORITHMS: readonly AsymmetricAlgorithm[] = [
  "ES256",
  "ES384",
  "ES512",
  "RS256",
  "EdDSA",
];

/**
 * Verify a Supabase access token against the project's published JWKS
 * (asymmetric keys). The token's `kid` selects the signing key; if it isn't in
 * the cached key set — e.g. just after a key rotation — refetch once and retry.
 */
async function verifyAsymmetric(token: string, kid: string) {
  let keys = await getSupabaseJwks();
  if (!keys.some((k) => k.kid === kid)) {
    keys = await getSupabaseJwks({ forceRefresh: true });
  }
  return verifyWithJwks(token, { keys, allowedAlgorithms: ALLOWED_ALGORITHMS });
}

/**
 * Supabase is the auth layer; Hono is the gatekeeper that trusts the JWTs
 * Supabase issues. This middleware:
 *
 *   1. Pulls the bearer token from the `Authorization` header.
 *   2. Verifies its signature + expiry locally:
 *      - asymmetric tokens (ES256/RS256/EdDSA) against the public keys from
 *        Supabase's JWKS endpoint (derived from SUPABASE_URL), and
 *      - legacy HS256 tokens against SUPABASE_JWT_SECRET, if that shared secret
 *        is still configured (eases migration to asymmetric keys).
 *   3. Puts the identified user on the context for downstream handlers.
 *
 * Attach it to any route that needs a logged-in user. Unauthenticated or
 * invalid requests are rejected here, before the handler runs.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token." });
  }

  let alg: string | undefined;
  let kid: string | undefined;
  try {
    const decoded = decode(token).header;
    alg = decoded.alg;
    kid = decoded.kid;
  } catch {
    throw new HTTPException(401, { message: "Malformed token." });
  }

  let payload: Awaited<ReturnType<typeof verify>>;
  try {
    if (alg === "HS256") {
      // Legacy shared-secret tokens. Supported only while the secret is set.
      const secret = process.env.SUPABASE_JWT_SECRET;
      if (!secret) {
        throw new HTTPException(401, {
          message: "HS256 tokens are no longer accepted.",
        });
      }
      payload = await verify(token, secret, "HS256");
    } else {
      if (!kid) {
        throw new HTTPException(401, { message: "Token is missing a key id." });
      }
      payload = await verifyAsymmetric(token, kid);
    }
  } catch (err) {
    if (err instanceof HTTPException) throw err;
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
