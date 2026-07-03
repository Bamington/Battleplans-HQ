-- migration_packs_official.sql
--
-- Adds an is_official column to packs, representing packs that are
-- automatically imported for users when they create a deck for the
-- associated game. Official packs are always public, and only admins
-- can set is_official = true.
--
-- Run once in the Supabase SQL editor.

-- ── 1. Add column ────────────────────────────────────────────────────────────

alter table public.packs
  add column if not exists is_official boolean not null default false;

-- ── 2. Tighten the update policy ─────────────────────────────────────────────
-- Non-admins can update packs they own, but cannot set is_official = true.
-- Admins can update any pack and set any value.

drop policy if exists "packs_update" on public.packs;

create policy "packs_update" on public.packs
  for update to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    (
      owner_user_id = auth.uid()
      or exists (
        select 1 from public.user_profiles
        where id = auth.uid() and role = 'admin'
      )
    )
    and (
      is_official = false
      or exists (
        select 1 from public.user_profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );
