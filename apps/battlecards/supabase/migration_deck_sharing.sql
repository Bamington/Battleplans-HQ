-- ============================================================
-- BattleCards — deck sharing
--
-- Lets a user share one of their decks as an unguessable link.
-- Anyone holding the link — signed in or not — can view the deck
-- read-only, and a signed-in visitor can copy it into their own
-- decks.
--
-- HOW THE READ PATH WORKS
-- Every existing screen loads a deck through ordinary PostgREST
-- queries (see PrintDeck.tsx — cards joined to their addons,
-- keywords and images, with per-game mapping). Rather than
-- duplicate all of that behind a bespoke payload function, the
-- share link simply widens RLS for the one deck the caller can
-- prove they know the token for: the client sends the token as an
-- `x-share-token` request header, and every policy below scopes
-- to the deck that token unlocks via current_share_deck_id().
--
-- WHY A HEADER AND NOT `share_token is not null`
-- A policy of the form "readable when the deck is shared" would
-- let anyone list every shared deck in the database — the link
-- would stop being unguessable the moment one person shared. The
-- header ties each request to a single deck the caller already
-- knows, so there is nothing to enumerate.
--
-- The new policies are additive and permissive; they only ever
-- grant access to rows hanging off the unlocked deck, so existing
-- owner-scoped behaviour is untouched.
--
-- Run in the Supabase SQL editor after migration_custom_tokens.sql.
-- ============================================================


-- ── 1. Share columns on decks ───────────────────────────────────────────────
-- share_token null = not shared. Revoking sets it back to null, which kills
-- the outstanding link immediately; re-sharing mints a fresh token.

alter table public.decks
  add column if not exists share_token text unique,
  add column if not exists shared_at   timestamptz;

comment on column public.decks.share_token is
  'Unguessable token for the public share link, or null when the deck is not shared. Revoking nulls it, invalidating any link already handed out.';


-- ── 2. Mint / revoke a share token ──────────────────────────────────────────
-- SECURITY DEFINER so the uniqueness probe can see every deck, not just the
-- caller's; ownership is enforced explicitly below. Sharing is idempotent —
-- calling it on an already-shared deck returns the existing token rather than
-- rotating it, so a user can reopen the share dialog without breaking a link
-- they have already sent someone.

create or replace function public.share_deck(p_deck_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner   uuid;
  v_token   text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select user_id, share_token into v_owner, v_token
  from public.decks
  where id = p_deck_id;

  if v_owner is null or v_owner <> v_user_id then
    raise exception 'Deck not found or not yours' using errcode = '42501';
  end if;

  if v_token is not null then
    return v_token;
  end if;

  -- 22 hex chars ≈ 88 bits. The loop is belt-and-braces; a collision here is
  -- not a realistic event, and the unique constraint is the real guarantee.
  loop
    v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 22);
    exit when not exists (select 1 from public.decks where share_token = v_token);
  end loop;

  update public.decks
     set share_token = v_token,
         shared_at   = now()
   where id = p_deck_id;

  return v_token;
end;
$$;

create or replace function public.unshare_deck(p_deck_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner   uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select user_id into v_owner from public.decks where id = p_deck_id;

  if v_owner is null or v_owner <> v_user_id then
    raise exception 'Deck not found or not yours' using errcode = '42501';
  end if;

  update public.decks
     set share_token = null,
         shared_at   = null
   where id = p_deck_id;
end;
$$;

revoke all on function public.share_deck(uuid)   from public;
revoke all on function public.unshare_deck(uuid) from public;
grant  execute on function public.share_deck(uuid)   to authenticated;
grant  execute on function public.unshare_deck(uuid) to authenticated;


-- ── 3. The deck unlocked by this request's share token ──────────────────────
-- Reads the `x-share-token` header PostgREST exposes on request.headers.
-- Returns null when the header is absent, empty, or matches no shared deck —
-- so every policy built on it is closed by default.
--
-- SECURITY DEFINER because it has to look past the caller's own RLS on decks
-- to resolve a deck belonging to someone else. It returns only an id, and
-- only for a deck whose owner has deliberately shared it.

create or replace function public.current_share_deck_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.decks d
  where d.share_token is not null
    and d.share_token = nullif(
      current_setting('request.headers', true)::json ->> 'x-share-token',
      ''
    )
  limit 1;
$$;

comment on function public.current_share_deck_id() is
  'The single deck unlocked by the x-share-token header on this request, or null. Every share-scoped RLS policy funnels through this.';

revoke all on function public.current_share_deck_id() from public;
grant  execute on function public.current_share_deck_id() to anon, authenticated;


-- ── 4. Share-scoped read policies ───────────────────────────────────────────
-- One permissive SELECT policy per table involved in rendering a deck. Each
-- grants to anon and authenticated alike: a signed-in visitor opening someone
-- else's link is `authenticated`, and their own owner-scoped policies would
-- not cover a deck they don't own.

-- The deck itself.
drop policy if exists "decks_select_shared" on public.decks;
create policy "decks_select_shared" on public.decks
  for select to anon, authenticated
  using (id = public.current_share_deck_id());

-- Cards in the deck.
drop policy if exists "cards_select_shared" on public.cards;
create policy "cards_select_shared" on public.cards
  for select to anon, authenticated
  using (deck_id = public.current_share_deck_id());

-- Card portraits / avatars.
drop policy if exists "card_images_select_shared" on public.card_images;
create policy "card_images_select_shared" on public.card_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_images.card_id
        and c.deck_id = public.current_share_deck_id()
    )
  );

