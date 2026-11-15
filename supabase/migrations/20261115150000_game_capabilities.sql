-- Already applied to the live database on 2026-11 from the standalone BattleCards repo
-- (supabase/migration_game_capabilities.sql); recorded here with 'supabase migration repair'.

-- ============================================================
-- BattleCards — per-game capabilities with role-based access
--
-- Each game offers up to two ways to build a deck:
--   simple — static card faces from packs (generic ListBuilder)
--   custom — the game's custom card builder page
--
-- Each capability has an access level:
--   off      — nobody (not even admins)
--   admin    — admins only
--   beta     — admins + beta testers (global 'beta_tester' role OR a
--              game_testers row for that game)
--   everyone — all signed-in users
--
-- A game appears in BattleCards' pickers for a user when at least one
-- capability is available to them. This replaces battlecards_status and the
-- app's hardcoded admin-only flag for BattleCards visibility (the old column
-- is left in place; the games table is shared with Battleplan).
--
-- Decks remember the mode they were created in (decks.card_mode), so a deck
-- never moves between builders when a game's capabilities change later.
-- ============================================================

-- ── 1. Columns ──────────────────────────────────────────────────────────────

alter table public.games
  add column if not exists simple_access text not null default 'off'
    check (simple_access in ('off', 'admin', 'beta', 'everyone')),
  add column if not exists custom_access text not null default 'off'
    check (custom_access in ('off', 'admin', 'beta', 'everyone'));

alter table public.decks
  add column if not exists card_mode text not null default 'custom'
    check (card_mode in ('simple', 'custom'));

-- ── 2. Backfill (preserves current behaviour) ───────────────────────────────
-- The five games already in the BattleCards picker: custom builder for all.
update public.games set custom_access = 'everyone'
where slug in ('blood-bowl', 'halo-flashpoint', 'kill-team', 'starcraft', 'ryg')
  and custom_access = 'off';

-- Gundam Assemble: simple cards, admin-only while its pack is loaded.
update public.games set simple_access = 'admin'
where slug = 'gundam-assemble' and simple_access = 'off';

-- Existing decks for games without a custom builder are simple decks.
update public.decks d set card_mode = 'simple'
from public.games g
where g.id = d.game_id
  and g.slug not in ('blood-bowl', 'halo-flashpoint', 'kill-team', 'starcraft', 'ryg')
  and d.card_mode = 'custom';

-- ── 3. Access check ─────────────────────────────────────────────────────────

create or replace function public.battlecards_has_access(p_level text, p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_level
    when 'everyone' then auth.uid() is not null
    when 'beta' then exists (
        select 1 from public.user_profiles
        where id = auth.uid() and role in ('admin', 'beta_tester')
      ) or exists (
        select 1 from public.game_testers
        where game_id = p_game_id and user_id = auth.uid()
      )
    when 'admin' then exists (
        select 1 from public.user_profiles
        where id = auth.uid() and role = 'admin'
      )
    else false
  end;
$$;

revoke all on function public.battlecards_has_access(text, uuid) from public;
grant  execute on function public.battlecards_has_access(text, uuid) to authenticated;

-- ── 4. Capabilities for the signed-in user ──────────────────────────────────
-- One row per game that offers at least one mode to the caller.

create or replace function public.my_game_capabilities()
returns table (game_id uuid, slug text, name text, simple boolean, custom boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.slug, g.name,
         public.battlecards_has_access(g.simple_access, g.id),
         public.battlecards_has_access(g.custom_access, g.id)
  from public.games g
  where public.battlecards_has_access(g.simple_access, g.id)
     or public.battlecards_has_access(g.custom_access, g.id)
  order by g.name;
$$;

revoke all on function public.my_game_capabilities() from public;
grant  execute on function public.my_game_capabilities() to authenticated;
