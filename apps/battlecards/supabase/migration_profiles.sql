-- ============================================================
-- BattleCards — profiles migration
-- Paste this into the Supabase SQL editor and run it.
--
-- Note: email/password and Google OAuth are enabled in the
-- Supabase dashboard under Authentication → Providers.
-- No schema changes are required for those auth methods.
-- ============================================================


-- ── Table ─────────────────────────────────────────────────────────────────────

create table public.profiles (
  -- Mirrors auth.users — same UUID, no separate PK sequence needed.
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Populated automatically from Google profile picture when using OAuth.
  avatar_url   text,
  created_at   timestamptz not null default now()
);


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Any authenticated user can read any profile (e.g. for showing deck authors).
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

-- Users can only update their own profile.
create policy "profiles_update" on public.profiles
  for update to authenticated
  using     (auth.uid() = id)
  with check (auth.uid() = id);


-- ── Auto-create profile on sign-up ───────────────────────────────────────────
-- Fires for both email/password and OAuth (e.g. Google) sign-ups.
-- Google provides display_name and avatar_url via raw_user_meta_data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',   -- populated by Google OAuth
    new.raw_user_meta_data ->> 'avatar_url'   -- populated by Google OAuth
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
