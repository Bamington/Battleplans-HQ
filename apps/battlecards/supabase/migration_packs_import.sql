-- ============================================================
-- BattleCards — pack import RPC
--
-- Adds the import_pack(uuid) function: an atomic deep-clone that
-- copies a pack's keywords, addons (+ their joins), and cards
-- (+ their joins) into the calling user's tables as templates.
--
-- After import the user owns standalone templates / addons /
-- keywords identical in shape to ones they'd have created
-- themselves, except each clone carries:
--   - pack_source_id        — points at the source row, for future
--                             update detection
--   - pack_source_snapshot  — content snapshot at clone time, used
--                             by a future field-level merge
-- A row is also inserted into pack_imports to mark the install.
--
-- WHY SECURITY DEFINER
-- The existing card_addons / card_keywords INSERT policies require
-- the card to belong to a deck owned by the caller; cloned pack
-- cards are templates (no deck), so user-context INSERTs would be
-- blocked. Rather than ripple a sweeping RLS rewrite into this
-- change, the function bypasses RLS and enforces the equivalent
-- checks explicitly:
--   1. Caller must be authenticated (auth.uid() is not null)
--   2. Pack must exist and be visible to the caller
--      (is_public OR owner_user_id = caller)
--   3. Caller cannot import their own pack
--   4. Pack must not already be imported by the caller
--
-- Run in the Supabase SQL editor after migration_packs.sql.
-- ============================================================

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

  -- ── Clone keywords ──────────────────────────────────────────
  -- Build a source_id → clone_id map for use when re-creating
  -- the addon_keywords / card_keywords joins below.

  with cloned as (
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
    from public.keywords k
    where k.pack_id = p_pack_id
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_keyword_map
  from cloned;

  -- ── Clone addons (parent_addon_id deferred) ─────────────────
  -- First pass inserts every addon with parent_addon_id = null
  -- so we can build the source→clone map without worrying about
  -- iteration order. Second pass below remaps the parents.

  with cloned as (
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
    from public.addons a
    where a.pack_id = p_pack_id
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_addon_map
  from cloned;

  -- Pass two: remap parent_addon_id on clones whose source had a parent.
  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id = clone.pack_source_id
    and src.pack_id = p_pack_id
    and src.parent_addon_id is not null;

  -- ── Clone addon_keywords joins ──────────────────────────────

  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params,
    ak.sort_order
  from public.addon_keywords ak
  join public.addons a on a.id = ak.addon_id
  where a.pack_id = p_pack_id;

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

  -- ── Clone card_addons joins ─────────────────────────────────

  insert into public.card_addons (card_id, addon_id, sort_order)
  select
    (v_card_map  ->> ca.card_id::text)::uuid,
    (v_addon_map ->> ca.addon_id::text)::uuid,
    ca.sort_order
  from public.card_addons ca
  join public.cards c on c.id = ca.card_id
  where c.pack_id = p_pack_id;

  -- ── Clone card_keywords joins ───────────────────────────────

  insert into public.card_keywords (card_id, keyword_id, params, sort_order)
  select
    (v_card_map    ->> ck.card_id::text)::uuid,
    (v_keyword_map ->> ck.keyword_id::text)::uuid,
    ck.params,
    ck.sort_order
  from public.card_keywords ck
  join public.cards c on c.id = ck.card_id
  where c.pack_id = p_pack_id;

  -- ── Record the import ───────────────────────────────────────

  insert into public.pack_imports (user_id, pack_id)
  values (v_user_id, p_pack_id);
end;
$$;

-- Make the function callable by signed-in users (PostgREST exposes
-- it as an RPC endpoint). Anonymous users are not granted access.
revoke all on function public.import_pack(uuid) from public;
grant  execute on function public.import_pack(uuid) to authenticated;
