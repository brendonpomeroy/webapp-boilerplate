import type { CreateNoteInput, Note } from "@ai-test/shared";
import { getSupabaseAdmin } from "../lib/supabase.js";

/**
 * NoteService — owns the `notes` domain.
 *
 * This is the service layer described in the architecture: route handlers stay
 * thin (validation + request/response) and call these methods; the service is
 * the ONLY place that talks to the database. Because the admin client bypasses
 * RLS, every method scopes its query by the caller's `userId` (taken from the
 * validated JWT) so users only ever see their own rows.
 */
export const NoteService = {
  async listForUser(userId: string): Promise<Note[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list notes: ${error.message}`);
    return (data ?? []) as Note[];
  },

  async createForUser(userId: string, input: CreateNoteInput): Promise<Note> {
    const { data, error } = await getSupabaseAdmin()
      .from("notes")
      .insert({ user_id: userId, title: input.title, content: input.content })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create note: ${error.message}`);
    return data as Note;
  },
};
