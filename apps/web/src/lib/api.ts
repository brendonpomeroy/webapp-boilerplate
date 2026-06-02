import { supabase } from "./supabase";

// In dev, requests to /api are proxied to the Hono server (see vite.config.ts).
// In production, set VITE_API_URL to your deployed API's URL.
const API_URL = import.meta.env.VITE_API_URL ?? "";

/**
 * Fetch wrapper that attaches the Supabase JWT to every API request.
 *
 * This is step 2 of the architecture: the frontend sends the JWT with every
 * call, and Hono's auth middleware validates it. Reads the current session's
 * access_token and sets the `Authorization: Bearer` header.
 *
 * Throws an Error (with the API's message when available) on non-2xx so callers
 * can surface it. Returns the parsed JSON body, which callers should validate
 * with the matching zod schema from @ai-test/shared.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
