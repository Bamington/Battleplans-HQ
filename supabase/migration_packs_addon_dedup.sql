-- ============================================================
-- BattleCards — addon content-match dedup on pack copy
--
-- Until now, copy_addons_to_pack and copy_cards_to_pack always
-- INSERTed a fresh addon row per source addon. That meant when a
-- user added two cards that share an attached weapon (or repeatedly
-- "Add Weapon"-ed the same weapon), the pack ended up with two
-- identical addon rows.
--
-- This migration adds a dedup step: before inserting each cloned
-- addon, look for an existing addon in the target pack whose
-- (addon_type_id, name, description, stats) all match the source.
-- If found, reuse that addon's id in the mapping; otherwise insert
-- as before.
--
-- Newly-inserted addons are tracked in v_new_addon_ids so the
-- follow-up parent_addon_id remap and addon_keywords inserts only
-- apply to them — reused addons keep their existing joins.
--
-- Dedup fingerprint deliberately omits parent_addon_id (chicken-and-
-- egg with the remap pass) and the addon's attached keywords (would
-- require joining through keyword NAMES since the source and target
-- keyword UUIDs differ). Both are corner cases; the straightforward
-- content match handles the common "Spartan Fists on every card"
-- shape.
--
-- copy_cards_to_pack keeps its v3 signature; copy_addons_to_pack
-- keeps its v2 signature. Both are CREATE OR REPLACE.
--
-- Run in the Supabase SQL editor after migration_packs_user_specific.sql.
-- ============================================================


-- ── copy_addons_to_pack — dedup pass ────────────────────────────────────────

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
  v_user_id       uuid := auth.uid();
  v_target        record;
  v_keyword_map   jsonb := '{}'::jsonb;
  v_addon_map     jsonb := '{}'::jsonb;
  v_new_addon_ids jsonb := '{}'::jsonb;   -- ids inserted in this call
  v_src           record;
  v_existing      uuid;
  v_new_id        uuid;
  v_count         integer := 0;
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

  if exists (
    select 1 from public.addons a
    where a.id = any(p_source_ids)
      and not (
        (a.pack_id is not null and exists (
          select 1 from public.packs p
          where p.id = a.pack_id
            and p.owner_user_id = v_user_id
            and p.game_id = v_target.game_id
        ))
        OR
        (a.pack_id is null
          and a.user_id = v_user_id
          and a.game_id = v_target.game_id)
      )
  ) then
    raise exception 'Source addon is not accessible to you or in a different game'
      using errcode = '42501';
  end if;

  -- Dedup keywords by name (forced by the unique index).
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

  -- Clone addons with content-match dedup against the target pack.
  for v_src in
    select * from public.addons where id = any(p_source_ids)
  loop
    select id into v_existing
    from public.addons
    where pack_id        = p_target_pack_id
      and addon_type_id  = v_src.addon_type_id
      and name           = v_src.name
      and coalesce(description, '') = coalesce(v_src.description, '')
      and coalesce(stats, '{}'::jsonb) = coalesce(v_src.stats, '{}'::jsonb)
    limit 1;

    if v_existing is not null then
      v_new_id := v_existing;
    else
      insert into public.addons (
        user_id, addon_type_id, game_id, name, description, stats,
        parent_addon_id, pack_id
      ) values (
        v_user_id, v_src.addon_type_id, v_src.game_id, v_src.name,
        v_src.description, v_src.stats, null, p_target_pack_id
      ) returning id into v_new_id;
      v_new_addon_ids := v_new_addon_ids || jsonb_build_object(v_new_id::text, true);
      v_count := v_count + 1;
    end if;

    v_addon_map := v_addon_map || jsonb_build_object(v_src.id::text, v_new_id::text);
  end loop;

  -- Parent remap only for newly-inserted addons.
  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id = any(p_source_ids)
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text
    and clone.id = (v_addon_map ->> src.id::text)::uuid
    and v_new_addon_ids ? clone.id::text;

  -- addon_keywords joins only for newly-inserted addons (reused addons
  -- already carry their own joins).
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  where ak.addon_id = any(p_source_ids)
    and v_new_addon_ids ? (v_addon_map ->> ak.addon_id::text)
  on conflict (addon_id, keyword_id) do nothing;

  return v_count;
end;
$$;


-- ── copy_cards_to_pack — same dedup applied to its addon section ────────────

