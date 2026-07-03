-- ============================================================
-- BattleCards — content packs migration
--
-- Adds the Packs feature: a publishable collection of templates,
-- addons, and keywords that other users can import into their own
-- library as a starting point for building decks.
--
-- New tables:
--   - public.packs         (the collection itself)
--   - public.pack_imports  (which users have imported which packs)
--
-- Existing tables (cards, addons, keywords) gain three nullable
-- columns to support pack ownership and clone provenance:
--   - pack_id              FK to packs. Set when this row IS a
--                          pack source row (owned by the pack
--                          rather than a private template).
--   - pack_source_id       Self-FK. Set when this row is a CLONE
--                          created on import from a pack source.
--   - pack_source_snapshot Snapshot of the source row's content
--                          at clone time. Used by a future
--                          re-import flow to do field-level merge
--                          (preserve user edits, propagate
--                          untouched fields).
--
-- A row in each table is therefore in one of three valid states,
-- enforced by check constraint:
--   - User content : pack_id null, pack_source_id null
--   - Pack source  : pack_id set,  pack_source_id null
--   - Clone        : pack_id null, pack_source_id set
--
-- Run in the Supabase SQL editor.
-- ============================================================


-- ── Tables ───────────────────────────────────────────────────

-- A publishable collection of templates, addons, and keywords.
create table if not exists public.packs (
  id            uuid        primary key default gen_random_uuid(),
  owner_user_id uuid        not null references auth.users (id) on delete cascade,
  game_id       uuid        not null references public.games (id) on delete restrict,
  name          text        not null,
  description   text,
  is_public     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Tracks which users have imported which packs. Lets the UI show
-- "installed" state and (later) detect available updates.
-- Uninstall = delete this row; the user's clones survive because
-- pack_source_id uses ON DELETE SET NULL.
create table if not exists public.pack_imports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  pack_id     uuid        not null references public.packs (id) on delete cascade,
  imported_at timestamptz not null default now(),
  unique (user_id, pack_id)
);


-- ── Columns: cards / addons / keywords ───────────────────────

alter table public.cards
  add column if not exists pack_id              uuid references public.packs (id) on delete cascade,
  add column if not exists pack_source_id       uuid references public.cards (id) on delete set null,
  add column if not exists pack_source_snapshot jsonb;

alter table public.addons
  add column if not exists pack_id              uuid references public.packs (id) on delete cascade,
  add column if not exists pack_source_id       uuid references public.addons (id) on delete set null,
  add column if not exists pack_source_snapshot jsonb;

alter table public.keywords
  add column if not exists pack_id              uuid references public.packs (id) on delete cascade,
  add column if not exists pack_source_id       uuid references public.keywords (id) on delete set null,
  add column if not exists pack_source_snapshot jsonb;


-- ── Check constraints: three valid pack-state rows ───────────

-- A row is either user-owned (no pack columns), a pack source
-- (pack_id set), or a clone (pack_source_id set). Never both.

alter table public.cards
  drop constraint if exists cards_pack_state;
alter table public.cards
  add  constraint cards_pack_state check (
    (pack_id is null and pack_source_id is null) or
    (pack_id is not null and pack_source_id is null) or
    (pack_id is null and pack_source_id is not null)
  );

alter table public.addons
  drop constraint if exists addons_pack_state;
alter table public.addons
  add  constraint addons_pack_state check (
    (pack_id is null and pack_source_id is null) or
    (pack_id is not null and pack_source_id is null) or
    (pack_id is null and pack_source_id is not null)
  );

alter table public.keywords
  drop constraint if exists keywords_pack_state;
alter table public.keywords
  add  constraint keywords_pack_state check (
    (pack_id is null and pack_source_id is null) or
    (pack_id is not null and pack_source_id is null) or
    (pack_id is null and pack_source_id is not null)
  );


-- ── Keyword uniqueness — split by ownership scope ────────────
--
-- The existing unique (user_id, game_id, name) would prevent a
-- pack owner from having a personal keyword and a pack keyword
-- with the same name (both rows share user_id). It would also
-- prevent two of their own packs from sharing a keyword name,
-- and would block clones imported from different packs.
--
-- Replace with partial indexes:
--   - personal user keywords: unique per (user, game, name)
--   - pack source keywords:   unique per (pack, game, name)
--   - clones:                 no uniqueness (importing two packs
--                             that share a keyword name is fine;
--                             the UI disambiguates by pack)

alter table public.keywords
  drop constraint if exists keywords_user_id_game_id_name_key;

create unique index if not exists keywords_user_game_name_personal_uniq
  on public.keywords (user_id, game_id, name)
  where pack_id is null and pack_source_id is null;

create unique index if not exists keywords_pack_game_name_uniq
  on public.keywords (pack_id, game_id, name)
  where pack_id is not null;


-- ── Indexes for pack lookups ─────────────────────────────────

-- Fast "list all rows in pack X" — used by import and authoring.
create index if not exists cards_pack_id_idx
  on public.cards (pack_id) where pack_id is not null;
create index if not exists addons_pack_id_idx
  on public.addons (pack_id) where pack_id is not null;
create index if not exists keywords_pack_id_idx
  on public.keywords (pack_id) where pack_id is not null;

