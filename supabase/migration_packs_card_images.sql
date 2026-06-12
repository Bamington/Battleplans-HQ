-- ============================================================
-- BattleCards — card_images RLS for pack cards
-- Extends the card_images policies to also allow pack card
-- owners to manage portrait images. The original policies only
-- covered deck-owned cards via the decks join; pack cards have
-- deck_id = null so they were always denied.
--
-- Also extends copy_cards_to_pack with p_retain_portraits so
-- portraits are cloned along with the card.
--
-- Run in the Supabase SQL editor after migration_card_images_type.sql.
-- ============================================================


-- ── Extend card_images table policies ───────────────────────────────────────

drop policy if exists "card_images_select" on public.card_images;
drop policy if exists "card_images_insert" on public.card_images;
drop policy if exists "card_images_update" on public.card_images;
drop policy if exists "card_images_delete" on public.card_images;

create policy "card_images_select" on public.card_images
  for select to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks on decks.id = c.deck_id
      left join public.packs on packs.id = c.pack_id
      where c.id = card_images.card_id
        and (
          (c.deck_id  is not null and decks.user_id        = auth.uid())
          or
          (c.pack_id  is not null and packs.owner_user_id  = auth.uid())
        )
    )
  );

create policy "card_images_insert" on public.card_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards c
      left join public.decks on decks.id = c.deck_id
      left join public.packs on packs.id = c.pack_id
      where c.id = card_images.card_id
        and (
          (c.deck_id  is not null and decks.user_id        = auth.uid())
          or
          (c.pack_id  is not null and packs.owner_user_id  = auth.uid())
        )
    )
  );

create policy "card_images_update" on public.card_images
  for update to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks on decks.id = c.deck_id
      left join public.packs on packs.id = c.pack_id
      where c.id = card_images.card_id
        and (
          (c.deck_id  is not null and decks.user_id        = auth.uid())
          or
          (c.pack_id  is not null and packs.owner_user_id  = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.cards c
      left join public.decks on decks.id = c.deck_id
      left join public.packs on packs.id = c.pack_id
      where c.id = card_images.card_id
        and (
          (c.deck_id  is not null and decks.user_id        = auth.uid())
          or
          (c.pack_id  is not null and packs.owner_user_id  = auth.uid())
        )
    )
  );

create policy "card_images_delete" on public.card_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards c
      left join public.decks on decks.id = c.deck_id
      left join public.packs on packs.id = c.pack_id
      where c.id = card_images.card_id
        and (
          (c.deck_id  is not null and decks.user_id        = auth.uid())
          or
          (c.pack_id  is not null and packs.owner_user_id  = auth.uid())
        )
    )
  );


-- ── Extend copy_cards_to_pack with portrait cloning ──────────────────────────

-- Drop old 3-param signature so there is no ambiguous overload.
drop function if exists public.copy_cards_to_pack(uuid, uuid[], jsonb);

create or replace function public.copy_cards_to_pack(
  p_target_pack_id   uuid,
  p_source_ids       uuid[],
  p_card_overrides   jsonb    default '{}'::jsonb,
  p_retain_portraits boolean  default true
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

  -- Copy portrait images for the cloned cards.
  if p_retain_portraits then
    insert into public.card_images (card_id, file_path, sort_order, image_type)
    select
      (v_card_map ->> ci.card_id::text)::uuid,
      ci.file_path,
      ci.sort_order,
      ci.image_type
    from public.card_images ci
    where ci.card_id = any(p_source_ids)
      and (v_card_map ->> ci.card_id::text) is not null;
  end if;

  return v_count;
end;
$$;

revoke all on function public.copy_cards_to_pack(uuid, uuid[], jsonb, boolean) from public;
grant  execute on function public.copy_cards_to_pack(uuid, uuid[], jsonb, boolean) to authenticated;
