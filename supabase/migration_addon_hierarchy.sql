-- ============================================================
-- BattleCards — addon hierarchy migration
-- Adds optional parent/child relationships between card_addons
-- rows, so an addon can be attached as an "upgrade" or variant
-- of another addon on the same card.
--
-- Motivation: Starcraft unit cards allow weapon upgrades that
-- belong to a specific parent weapon (e.g. AGG-12 is a child of
-- the C-14 Rifle).  The existing flat card_addons → addons join
-- doesn't express this relationship.
--
-- Backwards compatible: parent_card_addon_id is nullable; every
-- existing row stays a root (parent = null) with no behaviour
-- change for games that don't use hierarchies.
-- ============================================================

alter table public.card_addons
  add column parent_card_addon_id uuid
    references public.card_addons (id) on delete cascade;

-- A child cannot be its own parent.
alter table public.card_addons
  add constraint card_addons_no_self_parent
    check (parent_card_addon_id is null or parent_card_addon_id <> id);

-- Fast lookup of a given addon's children.
create index if not exists card_addons_parent_idx
  on public.card_addons (parent_card_addon_id)
  where parent_card_addon_id is not null;


-- ── Trigger: keep parent/child on the same card ─────────────────────────────
-- Prevents a row from pointing at a parent that lives on a different card.

create or replace function public.validate_card_addon_parent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _parent_card_id uuid;
begin
  if new.parent_card_addon_id is null then
    return new;
  end if;

  select card_id into _parent_card_id
  from public.card_addons
  where id = new.parent_card_addon_id;

  if _parent_card_id is null then
    raise exception 'Parent card_addon % does not exist', new.parent_card_addon_id;
  end if;

  if _parent_card_id <> new.card_id then
    raise exception 'Parent card_addon must belong to the same card';
  end if;

  return new;
end;
$$;

create trigger card_addons_validate_parent
  before insert or update of parent_card_addon_id, card_id on public.card_addons
  for each row execute procedure public.validate_card_addon_parent();
