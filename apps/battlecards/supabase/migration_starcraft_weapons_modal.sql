-- ============================================================
-- BattleCards — StarCraft: weapons modal data model
-- Aligns the StarCraft schema with the new modal-driven flow
-- (Create Weapon / Add Keyword) per Figma design batch.
--
-- Three changes:
--   1. Move addon hierarchy from card_addons.parent_card_addon_id
--      to a new addons.parent_addon_id column. The old approach
--      let the same upgrade live under different parents on
--      different cards; the new design pins parent at the
--      addon-definition level.
--   2. Rewrite StarCraft addon stat_schemas:
--        - weapons:  phase enum (movement/assault/combat/null — turn-phase
--                    the weapon fires in), range (number), hit (number),
--                    roa, dmg, surgeType (text), sDice (text — supports
--                    "D3+1")
--        - rules:    phase enum (active/passive/reaction/null — activation
--                    trait) + cpCost + description
--   3. Wipe the old JSONB weapons/rules arrays off StarCraft cards
--      — they were bound to the previous (now dropped) phase enums.
--      The cards themselves are preserved.
--
-- Run after migration_starcraft.sql + migration_addon_hierarchy.sql.
-- ============================================================

-- ── 1. Move addon hierarchy → addons.parent_addon_id ───────────────────────

-- New column on addons. Same-game constraint enforced via trigger below.
alter table public.addons
  add column if not exists parent_addon_id uuid
    references public.addons (id) on delete set null;

alter table public.addons
  drop constraint if exists addons_no_self_parent;
alter table public.addons
  add constraint addons_no_self_parent
    check (parent_addon_id is null or parent_addon_id <> id);

create index if not exists addons_parent_idx
  on public.addons (parent_addon_id)
  where parent_addon_id is not null;

-- Trigger: parent must be in the same game. Without this an upgrade defined
-- for one game could reference a parent from another. The user-scoped RLS
-- policy on addons would normally block cross-user references; this guards
-- the same-user, cross-game case.
create or replace function public.validate_addon_parent_game()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _parent_game uuid;
begin
  if new.parent_addon_id is null then return new; end if;

  select game_id into _parent_game
  from public.addons
  where id = new.parent_addon_id;

  if _parent_game is null then
    raise exception 'Parent addon % does not exist', new.parent_addon_id;
  end if;

  if _parent_game <> new.game_id then
    raise exception 'Parent addon must belong to the same game';
  end if;

  return new;
end;
$$;

drop trigger if exists addons_validate_parent_game on public.addons;
create trigger addons_validate_parent_game
  before insert or update of parent_addon_id, game_id on public.addons
  for each row execute procedure public.validate_addon_parent_game();

-- Drop the old per-attachment parent column on card_addons. The trigger
-- attached to it goes away with the column; remove explicitly to be safe.
drop trigger  if exists card_addons_validate_parent on public.card_addons;
drop function if exists public.validate_card_addon_parent();
drop index    if exists public.card_addons_parent_idx;

alter table public.card_addons
  drop constraint if exists card_addons_no_self_parent;
alter table public.card_addons
  drop column     if exists parent_card_addon_id;


-- ── 2. Rewrite StarCraft addon stat_schemas ────────────────────────────────

update public.addon_types
   set stat_schema = '[
     {"key": "phase",     "label": "Phase",      "type": "text"},
     {"key": "range",     "label": "Range",      "type": "number"},
     {"key": "roa",       "label": "RoA",        "type": "number"},
     {"key": "hit",       "label": "Hit",        "type": "number"},
     {"key": "dmg",       "label": "Damage",     "type": "number"},
     {"key": "surgeType", "label": "Surge Type", "type": "text"},
     {"key": "sDice",     "label": "Surge Dice", "type": "text"}
   ]'::jsonb
 where slug = 'weapons'
   and game_id = (select id from public.games where slug = 'starcraft');

update public.addon_types
   set stat_schema = '[
     {"key": "phase",       "label": "Phase",       "type": "text"},
     {"key": "cpCost",      "label": "CP Cost",     "type": "number"},
     {"key": "description", "label": "Description", "type": "text"}
   ]'::jsonb
 where slug = 'rules'
   and game_id = (select id from public.games where slug = 'starcraft');

-- Update the constraint payloads to match.
update public.game_constraints
   set constraints = '{
     "fields": {
       "name":             { "required": true, "maxLength": 40 },
       "stats.phase":      { "maxLength": 12 },
       "stats.range":      { "min": 0, "max": 99 },
       "stats.roa":        { "min": 0, "max": 20 },
       "stats.hit":        { "min": 0, "max": 9 },
       "stats.dmg":        { "min": 0, "max": 20 },
       "stats.surgeType":  { "maxLength": 20 },
       "stats.sDice":      { "maxLength": 12 }
     },
     "limits": { "maxKeywords": 10 }
   }'::jsonb
 where addon_type_id = (
   select at.id
     from public.addon_types at
     join public.games g on g.id = at.game_id
    where g.slug = 'starcraft' and at.slug = 'weapons'
 );

update public.game_constraints
   set constraints = '{
     "fields": {
       "name":              { "required": true, "maxLength": 40 },
       "stats.phase":       { "maxLength": 12 },
       "stats.cpCost":      { "min": 0, "max": 9 },
       "stats.description": { "maxLength": 500 }
     },
     "limits": { "maxKeywords": 5 }
   }'::jsonb
 where addon_type_id = (
   select at.id
     from public.addon_types at
     join public.games g on g.id = at.game_id
    where g.slug = 'starcraft' and at.slug = 'rules'
 );


-- ── 3. Wipe stale JSONB weapon/rule arrays on StarCraft cards ──────────────
-- The cards stay; only the previous in-stats `weapons` / `rules` keys go.
update public.cards
   set stats = stats - 'weapons' - 'rules'
 where deck_id in (
   select d.id
     from public.decks d
     join public.games g on g.id = d.game_id
    where g.slug = 'starcraft'
 )
    or (is_template = true and game_id = (select id from public.games where slug = 'starcraft'));
