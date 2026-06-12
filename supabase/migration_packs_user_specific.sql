-- ============================================================
-- BattleCards — userSpecific stat fields + copy_cards_to_pack v3
--
-- Adds the `userSpecific` convention to stat_schema entries: any
-- field marked `"userSpecific": true` is stripped when its row is
-- copied into a pack. Stat fields hold per-game customization the
-- player might add (team name, hero name, etc.) which makes no
-- sense in a shareable pack.
--
-- This migration:
--   1. Marks specific stat fields as userSpecific on the seeded
--      games (Kill Team teamName, Blood Bowl teamName, StarCraft
--      unitName). Other games may flag additional fields later by
--      mirroring this UPDATE pattern.
--   2. Extends copy_cards_to_pack with two new behaviours:
--        - Optional p_card_overrides jsonb: { source_id: { name } }
--          — the pack editor's rename modal uses this to pass a
--          user-chosen name per cloned card.
--        - Strip userSpecific keys from the cloned stats based on
--          the target game's stat_schema.
--
-- The function signature changes (adds p_card_overrides), so we
-- DROP + CREATE rather than CREATE OR REPLACE.
--
-- Run in the Supabase SQL editor after migration_packs_copy_v2.sql.
-- ============================================================


-- ── Seed flags ───────────────────────────────────────────────────────────────
-- Walks each game's stat_schema array, sets userSpecific: true on the
-- listed keys, leaves every other field unchanged. Idempotent — running
-- twice has no effect.

create or replace function _flag_user_specific(p_slug text, p_keys text[])
returns void
language plpgsql
as $$
begin
  update public.games
     set stat_schema = (
       select jsonb_agg(
         case
           when field->>'key' = any(p_keys)
             then field || '{"userSpecific": true}'::jsonb
           else field
         end
       )
       from jsonb_array_elements(stat_schema) as field
     )
   where slug = p_slug;
end;
$$;

select _flag_user_specific('kill-team',  array['teamName']);
select _flag_user_specific('blood-bowl', array['teamName']);
select _flag_user_specific('starcraft',  array['unitName']);

drop function _flag_user_specific(text, text[]);


-- ── copy_cards_to_pack v3 ────────────────────────────────────────────────────

drop function if exists public.copy_cards_to_pack(uuid, uuid[]);

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

  -- Collect the userSpecific keys from the game's stat_schema (one-time per call).
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

  -- Addons attached to the selected cards (always cloned, no dedup).
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

  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id::text in (select jsonb_object_keys(v_addon_map))
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text
    and clone.id = (v_addon_map ->> src.id::text)::uuid;

  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  where ak.addon_id::text in (select jsonb_object_keys(v_addon_map))
  on conflict (addon_id, keyword_id) do nothing;

  -- Clone the cards as templates. Use the resolved game_id (cards.game_id
  -- may be null for deck cards), and apply two transforms before insert:
  --   1. Substitute the override name from p_card_overrides if present.
  --   2. Strip every userSpecific key from the cloned stats blob.
  for v_src in
    select c.*,
           coalesce(c.game_id, d.game_id) as resolved_game_id
    from public.cards c
    left join public.decks d on d.id = c.deck_id
    where c.id = any(p_source_ids)
  loop
    -- Override name lookup (jsonb path: { source_id: { name } }).
    v_override_name := nullif(
      trim(coalesce(p_card_overrides #>> array[v_src.id::text, 'name'], '')),
      ''
    );

    -- Strip userSpecific keys from the stats blob.
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

revoke all on function public.copy_cards_to_pack(uuid, uuid[], jsonb) from public;
grant  execute on function public.copy_cards_to_pack(uuid, uuid[], jsonb) to authenticated;