-- Fast "find all clones of source Y" — used by re-import / update
-- detection later. Also useful for "which packs has this user
-- imported content from" queries.
create index if not exists cards_pack_source_id_idx
  on public.cards (pack_source_id) where pack_source_id is not null;
create index if not exists addons_pack_source_id_idx
  on public.addons (pack_source_id) where pack_source_id is not null;
create index if not exists keywords_pack_source_id_idx
  on public.keywords (pack_source_id) where pack_source_id is not null;

create index if not exists packs_owner_user_id_idx
  on public.packs (owner_user_id);
create index if not exists packs_game_public_idx
  on public.packs (game_id) where is_public = true;
create index if not exists pack_imports_user_id_idx
  on public.pack_imports (user_id);


-- ── Trigger: auto-fill cards.user_id from pack owner ─────────
--
-- Existing trigger fills user_id from the parent deck for deck
-- cards. Pack source cards don't have a deck — fill from the
-- pack's owner instead.

create or replace function public.cards_fill_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    if new.deck_id is not null then
      select d.user_id into new.user_id
        from public.decks d where d.id = new.deck_id;
    elsif new.pack_id is not null then
      select p.owner_user_id into new.user_id
        from public.packs p where p.id = new.pack_id;
    end if;
  end if;
  return new;
end;
$$;


-- ── Row Level Security ────────────────────────────────────────

alter table public.packs        enable row level security;
alter table public.pack_imports enable row level security;


-- packs: anyone authed can read public packs or packs they own.
-- Writes are restricted to the owner.

create policy "packs_select" on public.packs
  for select to authenticated
  using (is_public = true or owner_user_id = auth.uid());

create policy "packs_insert" on public.packs
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "packs_update" on public.packs
  for update to authenticated
  using      (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "packs_delete" on public.packs
  for delete to authenticated
  using (owner_user_id = auth.uid());


-- pack_imports: users see and manage only their own imports.

create policy "pack_imports_select" on public.pack_imports
  for select to authenticated
  using (user_id = auth.uid());

create policy "pack_imports_insert" on public.pack_imports
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "pack_imports_delete" on public.pack_imports
  for delete to authenticated
  using (user_id = auth.uid());


-- ── RLS rewrites: cards / addons / keywords ──────────────────
--
-- Existing policies covered user-owned rows only. Extend each
-- with a clause that allows reading pack source rows from a
-- pack the user can see, and restricts writing pack source rows
-- to the pack's owner.

-- cards ───────────────────────────────────────────────────────

drop policy if exists "cards_select" on public.cards;
create policy "cards_select" on public.cards
  for select to authenticated
  using (
    -- Deck cards owned via the parent deck (user content).
    (deck_id is not null and exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    ))
    or
    -- Personal templates and imported clones (both user-owned).
    (is_template = true and pack_id is null and user_id = auth.uid())
    or
    -- Pack source rows from packs the user can read.
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = cards.pack_id
        and (packs.is_public = true or packs.owner_user_id = auth.uid())
    ))
  );

drop policy if exists "cards_insert" on public.cards;
create policy "cards_insert" on public.cards
  for insert to authenticated
  with check (
    (deck_id is not null and exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = cards.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );

drop policy if exists "cards_update" on public.cards;
create policy "cards_update" on public.cards
  for update to authenticated
  using (
    (deck_id is not null and exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = cards.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  )
  with check (
    (deck_id is not null and exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = cards.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );

drop policy if exists "cards_delete" on public.cards;
create policy "cards_delete" on public.cards
  for delete to authenticated
  using (
    (deck_id is not null and exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    ))
    or
    (is_template = true and pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = cards.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );


-- addons ──────────────────────────────────────────────────────

drop policy if exists "addons_select" on public.addons;
create policy "addons_select" on public.addons
  for select to authenticated
  using (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = addons.pack_id
        and (packs.is_public = true or packs.owner_user_id = auth.uid())
    ))
  );

drop policy if exists "addons_insert" on public.addons;
create policy "addons_insert" on public.addons
  for insert to authenticated
  with check (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = addons.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );

drop policy if exists "addons_update" on public.addons;
create policy "addons_update" on public.addons
  for update to authenticated
  using (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = addons.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  )
  with check (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = addons.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );

drop policy if exists "addons_delete" on public.addons;
create policy "addons_delete" on public.addons
  for delete to authenticated
  using (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = addons.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );


-- keywords ────────────────────────────────────────────────────

drop policy if exists "keywords_select" on public.keywords;
create policy "keywords_select" on public.keywords
  for select to authenticated
  using (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = keywords.pack_id
        and (packs.is_public = true or packs.owner_user_id = auth.uid())
    ))
  );

drop policy if exists "keywords_insert" on public.keywords;
create policy "keywords_insert" on public.keywords
  for insert to authenticated
  with check (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = keywords.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );

drop policy if exists "keywords_update" on public.keywords;
create policy "keywords_update" on public.keywords
  for update to authenticated
  using (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = keywords.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  )
  with check (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = keywords.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );

drop policy if exists "keywords_delete" on public.keywords;
create policy "keywords_delete" on public.keywords
  for delete to authenticated
  using (
    (pack_id is null and user_id = auth.uid())
    or
    (pack_id is not null and exists (
      select 1 from public.packs
      where packs.id = keywords.pack_id
        and packs.owner_user_id = auth.uid()
    ))
  );
