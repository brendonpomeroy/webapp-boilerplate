/**
 * @ai-test/shared — the integration backbone of the monorepo.
 *
 * Zod schemas and the types inferred from them live here so the API and the
 * web app share a single source of truth for every request/response contract.
 * Import these in BOTH `apps/api` (route validation + service return types)
 * and `apps/web` (parsing responses, typing forms) so the two never disagree.
 *
 * Keep this package framework-agnostic: plain `zod` only, no Hono/React
 * imports. The API registers these schemas with OpenAPI on its side; the web
 * app uses them to parse fetch responses.
 *
 * When you add a feature, add its schemas here first, then build the
 * route → service → DB on the API and the component on the web against them.
 */
import { z } from "zod";

// ---- Auth -------------------------------------------------------------------

/**
 * The authenticated user, as derived from a validated Supabase JWT.
 * The API sets this on the request context inside the auth middleware.
 */
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

// ---- Notes (the example feature) -------------------------------------------

/** A note row as stored in / returned from the database. */
export const NoteSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  created_at: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

/** Payload accepted when creating a note (the server owns id/user_id/created_at). */
export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10_000).default(""),
});
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

/** Response shape for the "list notes" endpoint. */
export const NoteListSchema = z.object({
  notes: z.array(NoteSchema),
});
export type NoteList = z.infer<typeof NoteListSchema>;