-- Addons attached to those cards, and the join rows themselves.
drop policy if exists "card_addons_select_shared" on public.card_addons;
create policy "card_addons_select_shared" on public.card_addons
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_addons.card_id
        and c.deck_id = public.current_share_deck_id()
    )
  );

drop policy if exists "addons_select_shared" on public.addons;
create policy "addons_select_shared" on public.addons
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.card_addons ca
      join public.cards c on c.id = ca.card_id
      where ca.addon_id = addons.id
        and c.deck_id = public.current_share_deck_id()
    )
  );

-- Keywords, reachable either directly from a card or via one of its addons.
drop policy if exists "card_keywords_select_shared" on public.card_keywords;
create policy "card_keywords_select_shared" on public.card_keywords
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_keywords.card_id
        and c.deck_id = public.current_share_deck_id()
    )
  );

drop policy if exists "addon_keywords_select_shared" on public.addon_keywords;
create policy "addon_keywords_select_shared" on public.addon_keywords
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.card_addons ca
      join public.cards c on c.id = ca.card_id
      where ca.addon_id = addon_keywords.addon_id
        and c.deck_id = public.current_share_deck_id()
    )
  );

drop policy if exists "keywords_select_shared" on public.keywords;
create policy "keywords_select_shared" on public.keywords
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.card_keywords ck
      join public.cards c on c.id = ck.card_id
      where ck.keyword_id = keywords.id
        and c.deck_id = public.current_share_deck_id()
    )
    or exists (
      select 1
      from public.addon_keywords ak
      join public.card_addons ca on ca.addon_id = ak.addon_id
      join public.cards c on c.id = ca.card_id
      where ak.keyword_id = keywords.id
        and c.deck_id = public.current_share_deck_id()
    )
  );

-- Rules assigned to the deck.
drop policy if exists "deck_rules_select_shared" on public.deck_rules;
create policy "deck_rules_select_shared" on public.deck_rules
  for select to anon, authenticated
  using (deck_id = public.current_share_deck_id());

drop policy if exists "rules_select_shared" on public.rules;
create policy "rules_select_shared" on public.rules
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.deck_rules dr
      where dr.rule_id = rules.id
        and dr.deck_id = public.current_share_deck_id()
    )
  );

-- Deck-scoped custom tokens, plus the game-wide ones (deck_id is null) the
-- card renderers need alongside them.
drop policy if exists "token_definitions_select_shared" on public.token_definitions;
create policy "token_definitions_select_shared" on public.token_definitions
  for select to anon, authenticated
  using (
    public.current_share_deck_id() is not null
    and (deck_id is null or deck_id = public.current_share_deck_id())
  );

-- Reference data the renderers join to. Gated on the caller holding a valid
-- token so an anonymous visitor without one still sees nothing.
drop policy if exists "games_select_shared" on public.games;
create policy "games_select_shared" on public.games
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = public.current_share_deck_id()
        and d.game_id = games.id
    )
  );

drop policy if exists "addon_types_select_shared" on public.addon_types;
create policy "addon_types_select_shared" on public.addon_types
  for select to anon, authenticated
  using (public.current_share_deck_id() is not null);

-- The sharer's public profile — display name and avatar only, and only for
-- the owner of the deck the token unlocks. profiles is otherwise closed to
-- anonymous callers entirely.
drop policy if exists "profiles_select_shared" on public.profiles;
create policy "profiles_select_shared" on public.profiles
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = public.current_share_deck_id()
        and d.user_id = profiles.id
    )
  );


-- ── 5. Card images in storage ───────────────────────────────────────────────
-- Objects live at {user_id}/{card_id}/{filename}. The existing select policy
-- is scoped to the caller's own prefix, which means storage.copy() — how a
-- copy clones portraits — fails across users. This grants read on exactly the
-- objects belonging to cards in the unlocked deck.

drop policy if exists "card_images_storage_select_shared" on storage.objects;
create policy "card_images_storage_select_shared"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'card-images'
    and exists (
      select 1 from public.cards c
      where c.id::text = (storage.foldername(name))[2]
        and c.deck_id = public.current_share_deck_id()
    )
  );


