import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CreateNoteSchema,
  NoteListSchema,
  NoteSchema,
  type Note,
} from "@ai-test/shared";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { apiFetch } from "./lib/api";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <h1>ai-test</h1>
      <p>Vite + React → Hono (JWT-protected) → Supabase.</p>

      {!isSupabaseConfigured ? (
        <SetupHint />
      ) : !ready ? (
        <p>loading…</p>
      ) : session ? (
        <NotesView email={session.user.email ?? "you"} />
      ) : (
        <AuthForm />
      )}
    </main>
  );
}

function SetupHint() {
  return (
    <section style={card}>
      <h2>Supabase not configured</h2>
      <p>
        Set <code>VITE_SUPABASE_URL</code> and{" "}
        <code>VITE_SUPABASE_ANON_KEY</code> in <code>apps/web/.env</code> (see{" "}
        <code>apps/web/.env.example</code>), then restart the dev server.
      </p>
    </section>
  );
}

function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(kind: "signin" | "signup") {
    if (!supabase) return;
    setBusy(true);
    setStatus(null);
    const fn =
      kind === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setStatus(error.message);
    else if (kind === "signup")
      setStatus("Check your email to confirm, then sign in.");
    setBusy(false);
  }

  return (
    <section style={card}>
      <h2>Sign in</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handle("signin");
        }}
        style={{ display: "grid", gap: "0.75rem" }}
      >
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={input}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" disabled={busy} style={button}>
            Sign in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handle("signup")}
            style={{ ...button, background: "#eee", color: "#111" }}
          >
            Sign up
          </button>
        </div>
      </form>
      {status && <p style={{ color: "#b00" }}>{status}</p>}
    </section>
  );
}

function NotesView({ email }: { email: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await apiFetch("/api/notes");
      setNotes(NoteListSchema.parse(data).notes);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = CreateNoteSchema.parse({ title, content });
      const data = await apiFetch("/api/notes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const note = NoteSchema.parse(data);
      setNotes((prev) => [note, ...prev]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Your notes</h2>
        <span style={{ color: "#666", fontSize: "0.9rem" }}>
          {email}{" "}
          <button
            onClick={() => supabase?.auth.signOut()}
            style={{ ...button, padding: "0.25rem 0.5rem" }}
          >
            Sign out
          </button>
        </span>
      </div>

      <form onSubmit={create} style={{ display: "grid", gap: "0.5rem" }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={input}
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{ ...input, resize: "vertical" }}
        />
        <button type="submit" disabled={busy} style={button}>
          Add note
        </button>
      </form>

      {error && <p style={{ color: "#b00" }}>error: {error}</p>}

      {notes.length === 0 ? (
        <p style={{ color: "#666" }}>No notes yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {notes.map((n) => (
            <li key={n.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: "0.75rem" }}>
              <strong>{n.title}</strong>
              {n.content && <p style={{ margin: "0.25rem 0 0" }}>{n.content}</p>}
              <small style={{ color: "#999" }}>
                {new Date(n.created_at).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e2e2e2",
  borderRadius: 8,
  padding: "1.25rem",
  display: "grid",
  gap: "1rem",
};
const input: React.CSSProperties = {
  padding: "0.5rem 0.6rem",
  border: "1px solid #ccc",
  borderRadius: 6,
  font: "inherit",
};
const button: React.CSSProperties = {
  padding: "0.5rem 0.9rem",
  border: "none",
  borderRadius: 6,
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
};
