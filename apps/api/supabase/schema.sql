-- Schema for the example "notes" feature.
--
-- The project owner runs this once in the Supabase SQL editor (or via the CLI)
-- against their project. The agent does not create accounts or apply this.
--
-- The API talks to this table through NoteService using the service-role key,
-- which bypasses RLS. RLS is still enabled below so the table is also safe to
-- query directly with a user's anon-key token (defense in depth).

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists notes_user_id_created_at_idx
  on public.notes (user_id, created_at desc);

alter table public.notes enable row level security;

-- Each user can only see and manage their own notes.
create policy "Users can read their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);
