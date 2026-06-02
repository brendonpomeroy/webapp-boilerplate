import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client used by the service layer for database access.
 *
 * Created lazily on first use so the app — and the OpenAPI spec generator —
 * can boot without any Supabase secrets configured (e.g. in CI / `spec:gen`).
 *
 * ⚠️ The service-role key bypasses Postgres Row Level Security. Services MUST
 * scope every query by the authenticated user id taken from the validated JWT
 * (see the auth middleware). Never expose this client to a route handler
 * directly — all DB access goes through a service.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(see apps/api/.env.example).",
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
