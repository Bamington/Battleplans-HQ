-- migration_user_roles.sql
--
-- Adds a user_profiles table with a `role` column ('user' | 'admin').
-- Only admins can create packs.
--
-- Run once in the Supabase SQL editor.

-- ── 1. Create user_profiles ─────────────────────────────────────────────────

create table public.user_profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  role       text        not null default 'user'
               check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Users can read their own profile (the frontend needs to check isAdmin).
create policy "profiles_select_own" on public.user_profiles
  for select to authenticated
  using (id = auth.uid());

-- ── 2. Auto-create a profile row when a new user signs up ───────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 3. Backfill existing users ───────────────────────────────────────────────

insert into public.user_profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ── 4. Tighten packs_insert to require admin role ────────────────────────────

drop policy if exists "packs_insert" on public.packs;

create policy "packs_insert" on public.packs
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid()
        and role = 'admin'
    )
  );

-- ── 5. Grant yourself admin ──────────────────────────────────────────────────
-- Run this separately after the migration, replacing the email with yours:
--
--   update public.user_profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'your@email.com');
