-- migration_import_pack_fix.sql
--
-- Fixes import_pack to correctly clone all addons and keywords referenced by
-- pack cards, including library-owned ones attached via the "bypass copy" flow
-- (same-pack / library items in card form Phase 2 pickers).
--
-- Root cause of the 400/23502 error:
--   The original import_pack only built v_addon_map from addons where
--   a.pack_id = p_pack_id. Card form pickers added a "bypass copy" path that
--   lets library addons attach directly to pack cards without being promoted to
--   the pack. When import_pack then tried to clone card_addons for those cards,
--   the addon_id lookup in v_addon_map returned NULL, violating the
--   card_addons.addon_id NOT NULL constraint.
--
-- Fix: widen the clone scope so v_addon_map and v_keyword_map contain every
--   addon / keyword that pack cards reference, regardless of where they live.
--
-- Safe to run after migration_packs_import.sql (CREATE OR REPLACE).

create or replace function public.import_pack(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_pack         record;
  v_keyword_map  jsonb := '{}'::jsonb;
  v_addon_map    jsonb := '{}'::jsonb;
  v_card_map     jsonb := '{}'::jsonb;
begin
  -- ── Validation ──────────────────────────────────────────────

  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, is_public
    into v_pack
  from public.packs
  where id = p_pack_id;

  if v_pack.id is null
    or not (v_pack.is_public or v_pack.owner_user_id = v_user_id) then
    raise exception 'Pack not found or not accessible'
      using errcode = '42501';
  end if;

  if v_pack.owner_user_id = v_user_id then
    raise exception 'Cannot import your own pack'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.pack_imports
    where pack_id = p_pack_id and user_id = v_user_id
  ) then
    raise exception 'Pack already imported'
      using errcode = '23505';
  end if;

  -- ── Clone all needed keywords ────────────────────────────────
  -- Collects every keyword that could appear in the cloned data:
  --   (a) pack-owned keywords
  --   (b) keywords on any addon we will clone (pack-owned or library)
  --   (c) keywords directly on pack cards via card_keywords

  with all_kw as (
    select k.*
    from public.keywords k
    where k.pack_id = p_pack_id

    union

    -- Keywords attached to any addon referenced by pack cards.
    select k.*
    from public.keywords k
    join public.addon_keywords ak on ak.keyword_id = k.id
    where ak.addon_id in (
      select id from public.addons where pack_id = p_pack_id
      union
      select ca.addon_id
      from public.card_addons ca
      join public.cards c on c.id = ca.card_id
      where c.pack_id = p_pack_id
    )

    union

    -- Keywords directly on pack cards.
    select k.*
    from public.keywords k
    join public.card_keywords ck on ck.keyword_id = k.id
    join public.cards c on c.id = ck.card_id
    where c.pack_id = p_pack_id
  ),
  cloned as (
    insert into public.keywords (
      user_id, game_id, name, description, params_schema, extra,
      pack_source_id, pack_source_snapshot
    )
    select
      v_user_id,
      k.game_id,
      k.name,
      k.description,
      k.params_schema,
      k.extra,
      k.id,
      jsonb_build_object(
        'name',          k.name,
        'description',   k.description,
        'params_schema', k.params_schema,
        'extra',         k.extra
      )
    from all_kw k
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_keyword_map
  from cloned;

  -- ── Clone all needed addons ──────────────────────────────────
  -- Widens the original pack-only selection to also include addons
  -- referenced by pack cards via card_addons (library addons that bypassed
  -- the copy-to-pack step).

  with all_addons as (
    select a.*
    from public.addons a
    where a.pack_id = p_pack_id

    union

    select a.*
    from public.addons a
    join public.card_addons ca on ca.addon_id = a.id
    join public.cards c on c.id = ca.card_id
    where c.pack_id = p_pack_id
  ),
  cloned as (
    insert into public.addons (
      user_id, addon_type_id, game_id, name, description, stats,
      parent_addon_id,
      pack_source_id, pack_source_snapshot
    )
    select
      v_user_id,
      a.addon_type_id,
      a.game_id,
      a.name,
      a.description,
      a.stats,
      null,                            -- parent set in pass two
      a.id,
      jsonb_build_object(
        'name',            a.name,
        'description',     a.description,
        'stats',           a.stats,
        'parent_addon_id', a.parent_addon_id
      )
    from all_addons a
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_addon_map
  from cloned;

  -- Pass two: remap parent_addon_id for all cloned addons whose source had one.
  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id = clone.pack_source_id
    and v_addon_map ? src.id::text
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text;

  -- ── Clone addon_keywords joins ───────────────────────────────
  -- Uses v_addon_map keys as the source filter — covers all cloned addons.

  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params,
    ak.sort_order
  from public.addon_keywords ak
  where v_addon_map   ? ak.addon_id::text
    and v_keyword_map ? ak.keyword_id::text;

  -- ── Clone cards (always as templates) ───────────────────────

  with cloned as (
    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats,
      is_template,
      pack_source_id, pack_source_snapshot
    )
    select
      null,                            -- templates have no deck
      v_user_id,
      c.game_id,
      c.name,
      c.card_type,
      c.stats,
      true,
      c.id,
      jsonb_build_object(
        'name',      c.name,
        'card_type', c.card_type,
        'stats',     c.stats
      )
    from public.cards c
    where c.pack_id = p_pack_id
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_card_map
  from cloned;

  -- ── Clone card_addons joins ──────────────────────────────────

  insert into public.card_addons (card_id, addon_id, sort_order)
  select
    (v_card_map  ->> ca.card_id::text)::uuid,
    (v_addon_map ->> ca.addon_id::text)::uuid,
    ca.sort_order
  from public.card_addons ca
  join public.cards c on c.id = ca.card_id
  where c.pack_id = p_pack_id;

  -- ── Clone card_keywords joins ────────────────────────────────

  insert into public.card_keywords (card_id, keyword_id, params, sort_order)
  select
    (v_card_map    ->> ck.card_id::text)::uuid,
    (v_keyword_map ->> ck.keyword_id::text)::uuid,
    ck.params,
    ck.sort_order
  from public.card_keywords ck
  join public.cards c on c.id = ck.card_id
  where c.pack_id = p_pack_id;

  -- ── Record the import ────────────────────────────────────────

  insert into public.pack_imports (user_id, pack_id)
  values (v_user_id, p_pack_id);
end;
$$;

-- Ensure grant is in place (idempotent).
revoke all on function public.import_pack(uuid) from public;
grant  execute on function public.import_pack(uuid) to authenticated;
