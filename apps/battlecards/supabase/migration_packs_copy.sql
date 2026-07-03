-- ============================================================
-- BattleCards — pack-to-pack copy RPCs
--
-- Three functions used by the pack editor's "Add X to Pack" flow.
-- Each takes a target pack id (must be owned by the caller) and a
-- list of source entity ids (must live in packs the caller also
-- owns, same game as the target), and copies them into the target
-- pack as fresh pack-source rows. Dependencies are pulled in
-- automatically:
--
--   copy_keywords_to_pack — keywords only; dedupes by name in
--     the target pack (forced by the keywords unique index).
--
--   copy_addons_to_pack — addons + their attached keywords. Each
--     addon is always cloned (no name dedup); keywords are deduped
--     by name. addon_keywords joins are recreated against the new
--     ids. parent_addon_id is remapped in a second pass.
--
--   copy_cards_to_pack — cards + their card_addons (cloned addons)
--     + their card_keywords + the keywords transitively referenced
--     by both. Cards are always cloned as templates (deck_id null,
--     is_template true). Addons + keywords follow the same dedup
--     rules as above.
--
-- All three:
--   - Run as SECURITY DEFINER so they can manipulate join rows on
--     templates (the user-context card_addons / card_keywords
--     INSERT policies forbid templates without a deck). Equivalent
--     access checks are enforced inside the function.
--   - Cloned rows are pack-source rows (pack_id set,
--     pack_source_id null) — there's no provenance back to the
--     source pack by design (per the user's "no provenance" call).
--
-- Run in the Supabase SQL editor after migration_packs_import.sql.
-- ============================================================


-- ── Shared validation block lives inline in each function ──────────
-- (Postgres has no easy way to share local declarations across
-- functions, and the validation differs by entity type.)


-- ── copy_keywords_to_pack ───────────────────────────────────────────

create or replace function public.copy_keywords_to_pack(
  p_target_pack_id uuid,
  p_source_ids     uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_target   record;
  v_count    integer := 0;
  v_src      record;
  v_existing uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, game_id into v_target
  from public.packs where id = p_target_pack_id;
  if v_target.id is null or v_target.owner_user_id <> v_user_id then
    raise exception 'Target pack not found or not owned by you' using errcode = '42501';
  end if;

  if array_length(p_source_ids, 1) is null then return 0; end if;

  -- Each source keyword must live in a pack owned by the caller, same game.
  if exists (
    select 1 from public.keywords k
    where k.id = any(p_source_ids)
      and k.pack_id is not null
      and not exists (
        select 1 from public.packs p
        where p.id = k.pack_id
          and p.owner_user_id = v_user_id
          and p.game_id = v_target.game_id
      )
  ) then
    raise exception 'Source keyword belongs to a pack you do not own or a different game'
      using errcode = '42501';
  end if;

  -- Loop: dedupe by (target_pack, game, name) — insert if absent, skip if present.
  for v_src in
    select * from public.keywords where id = any(p_source_ids)
  loop
    select id into v_existing
    from public.keywords
    where pack_id = p_target_pack_id
      and game_id = v_target.game_id
      and name    = v_src.name
    limit 1;

    if v_existing is null then
      insert into public.keywords (
        user_id, game_id, name, description, params_schema, extra, pack_id
      ) values (
        v_user_id, v_src.game_id, v_src.name, v_src.description,
        v_src.params_schema, v_src.extra, p_target_pack_id
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.copy_keywords_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_keywords_to_pack(uuid, uuid[]) to authenticated;


-- ── copy_addons_to_pack ─────────────────────────────────────────────

create or replace function public.copy_addons_to_pack(
  p_target_pack_id uuid,
  p_source_ids     uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_target      record;
  v_keyword_map jsonb := '{}'::jsonb;
  v_addon_map   jsonb := '{}'::jsonb;
  v_src         record;
  v_existing    uuid;
  v_new_id      uuid;
  v_count       integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, game_id into v_target
  from public.packs where id = p_target_pack_id;
  if v_target.id is null or v_target.owner_user_id <> v_user_id then
    raise exception 'Target pack not found or not owned by you' using errcode = '42501';
  end if;

  if array_length(p_source_ids, 1) is null then return 0; end if;

  -- Every source addon must live in a pack the caller owns, same game.
  if exists (
    select 1 from public.addons a
    where a.id = any(p_source_ids)
      and a.pack_id is not null
      and not exists (
        select 1 from public.packs p
        where p.id = a.pack_id
          and p.owner_user_id = v_user_id
          and p.game_id = v_target.game_id
      )
  ) then
    raise exception 'Source addon belongs to a pack you do not own or a different game'
      using errcode = '42501';
  end if;

  -- 1. Ensure every keyword referenced by these addons exists in the target
  --    pack. Dedupe by name; build source_id → target_id map.
  for v_src in
    select distinct k.*
    from public.keywords k
    join public.addon_keywords ak on ak.keyword_id = k.id
    where ak.addon_id = any(p_source_ids)
  loop
    select id into v_existing
    from public.keywords
    where pack_id = p_target_pack_id
      and game_id = v_target.game_id
      and name    = v_src.name
    limit 1;

    if v_existing is null then
      insert into public.keywords (
        user_id, game_id, name, description, params_schema, extra, pack_id
      ) values (
        v_user_id, v_src.game_id, v_src.name, v_src.description,
        v_src.params_schema, v_src.extra, p_target_pack_id
      ) returning id into v_new_id;
    else
      v_new_id := v_existing;
    end if;

    v_keyword_map := v_keyword_map || jsonb_build_object(v_src.id::text, v_new_id::text);
  end loop;

  -- 2. Clone the addons themselves. parent_addon_id deferred to the
  --    second pass below.
  for v_src in
    select * from public.addons where id = any(p_source_ids)
  loop
    insert into public.addons (
      user_id, addon_type_id, game_id, name, description, stats,
      parent_addon_id, pack_id
    ) values (
      v_user_id, v_src.addon_type_id, v_src.game_id, v_src.name,
      v_src.description, v_src.stats, null, p_target_pack_id
    ) returning id into v_new_id;

    v_addon_map := v_addon_map || jsonb_build_object(v_src.id::text, v_new_id::text);
    v_count := v_count + 1;
  end loop;

  -- 2b. Remap parent_addon_id on clones whose source had a parent that
  --     was also part of this copy batch. Parents outside the batch
  --     can't be referenced from the target pack, so they get null
  --     (intentional — the user is copying a sub-tree).
  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id = any(p_source_ids)
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text
    and clone.id = (v_addon_map ->> src.id::text)::uuid;

  -- 3. Recreate addon_keywords joins against the new ids.
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  where ak.addon_id = any(p_source_ids)
  on conflict (addon_id, keyword_id) do nothing;

  return v_count;
end;
$$;

revoke all on function public.copy_addons_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_addons_to_pack(uuid, uuid[]) to authenticated;


-- ── copy_cards_to_pack ──────────────────────────────────────────────

create or replace function public.copy_cards_to_pack(
  p_target_pack_id uuid,
  p_source_ids     uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_target      record;
  v_keyword_map jsonb := '{}'::jsonb;
  v_addon_map   jsonb := '{}'::jsonb;
  v_card_map    jsonb := '{}'::jsonb;
  v_src         record;
  v_existing    uuid;
  v_new_id      uuid;
  v_count       integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, game_id into v_target
  from public.packs where id = p_target_pack_id;
  if v_target.id is null or v_target.owner_user_id <> v_user_id then
    raise exception 'Target pack not found or not owned by you' using errcode = '42501';
  end if;

  if array_length(p_source_ids, 1) is null then return 0; end if;

  -- Every source card must live in a pack the caller owns, same game.
  if exists (
    select 1 from public.cards c
    where c.id = any(p_source_ids)
      and c.pack_id is not null
      and not exists (
        select 1 from public.packs p
        where p.id = c.pack_id
          and p.owner_user_id = v_user_id
          and p.game_id = v_target.game_id
      )
  ) then
    raise exception 'Source card belongs to a pack you do not own or a different game'
      using errcode = '42501';
  end if;

  -- 1. Ensure all keywords transitively referenced by these cards exist
  --    in the target pack. Two sources of keywords:
  --      a) directly on the card via card_keywords
  --      b) via attached addons via card_addons → addon_keywords
  for v_src in
    select distinct k.*
    from public.keywords k
    where k.id in (
      select keyword_id from public.card_keywords
      where card_id = any(p_source_ids)
      union
      select ak.keyword_id
      from public.addon_keywords ak
      join public.card_addons ca on ca.addon_id = ak.addon_id
      where ca.card_id = any(p_source_ids)
    )
  loop
    select id into v_existing
    from public.keywords
    where pack_id = p_target_pack_id
      and game_id = v_target.game_id
      and name    = v_src.name
    limit 1;

    if v_existing is null then
      insert into public.keywords (
        user_id, game_id, name, description, params_schema, extra, pack_id
      ) values (
        v_user_id, v_src.game_id, v_src.name, v_src.description,
        v_src.params_schema, v_src.extra, p_target_pack_id
      ) returning id into v_new_id;
    else
      v_new_id := v_existing;
    end if;

    v_keyword_map := v_keyword_map || jsonb_build_object(v_src.id::text, v_new_id::text);
  end loop;

  -- 2. Clone all addons attached to the selected cards.
  for v_src in
    select distinct a.*
    from public.addons a
    join public.card_addons ca on ca.addon_id = a.id
    where ca.card_id = any(p_source_ids)
  loop
    insert into public.addons (
      user_id, addon_type_id, game_id, name, description, stats,
      parent_addon_id, pack_id
    ) values (
      v_user_id, v_src.addon_type_id, v_src.game_id, v_src.name,
      v_src.description, v_src.stats, null, p_target_pack_id
    ) returning id into v_new_id;

    v_addon_map := v_addon_map || jsonb_build_object(v_src.id::text, v_new_id::text);
  end loop;

  -- 2b. Remap addon parent_addon_id within the batch.
  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id::text in (select jsonb_object_keys(v_addon_map))
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text
    and clone.id = (v_addon_map ->> src.id::text)::uuid;

  -- 3. Recreate addon_keywords joins for the cloned addons.
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  where ak.addon_id::text in (select jsonb_object_keys(v_addon_map))
  on conflict (addon_id, keyword_id) do nothing;

  -- 4. Clone the cards themselves as templates.
  for v_src in
    select * from public.cards where id = any(p_source_ids)
  loop
    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats,
      is_template, pack_id
    ) values (
      null, v_user_id, v_src.game_id, v_src.name, v_src.card_type,
      v_src.stats, true, p_target_pack_id
    ) returning id into v_new_id;

    v_card_map := v_card_map || jsonb_build_object(v_src.id::text, v_new_id::text);
    v_count := v_count + 1;
  end loop;

  -- 5. Recreate card_addons / card_keywords joins.
  insert into public.card_addons (card_id, addon_id, sort_order)
  select
    (v_card_map  ->> ca.card_id::text)::uuid,
    (v_addon_map ->> ca.addon_id::text)::uuid,
    ca.sort_order
  from public.card_addons ca
  where ca.card_id = any(p_source_ids);

  insert into public.card_keywords (card_id, keyword_id, params, sort_order)
  select
    (v_card_map    ->> ck.card_id::text)::uuid,
    (v_keyword_map ->> ck.keyword_id::text)::uuid,
    ck.params, ck.sort_order
  from public.card_keywords ck
  where ck.card_id = any(p_source_ids);

  return v_count;
end;
$$;

revoke all on function public.copy_cards_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_cards_to_pack(uuid, uuid[]) to authenticated;
