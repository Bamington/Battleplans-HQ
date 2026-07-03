-- ============================================================
-- BattleCards — copy RPCs return uuid[] instead of integer
--
-- copy_keywords_to_pack and copy_addons_to_pack previously
-- returned an integer count. They now return uuid[] — the
-- pack-scoped IDs of all resulting rows (newly inserted AND
-- deduped-to-existing). Callers that only need a count can
-- use array_length(result, 1); callers that need the IDs
-- (e.g. attaching copied items to a specific card) now have
-- them directly.
--
-- copy_cards_to_pack is unchanged (still returns integer).
--
-- Run in the Supabase SQL editor after migration_packs_addon_dedup.sql.
-- ============================================================


-- ── copy_keywords_to_pack ───────────────────────────────────────────

create or replace function public.copy_keywords_to_pack(
  p_target_pack_id uuid,
  p_source_ids     uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_target     record;
  v_src        record;
  v_existing   uuid;
  v_new_id     uuid;
  v_result_ids uuid[] := '{}'::uuid[];
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, game_id into v_target
  from public.packs where id = p_target_pack_id;
  if v_target.id is null or v_target.owner_user_id <> v_user_id then
    raise exception 'Target pack not found or not owned by you' using errcode = '42501';
  end if;

  if array_length(p_source_ids, 1) is null then return v_result_ids; end if;

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
      ) returning id into v_new_id;
      v_result_ids := array_append(v_result_ids, v_new_id);
    else
      v_result_ids := array_append(v_result_ids, v_existing);
    end if;
  end loop;

  return v_result_ids;
end;
$$;

revoke all on function public.copy_keywords_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_keywords_to_pack(uuid, uuid[]) to authenticated;


-- ── copy_addons_to_pack ─────────────────────────────────────────────

create or replace function public.copy_addons_to_pack(
  p_target_pack_id uuid,
  p_source_ids     uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_target        record;
  v_keyword_map   jsonb := '{}'::jsonb;
  v_addon_map     jsonb := '{}'::jsonb;
  v_new_addon_ids jsonb := '{}'::jsonb;
  v_src           record;
  v_existing      uuid;
  v_new_id        uuid;
  v_result_ids    uuid[] := '{}'::uuid[];
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, game_id into v_target
  from public.packs where id = p_target_pack_id;
  if v_target.id is null or v_target.owner_user_id <> v_user_id then
    raise exception 'Target pack not found or not owned by you' using errcode = '42501';
  end if;

  if array_length(p_source_ids, 1) is null then return v_result_ids; end if;

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

  -- Dedup keywords by name (for addon_keywords joins).
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
    end if;

    v_addon_map  := v_addon_map  || jsonb_build_object(v_src.id::text, v_new_id::text);
    v_result_ids := array_append(v_result_ids, v_new_id);
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

  -- addon_keywords only for newly-inserted addons.
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  where ak.addon_id = any(p_source_ids)
    and v_new_addon_ids ? (v_addon_map ->> ak.addon_id::text)
  on conflict (addon_id, keyword_id) do nothing;

  return v_result_ids;
end;
$$;

revoke all on function public.copy_addons_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_addons_to_pack(uuid, uuid[]) to authenticated;
