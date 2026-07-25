-- 20260725020000_games_battlecards_status.sql
--
-- Two corrections to `games`, both stemming from the same confusion.
--
-- 1. `status` is renamed to `battlecards_status`. It only ever meant "does this
--    game have playable card content in BattleCards" (draft / beta / published),
--    but the bare name read like a property of the game itself, which is how
--    BattlePlan ended up gated by it — non-admins could pick 4 games out of 99
--    when booking a table. BattlePlan now reads `game_catalogue`
--    (20260725010000) and ignores this column entirely; the name should say so.
--
--    Postgres stores policy and constraint expressions by attribute number, so
--    `games_select` and the draft/beta/published CHECK follow the rename
--    automatically. BattleCards' gating is unchanged — verified in the dry run
--    by asserting a non-admin still sees exactly the published games.
--
-- 2. Data fix: `enabled_battleplan` is turned off wherever `supported` is false.
--    41 games were flagged bookable despite not being supported. Going forward
--    supported = false implies not bookable.
--
-- ⚠️ BREAKING for BattleCards' admin ManageGames page, which reads `g.status`
--    and writes `.update({ status })`. That screen is admin-only and errors
--    until the matching deploy lands, so this must be applied immediately
--    before it. Nothing a normal user touches reads the column.
--
-- Idempotent.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='games' and column_name='status'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='games' and column_name='battlecards_status'
  ) then
    alter table public.games rename column status to battlecards_status;
  end if;
end $$;

comment on column public.games.battlecards_status is
  'BattleCards content-readiness only: draft / beta / published, gating who can see the game in BattleCards. NOT a property of the game itself — BattlePlan deliberately ignores it and reads public.game_catalogue instead.';

-- One-time correction. A game that isn't supported must not be offered for
-- booking; 41 rows were in that state.
update public.games
   set enabled_battleplan = false
 where supported = false
   and enabled_battleplan;
