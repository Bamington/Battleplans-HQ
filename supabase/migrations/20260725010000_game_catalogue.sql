-- 20260725010000_game_catalogue.sql
--
-- HOTFIX. Non-admins could only pick 4 games when booking a table or logging a
-- battle, out of 99 and 75 respectively.
--
-- Cause: `games.status` is BattleCards' CONTENT-READINESS gate — does this game
-- have playable card content — and `games_select` hides anything not
-- 'published' from ordinary users. The column was added with `default 'draft'`
-- and only three slugs were ever flipped to published, so the 112 real-world
-- games imported from the old BattlePlan are all still 'draft'.
--
-- That gate is right for BattleCards and wrong for BattlePlan: you can book a
-- table for, or log a battle of, any game regardless of whether someone has
-- authored cards for it. Publishing the drafts would fix the symptom by lying to
-- BattleCards about 112 games having content, so instead BattlePlan reads the
-- catalogue through this view.
--
-- security_invoker = false, the same sanctioned-window pattern as
-- `booking_occupancy` and `public_profiles`: the view runs as its owner and so
-- sees past the status gate on the base table. `games_select` is deliberately
-- left exactly as it is — BattleCards' gating is unchanged.
--
-- Only identity columns are exposed. Anything a draft might hold that isn't
-- ready to be seen (stat_schema, rule_types, print/bleed sizes) is left out;
-- names and slugs of real tabletop games are not sensitive, and BattlePlan has
-- to render them to be usable at all.
--
-- Idempotent.

drop view if exists public.game_catalogue;
create view public.game_catalogue
with (security_invoker = false) as
  select
    id,
    name,
    slug,
    icon,
    image,
    supported,
    enabled_battleplan,
    created_by
  from public.games;

alter view public.game_catalogue owner to postgres;

comment on view public.game_catalogue is
  'Every game, for pickers that must not be filtered by BattleCards'' draft/beta/published content gate (BattlePlan bookings and battle logging). Identity columns only. Callers apply their own enabled_battleplan / supported filters.';

revoke all on public.game_catalogue from anon, authenticated;
grant select on public.game_catalogue to authenticated;