-- ── 6. Copy a shared deck into the caller's own decks ───────────────────────
-- A deep clone, modelled on import_pack (migration_packs_import.sql), but
-- landing in a new deck rather than in the user's template library.
--
-- WHY SECURITY DEFINER
-- Same reasoning as import_pack: it reads another user's rows and writes rows
-- whose INSERT policies are owner-scoped. Access is enforced explicitly — the
-- caller must be signed in and must present a token that resolves to a shared
-- deck. Note it takes the token, not a deck id, so it cannot be pointed at a
-- deck the caller was never given a link to.
--
-- HOW ROWS ARE CLONED
-- Each clone is built with jsonb_populate_record from the source row, naming
-- the columns it STRIPS (identity, ownership, pack provenance) rather than the
-- ones it keeps. cards and token_definitions have each gained columns over
-- several migrations, and an explicit keep-list silently stops copying
-- whatever gets added next.
--
-- KEYWORDS AND RULES ARE DEDUPED, NOT BLIND-CLONED
-- Unlike pack sources, keywords carry unique (user_id, game_id, name) and
-- rules carry unique (user_id, game_id, title). A straight insert would fail
-- for anyone who already has a keyword of that name — likely, since keywords
-- are mostly the game's own vocabulary. So the caller's existing row is reused
-- where there is one, and only genuinely new ones get created. Addons are
-- cloned outright (no unique constraint, and each deck wants its own instances
-- so editing a copy never reaches back into the original).
--
-- Card portraits are NOT handled here — storage objects can't be copied from
-- SQL. The function returns the source paths alongside the new card ids and
-- the client copies them, mirroring duplicateDeck.ts.

