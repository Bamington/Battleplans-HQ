-- Already applied to the live database on 2026-11 from the standalone BattleCards repo
-- (supabase/migration_card_faces.sql); recorded here with 'supabase migration repair'.

-- migration_card_faces.sql
--
-- List Builder support: static "card faces" (generic official card chrome).
--
-- A card face is the full printed card image for a static card (e.g. an
-- official Gundam Assemble unit card). It is deliberately NOT stored in
-- card_images, which holds user-uploaded photos of their own models, so a card
-- can one day have both (generic face + overlaid custom photo).
--
-- Rules:
--   * cards.face_path is a path in the card-images bucket under
--     packs/{pack_id}/... . Faces are universal: copying a card (pack import,
--     add to deck, deck duplication) copies the PATH, never the file, and
--     deleting a card never deletes its face file.
--   * Only the pack owner (or an admin) can upload/replace/delete files in
--     packs/{pack_id}/. The bucket is public, so anyone can read them.
--
-- Also adds add_cards_to_deck(), which clones a user's own templates (including
-- cards auto-imported from official packs) into a deck, carrying face_path,
-- keyword/addon links and photos.
--
-- Safe to run after migration_packs_card_images.sql and
-- migration_import_pack_fix.sql (all CREATE OR REPLACE / IF NOT EXISTS).

-- ── 1. Column ────────────────────────────────────────────────────────────────

alter table public.cards
  add column if not exists face_path text default null;

comment on column public.cards.face_path is
  'Static card face image (card-images bucket, packs/{pack_id}/...). Shared by reference; never copied or deleted with the card.';

-- ── 2. Storage policies for shared pack folders ──────────────────────────────
-- Existing policies only allow {auth.uid()}/... paths. These are additive
-- (permissive policies are OR-ed), covering packs/{pack_id}/... .

create or replace function public.can_manage_pack_files(p_pack_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.packs p
    where p.id::text = p_pack_folder
      and (
        p.owner_user_id = auth.uid()
        or exists (
          select 1 from public.user_profiles
          where id = auth.uid() and role = 'admin'
        )
      )
  );
$$;

revoke all on function public.can_manage_pack_files(text) from public;
grant  execute on function public.can_manage_pack_files(text) to authenticated;

drop policy if exists "card_faces_storage_select" on storage.objects;
create policy "card_faces_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = 'packs'
  );

drop policy if exists "card_faces_storage_insert" on storage.objects;
create policy "card_faces_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = 'packs'
    and public.can_manage_pack_files((storage.foldername(name))[2])
  );

drop policy if exists "card_faces_storage_update" on storage.objects;
create policy "card_faces_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = 'packs'
    and public.can_manage_pack_files((storage.foldername(name))[2])
  );

drop policy if exists "card_faces_storage_delete" on storage.objects;
create policy "card_faces_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = 'packs'
    and public.can_manage_pack_files((storage.foldername(name))[2])
  );

-- ── 3. import_pack: carry face_path ──────────────────────────────────────────
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
      face_path, is_template,
      pack_source_id, pack_source_snapshot
    )
    select
      null,                            -- templates have no deck
      v_user_id,
      c.game_id,
      c.name,
      c.card_type,
      c.stats,
      c.face_path,                     -- shared by reference
      true,
      c.id,
      jsonb_build_object(
        'name',      c.name,
        'card_type', c.card_type,
        'stats',     c.stats,
        'face_path', c.face_path
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

-- ── 4. copy_cards_to_pack: carry face_path ──────────────────────────────────

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
      face_path, is_template, pack_id
    ) values (
      null,
      v_user_id,
      v_src.resolved_game_id,
      coalesce(v_override_name, v_src.name),
      v_src.card_type,
      v_clean_stats,
      v_src.face_path,                 -- shared by reference
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

-- ── 5. add_cards_to_deck: clone templates into a deck ────────────────────────
-- Used by the List Builder ("add from pack"). Sources must be the caller's own
-- templates (library or imported/official-pack clones) or cards in packs they
-- own, in the same game as the deck. p_source_ids may repeat an id to add
-- several copies; order is preserved and cards are appended to the deck.
--
-- Copies: name, card_type, stats, portrait_style, face_path (by reference),
-- card_addons and card_keywords links. Sets pack_source_id to the source's own
-- pack_source_id when it has one (so deck cards trace back to the pack card),
-- otherwise to the source id.
--
-- Does NOT copy card_images: photos are per-card files that the builders delete
-- along with the card, so sharing a path would let one deletion break another.

create or replace function public.add_cards_to_deck(
  p_deck_id    uuid,
  p_source_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_deck     record;
  v_next     integer;
  v_src      record;
  v_new_id   uuid;
  v_new_ids  uuid[] := '{}';
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, user_id, game_id into v_deck
  from public.decks where id = p_deck_id;
  if v_deck.id is null or v_deck.user_id <> v_user_id then
    raise exception 'Deck not found or not owned by you' using errcode = '42501';
  end if;

  if array_length(p_source_ids, 1) is null then return v_new_ids; end if;

  if exists (
    select 1 from unnest(p_source_ids) as s(id)
    left join public.cards c on c.id = s.id
    where c.id is null
       or c.is_template is not true
       or c.game_id is distinct from v_deck.game_id
       or not (
         (c.pack_id is null and c.user_id = v_user_id)
         or exists (
           select 1 from public.packs p
           where p.id = c.pack_id and p.owner_user_id = v_user_id
         )
       )
  ) then
    raise exception 'Source card is not accessible to you or in a different game'
      using errcode = '42501';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_next
  from public.cards where deck_id = p_deck_id;

  for v_src in
    select c.*, s.ord
    from unnest(p_source_ids) with ordinality as s(id, ord)
    join public.cards c on c.id = s.id
    order by s.ord
  loop
    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats,
      portrait_style, face_path, sort_order, is_template,
      pack_source_id
    ) values (
      p_deck_id,
      v_user_id,
      null,                            -- deck cards derive game via deck
      v_src.name,
      v_src.card_type,
      v_src.stats,
      v_src.portrait_style,
      v_src.face_path,
      v_next,
      false,
      coalesce(v_src.pack_source_id, v_src.id)
    ) returning id into v_new_id;

    insert into public.card_addons (card_id, addon_id, sort_order)
    select v_new_id, ca.addon_id, ca.sort_order
    from public.card_addons ca where ca.card_id = v_src.id;

    insert into public.card_keywords (card_id, keyword_id, params, sort_order)
    select v_new_id, ck.keyword_id, ck.params, ck.sort_order
    from public.card_keywords ck where ck.card_id = v_src.id;

    v_new_ids := v_new_ids || v_new_id;
    v_next := v_next + 1;
  end loop;

  return v_new_ids;
end;
$$;

revoke all on function public.add_cards_to_deck(uuid, uuid[]) from public;
grant  execute on function public.add_cards_to_deck(uuid, uuid[]) to authenticated;