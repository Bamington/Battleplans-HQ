-- ============================================================
-- BattleCards — pack-copy RPCs v2: extend source scope
--
-- Updates the three copy_*_to_pack functions so the picker can pull
-- items from beyond the user's own packs:
--
--   copy_keywords_to_pack — keywords from packs the caller owns
--     OR keywords the caller owns directly (pack_id null).
--
--   copy_addons_to_pack — addons from packs the caller owns OR
--     addons the caller owns directly (pack_id null). Dependent
--     keywords also drawn from either scope.
--
--   copy_cards_to_pack — cards from:
--     - packs the caller owns, OR
--     - decks the caller owns (deck cards), OR
--     - user-owned templates (is_template true, no pack, no deck).
--
-- Each function's validation block is replaced; the clone logic is
-- unchanged because it never depended on the source being in a pack.
--
-- This also closes a security gap in v1: the previous validation
-- only checked pack ownership when pack_id was set, meaning a
-- user-owned source row (pack_id null) belonging to a DIFFERENT
-- user would pass validation. The new checks explicitly verify
-- ownership for both pack-owned and user-owned source rows.
--
-- Run in the Supabase SQL editor after migration_packs_copy.sql.
-- ============================================================


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

  -- A source keyword must be either (a) in a pack the caller owns, OR
  -- (b) owned directly by the caller (pack_id null) — both same game.
  if exists (
    select 1 from public.keywords k
    where k.id = any(p_source_ids)
      and not (
        (k.pack_id is not null and exists (
          select 1 from public.packs p
          where p.id = k.pack_id
            and p.owner_user_id = v_user_id
            and p.game_id = v_target.game_id
        ))
        OR
        (k.pack_id is null
          and k.user_id = v_user_id
          and k.game_id = v_target.game_id)
      )
  ) then
    raise exception 'Source keyword is not accessible to you or in a different game'
      using errcode = '42501';
  end if;

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

  -- A source addon must be either (a) in a pack the caller owns, OR
  -- (b) owned directly by the caller (pack_id null) — both same game.
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

  -- Keywords referenced by these addons. Dedup by (target_pack, game, name).
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

  -- Clone addons (parent_addon_id deferred to second pass).
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

  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id = any(p_source_ids)
    and src.parent_addon_id is not null
    and v_addon_map ? src.parent_addon_id::text
    and clone.id = (v_addon_map ->> src.id::text)::uuid;

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

  -- A source card must be either:
  --   (a) in a pack the caller owns, same game; or
  --   (b) in a deck the caller owns, same game; or
  --   (c) a user-owned template (is_template true, no pack, no deck), same game.
  -- For (b) the card's game_id may be null (deck cards derive game from the
  -- parent deck), so we check deck.game_id rather than cards.game_id.
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
  -- may be null for deck cards) so the cloned template satisfies the
  -- "game_id not null when is_template" check.
  for v_src in
    select c.*,
           coalesce(c.game_id, d.game_id) as resolved_game_id
    from public.cards c
    left join public.decks d on d.id = c.deck_id
    where c.id = any(p_source_ids)
  loop
    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats,
      is_template, pack_id
    ) values (
      null, v_user_id, v_src.resolved_game_id, v_src.name, v_src.card_type,
      v_src.stats, true, p_target_pack_id
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