create or replace function public.copy_cards_to_pack(
  p_target_pack_id uuid,
  p_source_ids     uuid[],
  p_card_overrides jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_target         record;
  v_target_schema  jsonb;
  v_user_keys      text[];
  v_keyword_map    jsonb := '{}'::jsonb;
  v_addon_map      jsonb := '{}'::jsonb;
  v_new_addon_ids  jsonb := '{}'::jsonb;
  v_card_map       jsonb := '{}'::jsonb;
  v_src            record;
  v_existing       uuid;
  v_new_id         uuid;
  v_count          integer := 0;
  v_override_name  text;
  v_clean_stats    jsonb;
  v_k              text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select p.id, p.owner_user_id, p.game_id, g.stat_schema
    into v_target
  from public.packs p
  join public.games g on g.id = p.game_id
  where p.id = p_target_pack_id;
  if v_target.id is null or v_target.owner_user_id <> v_user_id then
    raise exception 'Target pack not found or not owned by you' using errcode = '42501';
  end if;
  v_target_schema := v_target.stat_schema;

  v_user_keys := array(
    select coalesce(field->>'key', '')
    from jsonb_array_elements(coalesce(v_target_schema, '[]'::jsonb)) as field
    where (field->>'userSpecific')::boolean = true
  );

  if array_length(p_source_ids, 1) is null then return 0; end if;

  if exists (
    select 1 from public.cards c
    where c.id = any(p_source_ids)
      and not (
        (c.pack_id is not null and exists (
          select 1 from public.packs p
          where p.id = c.pack_id
            and p.owner_user_id = v_user_id
            and p.game_id = v_target.game_id
        ))
        OR
        (c.deck_id is not null and exists (
          select 1 from public.decks d
          where d.id = c.deck_id
            and d.user_id = v_user_id
            and d.game_id = v_target.game_id
        ))
        OR
        (c.deck_id is null and c.pack_id is null and c.is_template = true
          and c.user_id = v_user_id
          and c.game_id = v_target.game_id)
      )
  ) then
    raise exception 'Source card is not accessible to you or in a different game'
      using errcode = '42501';
  end if;

  -- Keywords referenced directly or transitively (via card_addons).
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

  -- Addons attached to the selected cards, with content-match dedup.
  for v_src in
    select distinct a.*
    from public.addons a
    join public.card_addons ca on ca.addon_id = a.id
    where ca.card_id = any(p_source_ids)
  loop
    select id into v_existing
    from public.addons
    where pack_id        = p_target_pack_id
      and addon_type_id  = v_src.addon_type_id
      and name           = v_src.name
      and coalesce(description, '') = coalesce(v_src.description, '')
      and coalesce(stats, '{}'::jsonb) = coalesce(v_src.stats, '{}'::jsonb)
    limit 1;

    if v_existing is not null then
      v_new_id := v_existing;
    else
      insert into public.addons (
        user_id, addon_type_id, game_id, name, description, stats,
        parent_addon_id, pack_id
      ) values (
        v_user_id, v_src.addon_type_id, v_src.game_id, v_src.name,
        v_src.description, v_src.stats, null, p_target_pack_id
      ) returning id into v_new_id;
      v_new_addon_ids := v_new_addon_ids || jsonb_build_object(v_new_id::text, true);
    end if;

    v_addon_map := v_addon_map || jsonb_build_object(v_src.id::text, v_new_id::text);
  end loop;

  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id::text in (select jsonb_object_keys(v_addon_map))
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text
    and clone.id = (v_addon_map ->> src.id::text)::uuid
    and v_new_addon_ids ? clone.id::text;

  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  where ak.addon_id::text in (select jsonb_object_keys(v_addon_map))
    and v_new_addon_ids ? (v_addon_map ->> ak.addon_id::text)
  on conflict (addon_id, keyword_id) do nothing;

  -- Clone cards as templates with overrides + stat stripping.
  for v_src in
    select c.*,
           coalesce(c.game_id, d.game_id) as resolved_game_id
    from public.cards c
    left join public.decks d on d.id = c.deck_id
    where c.id = any(p_source_ids)
  loop
    v_override_name := nullif(
      trim(coalesce(p_card_overrides #>> array[v_src.id::text, 'name'], '')),
      ''
    );

    v_clean_stats := coalesce(v_src.stats, '{}'::jsonb);
    if v_user_keys is not null then
      foreach v_k in array v_user_keys loop
        v_clean_stats := v_clean_stats - v_k;
      end loop;
    end if;

    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats,
      is_template, pack_id
    ) values (
      null,
      v_user_id,
      v_src.resolved_game_id,
      coalesce(v_override_name, v_src.name),
      v_src.card_type,
      v_clean_stats,
      true,
      p_target_pack_id
    ) returning id into v_new_id;

    v_card_map := v_card_map || jsonb_build_object(v_src.id::text, v_new_id::text);
    v_count := v_count + 1;
  end loop;

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