create or replace function public.copy_shared_deck(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_deck        record;
  v_new_deck_id uuid;
  v_keyword_map jsonb := '{}'::jsonb;
  v_addon_map   jsonb := '{}'::jsonb;
  v_card_map    jsonb := '{}'::jsonb;
  v_rule_map    jsonb := '{}'::jsonb;
  v_images      jsonb;
  v_target      uuid;
  r             record;
begin
  -- ── Validation ────────────────────────────────────────────

  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, user_id, game_id, name
    into v_deck
  from public.decks
  where share_token is not null
    and share_token = p_token;

  if v_deck.id is null then
    raise exception 'Deck not found or no longer shared' using errcode = '42501';
  end if;

  -- ── New deck ──────────────────────────────────────────────
  -- Copying your own shared deck is allowed; it just behaves like a duplicate.

  insert into public.decks (user_id, game_id, name)
  values (v_user_id, v_deck.game_id, v_deck.name)
  returning id into v_new_deck_id;

  -- ── Keywords — reuse the caller's where the name already exists ───────────

  for r in
    select k.*
    from public.keywords k
    where k.id in (
      select ck.keyword_id
      from public.card_keywords ck
      join public.cards c on c.id = ck.card_id
      where c.deck_id = v_deck.id
      union
      select ak.keyword_id
      from public.addon_keywords ak
      join public.card_addons ca on ca.addon_id = ak.addon_id
      join public.cards c on c.id = ca.card_id
      where c.deck_id = v_deck.id
    )
  loop
    select id into v_target
    from public.keywords
    where user_id = v_user_id
      and game_id = r.game_id
      and name    = r.name;

    if v_target is null then
      insert into public.keywords
      select (jsonb_populate_record(
                null::public.keywords,
                to_jsonb(r)
                  - 'pack_id' - 'pack_source_id' - 'pack_source_snapshot'
                  || jsonb_build_object(
                       'id',         gen_random_uuid(),
                       'created_at', now(),
                       'user_id',    v_user_id
                     )
             )).*
      returning id into v_target;
    end if;

    v_keyword_map := v_keyword_map || jsonb_build_object(r.id::text, v_target::text);
  end loop;

  -- ── Addons — cloned outright, parent_addon_id deferred ────────────────────

  for r in
    select a.*
    from public.addons a
    where a.id in (
      select ca.addon_id
      from public.card_addons ca
      join public.cards c on c.id = ca.card_id
      where c.deck_id = v_deck.id
    )
  loop
    insert into public.addons
    select (jsonb_populate_record(
              null::public.addons,
              to_jsonb(r)
                - 'pack_id' - 'pack_source_id' - 'pack_source_snapshot'
                || jsonb_build_object(
                     'id',              gen_random_uuid(),
                     'created_at',      now(),
                     'user_id',         v_user_id,
                     'parent_addon_id', null   -- remapped in the pass below
                   )
           )).*
    returning id into v_target;

    v_addon_map := v_addon_map || jsonb_build_object(r.id::text, v_target::text);
  end loop;

  -- Pass two: point cloned addons at their cloned parents. A parent outside
  -- the deck's addon set stays null rather than leaving the copy pointing at a
  -- row the caller doesn't own.
  for r in
    select a.id, a.parent_addon_id
    from public.addons a
    where a.parent_addon_id is not null
      and v_addon_map ? a.id::text
      and v_addon_map ? a.parent_addon_id::text
  loop
    update public.addons
       set parent_addon_id = (v_addon_map ->> r.parent_addon_id::text)::uuid
     where id = (v_addon_map ->> r.id::text)::uuid;
  end loop;

  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params,
    ak.sort_order
  from public.addon_keywords ak
  where v_addon_map   ? ak.addon_id::text
    and v_keyword_map ? ak.keyword_id::text;

  -- ── Cards ─────────────────────────────────────────────────────────────────

  for r in
    select c.*
    from public.cards c
    where c.deck_id = v_deck.id
  loop
    insert into public.cards
    select (jsonb_populate_record(
              null::public.cards,
              to_jsonb(r)
                - 'pack_id' - 'pack_source_id' - 'pack_source_snapshot'
                || jsonb_build_object(
                     'id',          gen_random_uuid(),
                     'created_at',  now(),
                     'deck_id',     v_new_deck_id,
                     'user_id',     v_user_id,
                     'is_template', false
                   )
           )).*
    returning id into v_target;

    v_card_map := v_card_map || jsonb_build_object(r.id::text, v_target::text);
  end loop;

  -- ── Card joins ────────────────────────────────────────────────────────────

  insert into public.card_addons (card_id, addon_id, sort_order)
  select
    (v_card_map  ->> ca.card_id::text)::uuid,
    (v_addon_map ->> ca.addon_id::text)::uuid,
    ca.sort_order
  from public.card_addons ca
  where v_card_map  ? ca.card_id::text
    and v_addon_map ? ca.addon_id::text;

  insert into public.card_keywords (card_id, keyword_id, params, sort_order)
  select
    (v_card_map    ->> ck.card_id::text)::uuid,
    (v_keyword_map ->> ck.keyword_id::text)::uuid,
    ck.params,
    ck.sort_order
  from public.card_keywords ck
  where v_card_map    ? ck.card_id::text
    and v_keyword_map ? ck.keyword_id::text;

  -- ── Rules — reuse the caller's where the title already exists ─────────────

  for r in
    select ru.*
    from public.rules ru
    where ru.id in (
      select dr.rule_id from public.deck_rules dr where dr.deck_id = v_deck.id
    )
  loop
    select id into v_target
    from public.rules
    where user_id = v_user_id
      and game_id = r.game_id
      and title   = r.title;

    if v_target is null then
      insert into public.rules
      select (jsonb_populate_record(
                null::public.rules,
                to_jsonb(r) || jsonb_build_object(
                  'id',         gen_random_uuid(),
                  'created_at', now(),
                  'user_id',    v_user_id
                )
             )).*
      returning id into v_target;
    end if;

    v_rule_map := v_rule_map || jsonb_build_object(r.id::text, v_target::text);
  end loop;

  insert into public.deck_rules (deck_id, rule_id, sort_order)
  select
    v_new_deck_id,
    (v_rule_map ->> dr.rule_id::text)::uuid,
    dr.sort_order
  from public.deck_rules dr
  where dr.deck_id = v_deck.id
    and v_rule_map ? dr.rule_id::text;

  -- ── Deck-scoped custom tokens ─────────────────────────────────────────────

  for r in
    select t.* from public.token_definitions t where t.deck_id = v_deck.id
  loop
    insert into public.token_definitions
    select (jsonb_populate_record(
              null::public.token_definitions,
              to_jsonb(r) || jsonb_build_object(
                'id',         gen_random_uuid(),
                'created_at', now(),
                'deck_id',    v_new_deck_id
              )
           )).*;
  end loop;

  -- ── Portraits for the client to copy ──────────────────────────────────────
  -- storage.copy() can't be reached from SQL, so the paths go back to the
  -- caller and the client clones the objects into its own prefix.

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'source_path', ci.file_path,
               'card_id',     (v_card_map ->> ci.card_id::text),
               'image_type',  ci.image_type,
               'sort_order',  ci.sort_order
             )
           ),
           '[]'::jsonb
         )
    into v_images
  from public.card_images ci
  join public.cards c on c.id = ci.card_id
  where c.deck_id = v_deck.id
    and v_card_map ? ci.card_id::text;

  return jsonb_build_object(
    'deck_id', v_new_deck_id,
    'images',  v_images
  );
end;
$$;

revoke all on function public.copy_shared_deck(text) from public;
grant  execute on function public.copy_shared_deck(text) to authenticated;
