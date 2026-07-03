-- migration_game_states.sql
--
-- Adds game visibility states (draft / beta / published), a beta_tester role,
-- and a game_testers join table for per-user draft access.
--
-- Run once in the Supabase SQL editor.

-- ── 1. Add status column to games ───────────────────────────────────────────

alter table public.games
  add column status text not null default 'draft'
    check (status in ('draft', 'beta', 'published'));

-- Set known live games to published, Starcraft stays draft.
update public.games set status = 'published' where slug in ('blood-bowl', 'halo-flashpoint', 'kill-team');

-- ── 2. Add beta_tester to the user_profiles role constraint ─────────────────

alter table public.user_profiles
  drop constraint user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
    check (role in ('user', 'beta_tester', 'admin'));

-- ── 3. Create game_testers join table ───────────────────────────────────────

create table public.game_testers (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (game_id, user_id)
);

alter table public.game_testers enable row level security;

-- Admins can manage testers (insert/delete). Users can read rows where they are the tester.
create policy "game_testers_select" on public.game_testers
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "game_testers_insert" on public.game_testers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "game_testers_delete" on public.game_testers
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 4. Update games RLS ──────────────────────────────────────────────────────

drop policy if exists "games_select" on public.games;

create policy "games_select" on public.games
  for select to authenticated
  using (
    -- Published: visible to everyone
    status = 'published'
    or
    -- Beta: visible to admins and beta testers
    (
      status = 'beta'
      and exists (
        select 1 from public.user_profiles
        where id = auth.uid() and role in ('admin', 'beta_tester')
      )
    )
    or
    -- Draft: visible to admins and specific testers for this game
    (
      status = 'draft'
      and (
        exists (
          select 1 from public.user_profiles
          where id = auth.uid() and role = 'admin'
        )
        or exists (
          select 1 from public.game_testers
          where game_id = games.id and user_id = auth.uid()
        )
      )
    )
  );
