-- ============================================================
-- BattleCards — addon hierarchy migration
-- Adds an optional parent/child relationship at the addon
-- *definition* level: an addon can declare another addon (in the
-- same game) as its parent. A child renders as an indented row
-- under its parent on every card it appears on.
--
-- Motivation: StarCraft weapons can be defined as upgrades of
-- another weapon (e.g. AGG-12 is a child of the C-14 Rifle).
-- The user's design pins parent at the addon definition — the
-- same upgrade always sits under the same parent regardless of
-- which card it's attached to.
--
-- Note: an earlier draft of this migration put the parent column
-- on card_addons (per-attachment). That approach is superseded
-- by migration_starcraft_weapons_modal.sql, which moves it to
-- addons. Fresh installs running this file get the final shape
-- directly; in-flight DBs apply the weapons_modal migration to
-- migrate.
-- ============================================================

alter table public.addons
  add column parent_addon_id uuid
    references public.addons (id) on delete set null;

-- A child cannot be its own parent.
alter table public.addons
  add constraint addons_no_self_parent
    check (parent_addon_id is null or parent_addon_id <> id);

create index if not exists addons_parent_idx
  on public.addons (parent_addon_id)
  where parent_addon_id is not null;


-- ── Trigger: parent must live in the same game ─────────────────────────────
-- Same-user enforcement is already covered by RLS; this guards the
-- same-user, cross-game case.

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

create trigger addons_validate_parent_game
  before insert or update of parent_addon_id, game_id on public.addons
  for each row execute procedure public.validate_addon_parent_game();
