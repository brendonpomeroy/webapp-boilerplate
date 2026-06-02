import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Whether the Supabase env vars are present; the UI shows a hint if not. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "in apps/web/.env (see apps/web/.env.example).",
  );
}

/**
 * Browser Supabase client (anon key) — handles login/signup and persists the
 * session. On login Supabase returns a JWT; the api helper reads its
 * access_token from the session and sends it with every API request.
 *
 * `null` when env vars are missing so the app can still render a setup hint.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
