import type { HonoJsonWebKey } from "hono/utils/jwt/jws";

/**
 * Supabase signs access tokens with asymmetric keys (ECC/ES256 by default,
 * RSA or Ed25519 if configured) and publishes the public halves as a JWKS at
 * `<project>/auth/v1/.well-known/jwks.json`. The auth middleware verifies
 * tokens against these keys; this module fetches and caches them.
 *
 * The JWKS is public and small but rarely changes, so we cache it in memory
 * with a short TTL instead of fetching on every request. On a cache miss for a
 * token's `kid` (e.g. just after a key rotation) callers force a refresh.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

type Cache = { keys: HonoJsonWebKey[]; fetchedAt: number };

let cache: Cache | null = null;
let inflight: Promise<HonoJsonWebKey[]> | null = null;

function jwksUri(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Auth is not configured: SUPABASE_URL is missing (see apps/api/.env.example).",
    );
  }
  return `${url.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`;
}

async function refresh(): Promise<HonoJsonWebKey[]> {
  const uri = jwksUri();
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch Supabase JWKS (${res.status}) from ${uri}`);
  }
  const data = (await res.json()) as { keys?: HonoJsonWebKey[] };
  if (!Array.isArray(data.keys)) {
    throw new Error(`Invalid JWKS response from ${uri}: "keys" is missing.`);
  }
  cache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

/**
 * Return Supabase's current signing keys. Served from the in-memory cache when
 * fresh; otherwise (or when `forceRefresh` is set) re-fetched. Concurrent
 * callers share a single in-flight request.
 */
export async function getSupabaseJwks(opts?: {
  forceRefresh?: boolean;
}): Promise<HonoJsonWebKey[]> {
  if (!opts?.forceRefresh && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.keys;
  }
  inflight ??= refresh().finally(() => {
    inflight = null;
  });
  return inflight;
}
