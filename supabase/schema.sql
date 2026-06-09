-- ============================================================
-- BattleCards — initial schema
-- Paste this into the Supabase SQL editor and run it.
-- ============================================================


-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.games (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  -- Array of { key, label, type } objects describing each stat field for this game.
  -- type is one of: "text" | "number"
  stat_schema jsonb       not null default '[]'::jsonb,
  -- [width_mm, height_mm] — card dimensions for printing (no bleed)
  print_size  jsonb       not null default '[]'::jsonb,
  -- [width_mm, height_mm] — card dimensions for printing (with bleed)
  bleed_size  jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- Defines a category of addon for a specific game (e.g. "Skills" for Blood Bowl).
-- Admin-managed — same access pattern as public.games.
create table public.addon_types (
  id          uuid        primary key default gen_random_uuid(),
  game_id     uuid        not null references public.games (id) on delete cascade,
  name        text        not null,
  slug        text        not null,
  -- Array of { key, label, type } objects describing each stat field for this addon type.
  stat_schema jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (game_id, slug)
);

-- A publishable collection of templates, addons, and keywords. Other
-- users can import a pack to deep-clone its contents into their own
-- library as a starting point for building decks.
create table public.packs (
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
-- "installed" state and (later) detect available updates. Uninstall
-- = delete this row; the user's clones survive because pack_source_id
-- uses ON DELETE SET NULL.
create table public.pack_imports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  pack_id     uuid        not null references public.packs (id) on delete cascade,
  imported_at timestamptz not null default now(),
  unique (user_id, pack_id)
);

create table public.decks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  game_id    uuid        not null references public.games (id) on delete restrict,
  name       text        not null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id          uuid        primary key default gen_random_uuid(),
  -- Nullable: templates (is_template = true) have no deck.
  deck_id     uuid        references public.decks (id) on delete cascade,
  -- Always populated. Owner of the card or template.
  -- Auto-filled by trigger from decks.user_id for deck cards, or from
  -- packs.owner_user_id for pack source cards.
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- Nullable for deck cards (derive via deck); required for templates.
  game_id     uuid        references public.games (id) on delete restrict,
  name        text        not null,
  -- Discriminator for the card layout. 'operative' is the default game-piece
  -- card; 'rule' is a faction-rule / ploy / mission style card.
  card_type   text        not null default 'operative'
                              check (card_type in ('operative', 'rule')),
  -- Game-specific stats stored as a flexible JSON object.
  -- Shape is defined by the parent game's stat_schema.
  stats       jsonb       not null default '{}'::jsonb,
  is_template boolean     not null default false,
  -- Set when this row IS a pack source (a template living inside a pack).
  pack_id     uuid        references public.packs (id) on delete cascade,
  -- Set when this row is a CLONE created on import from a pack source.
  -- Points to the original pack row for future update detection.
  pack_source_id        uuid  references public.cards (id) on delete set null,
  -- Snapshot of the source row's content at clone time. Used by a future
  -- re-import flow to do field-level merge (preserve user edits, propagate
  -- untouched fields).
  pack_source_snapshot  jsonb,
  created_at  timestamptz not null default now(),
  constraint cards_template_or_deck check (
    (is_template = false and deck_id is not null) or
    (is_template = true  and deck_id is null and game_id is not null)
  ),
  -- Three valid pack-state rows: user content / pack source / clone.
  constraint cards_pack_state check (
    (pack_id is null     and pack_source_id is null) or
    (pack_id is not null and pack_source_id is null) or
    (pack_id is null     and pack_source_id is not null)
  )
);

-- A user-created addon instance (e.g. a specific skill or weapon).
create table public.addons (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  addon_type_id uuid        not null references public.addon_types (id) on delete restrict,
  -- Denormalised from addon_types.game_id for fast per-game queries.
  -- Auto-populated by trigger — do not set manually.
  game_id       uuid        not null references public.games (id) on delete restrict,
  name          text        not null,
  description   text,
  -- Game-specific stats stored as a flexible JSON object.
  -- Shape is defined by the parent addon_type's stat_schema.
  stats         jsonb       not null default '{}'::jsonb,
  -- Pack ownership / clone provenance — see cards table for the model.
  pack_id              uuid  references public.packs  (id) on delete cascade,
  pack_source_id       uuid  references public.addons (id) on delete set null,
  pack_source_snapshot jsonb,
  created_at    timestamptz not null default now(),
  -- Three valid pack-state rows: user content / pack source / clone.
  constraint addons_pack_state check (
    (pack_id is null     and pack_source_id is null) or
    (pack_id is not null and pack_source_id is null) or
    (pack_id is null     and pack_source_id is not null)
  )
);

-- Join table — links cards to addons (many-to-many).
create table public.card_addons (
  id         uuid        primary key default gen_random_uuid(),
  card_id    uuid        not null references public.cards (id) on delete cascade,
  addon_id   uuid        not null references public.addons (id) on delete cascade,
  -- Nullable for now; populated when display order matters.
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (card_id, addon_id)
);


-- ── Trigger: auto-populate addons.game_id ────────────────────────────────────

create or replace function public.set_addon_game_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select game_id into new.game_id
  from public.addon_types
  where id = new.addon_type_id;
  return new;
end;
$$;

-- Auto-populate cards.user_id from the parent deck (deck cards) or from
-- the parent pack's owner (pack source cards). Personal templates must
-- pass user_id explicitly — they have neither a deck nor a pack.
create or replace function public.cards_fill_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    if new.deck_id is not null then
      select d.user_id into new.user_id
        from public.decks d
       where d.id = new.deck_id;
    elsif new.pack_id is not null then
      select p.owner_user_id into new.user_id
        from public.packs p
       where p.id = new.pack_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger cards_fill_user_id
  before insert on public.cards
  for each row execute procedure public.cards_fill_user_id();

-- Fast lookup of a user's templates for a given game.
create index if not exists cards_templates_user_game_idx
  on public.cards (user_id, game_id)
  where is_template = true;

-- Pack lookups: "list all rows in pack X" — used by import and authoring.
create index if not exists cards_pack_id_idx
  on public.cards (pack_id) where pack_id is not null;
create index if not exists addons_pack_id_idx
  on public.addons (pack_id) where pack_id is not null;

-- Clone provenance: "find all clones of source Y" — used by re-import /
-- update detection later.
create index if not exists cards_pack_source_id_idx
  on public.cards (pack_source_id) where pack_source_id is not null;
create index if not exists addons_pack_source_id_idx
  on public.addons (pack_source_id) where pack_source_id is not null;

create index if not exists packs_owner_user_id_idx
  on public.packs (owner_user_id);
create index if not exists packs_game_public_idx
  on public.packs (game_id) where is_public = true;
create index if not exists pack_imports_user_id_idx
  on public.pack_imports (user_id);

create trigger addon_set_game_id
  before insert or update of addon_type_id on public.addons
  for each row execute procedure public.set_addon_game_id();


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.games        enable row level security;
alter table public.addon_types  enable row level security;
alter table public.packs        enable row level security;
alter table public.pack_imports enable row level security;
alter table public.decks        enable row level security;
alter table public.cards        enable row level security;
alter table public.addons       enable row level security;
alter table public.card_addons  enable row level security;

-- games: any authenticated user can read; writes require the service role (admin only)
create policy "games_select" on public.games
  for select to authenticated using (true);

-- addon_types: any authenticated user can read; writes require the service role
create policy "addon_types_select" on public.addon_types
  for select to authenticated using (true);

-- decks: users manage only their own rows
create policy "decks_select" on public.decks
  for select to authenticated
  using (auth.uid() = user_id);

create policy "decks_insert" on public.decks
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "decks_update" on public.decks
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "decks_delete" on public.decks
  for delete to authenticated
  using (auth.uid() = user_id);

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

-- cards: users manage cards that belong to their own decks (deck cards),
-- personal templates and imported clones (both user-owned), and pack
-- source rows from packs they can read (writes restricted to pack owner).
create policy "cards_select" on public.cards
  for select to authenticated
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
        and (packs.is_public = true or packs.owner_user_id = auth.uid())
    ))
  );

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

-- addons: users manage their own rows; can also read addons from packs
-- they can see, and pack owners can write rows in their own packs.
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

-- card_addons: users manage join rows for cards in their own decks
create policy "card_addons_select" on public.card_addons
  for select to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_addons_insert" on public.card_addons
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_addons_update" on public.card_addons
  for update to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_addons_delete" on public.card_addons
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_addons.card_id
        and decks.user_id = auth.uid()
    )
  );


-- ── Keywords ─────────────────────────────────────────────────────────────────

-- Keyword definitions — user-owned, scoped to a game. May also be owned
-- by a pack (pack_id set) or be a clone imported from a pack source
-- (pack_source_id set). See cards table for the ownership model.
create table public.keywords (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  game_id       uuid        not null references public.games (id) on delete cascade,
  name          text        not null,
  description   text,
  -- Array of { key, label, type } objects describing the parameters this keyword
  -- accepts (e.g. X in "Weight of Fire (X)").  Empty array = no params.
  params_schema jsonb       not null default '[]'::jsonb,
  -- Arbitrary game-specific metadata that lives on the keyword itself.
  extra         jsonb       not null default '{}'::jsonb,
  -- Pack ownership / clone provenance — see cards table for the model.
  pack_id              uuid  references public.packs    (id) on delete cascade,
  pack_source_id       uuid  references public.keywords (id) on delete set null,
  pack_source_snapshot jsonb,
  created_at    timestamptz not null default now(),
  -- Three valid pack-state rows: user content / pack source / clone.
  constraint keywords_pack_state check (
    (pack_id is null     and pack_source_id is null) or
    (pack_id is not null and pack_source_id is null) or
    (pack_id is null     and pack_source_id is not null)
  )
);

-- Uniqueness is split by ownership scope. A single inline unique on
-- (user_id, game_id, name) would block pack owners from having a
-- personal keyword and a pack keyword with the same name (both rows
-- share user_id), block two of their own packs from sharing a keyword
-- name, and block clones imported from different packs.
create unique index if not exists keywords_user_game_name_personal_uniq
  on public.keywords (user_id, game_id, name)
  where pack_id is null and pack_source_id is null;

create unique index if not exists keywords_pack_game_name_uniq
  on public.keywords (pack_id, game_id, name)
  where pack_id is not null;

-- Pack and clone lookup indexes for keywords (parallel to cards/addons).
create index if not exists keywords_pack_id_idx
  on public.keywords (pack_id) where pack_id is not null;
create index if not exists keywords_pack_source_id_idx
  on public.keywords (pack_source_id) where pack_source_id is not null;

-- Assigns keywords to cards with per-instance parameter values.
create table public.card_keywords (
  id          uuid        primary key default gen_random_uuid(),
  card_id     uuid        not null references public.cards (id) on delete cascade,
  keyword_id  uuid        not null references public.keywords (id) on delete cascade,
  -- Actual parameter values for this instance, e.g. {"X": 3}.
  params      jsonb       not null default '{}'::jsonb,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  unique (card_id, keyword_id)
);

-- Assigns keywords to addons with per-instance parameter values.
create table public.addon_keywords (
  id          uuid        primary key default gen_random_uuid(),
  addon_id    uuid        not null references public.addons (id) on delete cascade,
  keyword_id  uuid        not null references public.keywords (id) on delete cascade,
  -- Actual parameter values for this instance, e.g. {"X": 2}.
  params      jsonb       not null default '{}'::jsonb,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  unique (addon_id, keyword_id)
);

alter table public.keywords       enable row level security;
alter table public.card_keywords  enable row level security;
alter table public.addon_keywords enable row level security;

-- keywords: users manage their own rows; can also read keywords from
-- packs they can see, and pack owners can write rows in their own packs.
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

-- card_keywords: users manage rows for cards in their own decks
create policy "card_keywords_select" on public.card_keywords
  for select to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_keywords_insert" on public.card_keywords
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_keywords_update" on public.card_keywords
  for update to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

create policy "card_keywords_delete" on public.card_keywords
  for delete to authenticated
  using (
    exists (
      select 1 from public.cards
      join public.decks on decks.id = cards.deck_id
      where cards.id = card_keywords.card_id
        and decks.user_id = auth.uid()
    )
  );

-- addon_keywords: users manage rows for their own addons
create policy "addon_keywords_select" on public.addon_keywords
  for select to authenticated
  using (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );

create policy "addon_keywords_insert" on public.addon_keywords
  for insert to authenticated
  with check (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );

create policy "addon_keywords_update" on public.addon_keywords
  for update to authenticated
  using (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );

create policy "addon_keywords_delete" on public.addon_keywords
  for delete to authenticated
  using (
    exists (
      select 1 from public.addons
      where addons.id = addon_keywords.addon_id
        and addons.user_id = auth.uid()
    )
  );


-- ── Game constraints ─────────────────────────────────────────────────────────
-- Stores per-game, per-entity-type validation rules in a JSONB column.
-- Shape of constraints:
--   { "fields": { "<fieldKey>": { required, min, max, minLength, maxLength, pattern } },
--     "limits": { "maxAddons": N, "maxKeywords": N } }
-- For stat fields, use "stats.<key>" as the field key.

create table public.game_constraints (
  id            uuid        primary key default gen_random_uuid(),
  game_id       uuid        not null references public.games (id) on delete cascade,
  entity_type   text        not null check (entity_type in ('card', 'addon', 'keyword')),
  addon_type_id uuid        references public.addon_types (id) on delete cascade,
  constraints   jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- One constraint row per (game, entity_type) when addon_type_id IS NULL
create unique index game_constraints_without_addon
  on public.game_constraints (game_id, entity_type)
  where addon_type_id is null;

-- One constraint row per (game, entity_type, addon_type_id) when NOT NULL
create unique index game_constraints_with_addon
  on public.game_constraints (game_id, entity_type, addon_type_id)
  where addon_type_id is not null;

alter table public.game_constraints enable row level security;

-- Anyone can read constraints (they're game-level config, not user data).
-- Writes require the service role (admin only).
create policy "game_constraints_select" on public.game_constraints
  for select to authenticated using (true);


-- ── Trigger: validate entity field constraints ──────────────────────────────

create or replace function public.validate_card_constraints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id  uuid;
  _gc       jsonb;
  _fields   jsonb;
  _fc       jsonb;
  _key      text;
  _val      jsonb;
begin
  -- Resolve game_id through the card's deck
  select d.game_id into _game_id
  from public.decks d where d.id = new.deck_id;

  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = _game_id
    and gc.entity_type = 'card'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _fields := _gc -> 'fields';
  if _fields is null then return new; end if;

  for _key in select jsonb_object_keys(_fields) loop
    _fc := _fields -> _key;

    -- Resolve value: "stats.X" reads from new.stats->'X', else reads column
    if _key like 'stats.%' then
      _val := new.stats -> substring(_key from 7);
    elsif _key = 'name' then
      _val := to_jsonb(new.name);
    else
      continue;
    end if;

    -- required
    if (_fc ->> 'required')::boolean is true
       and (_val is null or _val = 'null'::jsonb or _val = '""'::jsonb) then
      raise exception 'Field "%" is required', _key;
    end if;

    -- skip further checks if value is null
    if _val is null or _val = 'null'::jsonb then continue; end if;

    -- min / max (numeric)
    if _fc ? 'min' and (_val)::text::numeric < (_fc ->> 'min')::numeric then
      raise exception 'Field "%" must be >= %', _key, _fc ->> 'min';
    end if;
    if _fc ? 'max' and (_val)::text::numeric > (_fc ->> 'max')::numeric then
      raise exception 'Field "%" must be <= %', _key, _fc ->> 'max';
    end if;

    -- minLength / maxLength (text)
    if _fc ? 'minLength' and length(_val #>> '{}') < (_fc ->> 'minLength')::int then
      raise exception 'Field "%" must be at least % characters', _key, _fc ->> 'minLength';
    end if;
    if _fc ? 'maxLength' and length(_val #>> '{}') > (_fc ->> 'maxLength')::int then
      raise exception 'Field "%" must be at most % characters', _key, _fc ->> 'maxLength';
    end if;

    -- pattern (text)
    if _fc ? 'pattern' and (_val #>> '{}') !~ (_fc ->> 'pattern') then
      raise exception 'Field "%" does not match pattern %', _key, _fc ->> 'pattern';
    end if;
  end loop;

  return new;
end;
$$;

create trigger cards_validate_constraints
  before insert or update on public.cards
  for each row execute procedure public.validate_card_constraints();


create or replace function public.validate_addon_constraints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _gc       jsonb;
  _fields   jsonb;
  _fc       jsonb;
  _key      text;
  _val      jsonb;
begin
  -- Look for addon-type-specific constraints first, fall back to generic
  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = new.game_id
    and gc.entity_type = 'addon'
    and gc.addon_type_id = new.addon_type_id;

  if _gc is null then
    select gc.constraints into _gc
    from public.game_constraints gc
    where gc.game_id = new.game_id
      and gc.entity_type = 'addon'
      and gc.addon_type_id is null;
  end if;

  if _gc is null then return new; end if;

  _fields := _gc -> 'fields';
  if _fields is null then return new; end if;

  for _key in select jsonb_object_keys(_fields) loop
    _fc := _fields -> _key;

    if _key like 'stats.%' then
      _val := new.stats -> substring(_key from 7);
    elsif _key = 'name' then
      _val := to_jsonb(new.name);
    elsif _key = 'description' then
      _val := to_jsonb(new.description);
    else
      continue;
    end if;

    if (_fc ->> 'required')::boolean is true
       and (_val is null or _val = 'null'::jsonb or _val = '""'::jsonb) then
      raise exception 'Field "%" is required', _key;
    end if;

    if _val is null or _val = 'null'::jsonb then continue; end if;

    if _fc ? 'min' and (_val)::text::numeric < (_fc ->> 'min')::numeric then
      raise exception 'Field "%" must be >= %', _key, _fc ->> 'min';
    end if;
    if _fc ? 'max' and (_val)::text::numeric > (_fc ->> 'max')::numeric then
      raise exception 'Field "%" must be <= %', _key, _fc ->> 'max';
    end if;

    if _fc ? 'minLength' and length(_val #>> '{}') < (_fc ->> 'minLength')::int then
      raise exception 'Field "%" must be at least % characters', _key, _fc ->> 'minLength';
    end if;
    if _fc ? 'maxLength' and length(_val #>> '{}') > (_fc ->> 'maxLength')::int then
      raise exception 'Field "%" must be at most % characters', _key, _fc ->> 'maxLength';
    end if;

    if _fc ? 'pattern' and (_val #>> '{}') !~ (_fc ->> 'pattern') then
      raise exception 'Field "%" does not match pattern %', _key, _fc ->> 'pattern';
    end if;
  end loop;

  return new;
end;
$$;

create trigger addons_validate_constraints
  before insert or update on public.addons
  for each row execute procedure public.validate_addon_constraints();


create or replace function public.validate_keyword_constraints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _gc       jsonb;
  _fields   jsonb;
  _fc       jsonb;
  _key      text;
  _val      jsonb;
begin
  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = new.game_id
    and gc.entity_type = 'keyword'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _fields := _gc -> 'fields';
  if _fields is null then return new; end if;

  for _key in select jsonb_object_keys(_fields) loop
    _fc := _fields -> _key;

    if _key = 'name' then
      _val := to_jsonb(new.name);
    elsif _key = 'description' then
      _val := to_jsonb(new.description);
    else
      continue;
    end if;

    if (_fc ->> 'required')::boolean is true
       and (_val is null or _val = 'null'::jsonb or _val = '""'::jsonb) then
      raise exception 'Field "%" is required', _key;
    end if;

    if _val is null or _val = 'null'::jsonb then continue; end if;

    if _fc ? 'minLength' and length(_val #>> '{}') < (_fc ->> 'minLength')::int then
      raise exception 'Field "%" must be at least % characters', _key, _fc ->> 'minLength';
    end if;
    if _fc ? 'maxLength' and length(_val #>> '{}') > (_fc ->> 'maxLength')::int then
      raise exception 'Field "%" must be at most % characters', _key, _fc ->> 'maxLength';
    end if;

    if _fc ? 'pattern' and (_val #>> '{}') !~ (_fc ->> 'pattern') then
      raise exception 'Field "%" does not match pattern %', _key, _fc ->> 'pattern';
    end if;
  end loop;

  return new;
end;
$$;

create trigger keywords_validate_constraints
  before insert or update on public.keywords
  for each row execute procedure public.validate_keyword_constraints();


-- ── Trigger: validate entity limits (maxAddons, maxKeywords) ────────────────

create or replace function public.validate_card_addon_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id     uuid;
  _gc          jsonb;
  _max_addons  int;
  _current     int;
begin
  select d.game_id into _game_id
  from public.cards c
  join public.decks d on d.id = c.deck_id
  where c.id = new.card_id;

  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = _game_id
    and gc.entity_type = 'card'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _max_addons := (_gc -> 'limits' ->> 'maxAddons')::int;
  if _max_addons is null then return new; end if;

  select count(*) into _current
  from public.card_addons ca
  where ca.card_id = new.card_id;

  if _current >= _max_addons then
    raise exception 'Card already has the maximum number of addons (%)', _max_addons;
  end if;

  return new;
end;
$$;

create trigger card_addons_validate_limit
  before insert on public.card_addons
  for each row execute procedure public.validate_card_addon_limit();


create or replace function public.validate_card_keyword_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id       uuid;
  _gc            jsonb;
  _max_keywords  int;
  _current       int;
begin
  select d.game_id into _game_id
  from public.cards c
  join public.decks d on d.id = c.deck_id
  where c.id = new.card_id;

  select gc.constraints into _gc
  from public.game_constraints gc
  where gc.game_id = _game_id
    and gc.entity_type = 'card'
    and gc.addon_type_id is null;

  if _gc is null then return new; end if;

  _max_keywords := (_gc -> 'limits' ->> 'maxKeywords')::int;
  if _max_keywords is null then return new; end if;

  select count(*) into _current
  from public.card_keywords ck
  where ck.card_id = new.card_id;

  if _current >= _max_keywords then
    raise exception 'Card already has the maximum number of keywords (%)', _max_keywords;
  end if;

  return new;
end;
$$;

create trigger card_keywords_validate_limit
  before insert on public.card_keywords
  for each row execute procedure public.validate_card_keyword_limit();


create or replace function public.validate_addon_keyword_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _game_id       uuid;
  _gc            jsonb;
  _max_keywords  int;
  _current       int;
begin
  select a.game_id into _game_id
  from public.addons a
  where a.id = new.addon_id;

  -- Check addon-type-specific constraints first, then fall back
  select gc.constraints into _gc
  from public.game_constraints gc
  join public.addons a on a.game_id = gc.game_id
  where a.id = new.addon_id
    and gc.entity_type = 'addon'
    and gc.addon_type_id = a.addon_type_id;

  if _gc is null then
    select gc.constraints into _gc
    from public.game_constraints gc
    where gc.game_id = _game_id
      and gc.entity_type = 'addon'
      and gc.addon_type_id is null;
  end if;

  if _gc is null then return new; end if;

  _max_keywords := (_gc -> 'limits' ->> 'maxKeywords')::int;
  if _max_keywords is null then return new; end if;

  select count(*) into _current
  from public.addon_keywords ak
  where ak.addon_id = new.addon_id;

  if _current >= _max_keywords then
    raise exception 'Addon already has the maximum number of keywords (%)', _max_keywords;
  end if;

  return new;
end;
$$;

create trigger addon_keywords_validate_limit
  before insert on public.addon_keywords
  for each row execute procedure public.validate_addon_keyword_limit();


-- ── Seed: games ───────────────────────────────────────────────────────────────

insert into public.games (name, slug, stat_schema) values (
  'Blood Bowl',
  'blood-bowl',
  '[
    {"key": "teamName",           "label": "Team Name",           "type": "text", "userSpecific": true},
    {"key": "playerRole",         "label": "Player Role",         "type": "text"},
    {"key": "cost",               "label": "Cost (GP)",           "type": "text"},
    {"key": "primaryAttribute",   "label": "Primary Attribute",   "type": "text"},
    {"key": "secondaryAttribute", "label": "Secondary Attribute", "type": "text"},
    {"key": "ma",                 "label": "MA",                  "type": "number"},
    {"key": "st",                 "label": "ST",                  "type": "number"},
    {"key": "ag",                 "label": "AG",                  "type": "number"},
    {"key": "pa",                 "label": "PA",                  "type": "number"},
    {"key": "av",                 "label": "AV",                  "type": "number"}
  ]'::jsonb
);

insert into public.games (name, slug, stat_schema) values (
  'Halo: Flashpoint',
  'halo-flashpoint',
  '[
    {"key": "keywords",     "label": "Keywords",      "type": "text"},
    {"key": "ra",           "label": "RA",            "type": "number"},
    {"key": "fi",           "label": "FI",            "type": "number"},
    {"key": "sv",           "label": "SV",            "type": "number"},
    {"key": "advanceValue", "label": "Speed Advance", "type": "number"},
    {"key": "sprintValue",  "label": "Speed Sprint",  "type": "number"},
    {"key": "ar",           "label": "AR",            "type": "number"},
    {"key": "hp",           "label": "HP",            "type": "number"},
    {"key": "pointsCost",   "label": "Points Cost",   "type": "number"}
  ]'::jsonb
);

insert into public.games (name, slug, stat_schema, print_size, bleed_size) values (
  'Kill Team',
  'kill-team',
  '[
    {"key": "role",     "label": "Operative Type", "type": "text"},
    {"key": "teamName", "label": "Team Name",      "type": "text", "userSpecific": true},
    {"key": "tags",     "label": "Tags",           "type": "text"},
    {"key": "actions",  "label": "A",              "type": "number"},
    {"key": "movement", "label": "M",              "type": "number"},
    {"key": "save",     "label": "S",              "type": "number"},
    {"key": "wounds",   "label": "W",              "type": "number"},
    {"key": "baseSize", "label": "Base Size",      "type": "number"}
  ]'::jsonb,
  '[127, 89]'::jsonb,
  '[133, 95]'::jsonb
);


-- ── Seed: addon_types ─────────────────────────────────────────────────────────

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Skills', 'skills',
  '[
    {"key": "description", "label": "Description", "type": "text"}
  ]'::jsonb
from public.games where slug = 'blood-bowl';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "type",     "label": "Type",     "type": "text"},
    {"key": "range",    "label": "Range",    "type": "text"},
    {"key": "ap",       "label": "AP",       "type": "text"},
    {"key": "keywords",   "label": "Keywords",    "type": "text"},
    {"key": "pointsCost", "label": "Points Cost", "type": "text"}
  ]'::jsonb
from public.games where slug = 'halo-flashpoint';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "meleeOrRanged", "label": "Melee or Ranged", "type": "text"},
    {"key": "attack",        "label": "Attack",          "type": "number"},
    {"key": "hit",           "label": "Hit",             "type": "number"},
    {"key": "baseDamage",    "label": "Base Damage",     "type": "number"},
    {"key": "critDamage",    "label": "Crit Damage",     "type": "number"}
  ]'::jsonb
from public.games where slug = 'kill-team';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Abilities', 'abilities',
  '[
    {"key": "apCost", "label": "AP Cost", "type": "number"}
  ]'::jsonb
from public.games where slug = 'kill-team';


-- ── Seed: game_constraints ───────────────────────────────────────────────────

-- Blood Bowl — card constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'card', null, '{
  "fields": {
    "name":                      { "required": true, "maxLength": 40 },
    "stats.teamName":            { "maxLength": 40 },
    "stats.playerRole":          { "maxLength": 30 },
    "stats.cost":                { "maxLength": 20 },
    "stats.primaryAttribute":    { "maxLength": 30 },
    "stats.secondaryAttribute":  { "maxLength": 30 },
    "stats.ma":                  { "min": 0, "max": 9 },
    "stats.st":                  { "min": 0, "max": 9 },
    "stats.ag":                  { "min": 0, "max": 9 },
    "stats.pa":                  { "min": 0, "max": 9 },
    "stats.av":                  { "min": 0, "max": 9 }
  },
  "limits": {
    "maxKeywords": 10
  }
}'::jsonb
from public.games g where g.slug = 'blood-bowl';

-- Blood Bowl — keyword constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'keyword', null, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g where g.slug = 'blood-bowl';

-- Blood Bowl — skill addon constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":              { "required": true, "maxLength": 40 },
    "stats.description": { "maxLength": 500 }
  },
  "limits": {
    "maxKeywords": 5
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'skills'
where g.slug = 'blood-bowl';

-- Halo: Flashpoint — card constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'card', null, '{
  "fields": {
    "name":               { "required": true, "maxLength": 40 },
    "stats.keywords":     { "maxLength": 100 },
    "stats.ra":           { "min": 0, "max": 9 },
    "stats.fi":           { "min": 0, "max": 9 },
    "stats.sv":           { "min": 0, "max": 9 },
    "stats.advanceValue": { "min": 0, "max": 9 },
    "stats.sprintValue":  { "min": 0, "max": 9 },
    "stats.ar":           { "min": 0, "max": 9 },
    "stats.hp":           { "min": 0, "max": 9 },
    "stats.pointsCost":   { "min": 0, "max": 999 }
  },
  "limits": {
    "maxAddons":   3,
    "maxKeywords": 10
  }
}'::jsonb
from public.games g where g.slug = 'halo-flashpoint';

-- Halo: Flashpoint — keyword constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'keyword', null, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g where g.slug = 'halo-flashpoint';

-- Halo: Flashpoint — weapon addon constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":              { "required": true, "maxLength": 40 },
    "stats.type":        { "maxLength": 30 },
    "stats.range":       { "maxLength": 20 },
    "stats.ap":          { "maxLength": 10 },
    "stats.keywords":    { "maxLength": 100 },
    "stats.pointsCost":  { "maxLength": 10 }
  },
  "limits": {
    "maxKeywords": 5
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'weapons'
where g.slug = 'halo-flashpoint';


-- ── Packs: import RPC ────────────────────────────────────────────────────────
-- Atomic deep-clone of a pack into the calling user's tables. Cloned cards
-- always land as templates (deck_id = null, is_template = true). Each clone
-- carries pack_source_id (for future update detection) and a
-- pack_source_snapshot of the source's content fields (for the field-level
-- merge that will land with re-import).
--
-- SECURITY DEFINER: bypasses RLS so the function can insert join rows
-- (card_addons / card_keywords) for templates, which the user-context
-- INSERT policies forbid. Equivalent access checks are enforced explicitly
-- inside the function (auth, pack visibility, no self-import, idempotency).

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
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select id, owner_user_id, is_public
    into v_pack
  from public.packs
  where id = p_pack_id;

  if v_pack.id is null
    or not (v_pack.is_public or v_pack.owner_user_id = v_user_id) then
    raise exception 'Pack not found or not accessible' using errcode = '42501';
  end if;

  if v_pack.owner_user_id = v_user_id then
    raise exception 'Cannot import your own pack' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.pack_imports
    where pack_id = p_pack_id and user_id = v_user_id
  ) then
    raise exception 'Pack already imported' using errcode = '23505';
  end if;

  -- Clone keywords; collect source→clone id map.
  with cloned as (
    insert into public.keywords (
      user_id, game_id, name, description, params_schema, extra,
      pack_source_id, pack_source_snapshot
    )
    select
      v_user_id, k.game_id, k.name, k.description, k.params_schema, k.extra,
      k.id,
      jsonb_build_object(
        'name', k.name, 'description', k.description,
        'params_schema', k.params_schema, 'extra', k.extra
      )
    from public.keywords k
    where k.pack_id = p_pack_id
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_keyword_map
  from cloned;

  -- Clone addons (parent_addon_id deferred to second pass).
  with cloned as (
    insert into public.addons (
      user_id, addon_type_id, game_id, name, description, stats,
      parent_addon_id, pack_source_id, pack_source_snapshot
    )
    select
      v_user_id, a.addon_type_id, a.game_id, a.name, a.description, a.stats,
      null, a.id,
      jsonb_build_object(
        'name', a.name, 'description', a.description, 'stats', a.stats,
        'parent_addon_id', a.parent_addon_id
      )
    from public.addons a
    where a.pack_id = p_pack_id
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_addon_map
  from cloned;

  -- Pass two: remap parent_addon_id on clones.
  update public.addons clone
     set parent_addon_id = (v_addon_map ->> src.parent_addon_id::text)::uuid
  from public.addons src
  where src.id = clone.pack_source_id
    and src.pack_id = p_pack_id
    and src.parent_addon_id is not null;

  -- Clone addon_keywords joins.
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order)
  select
    (v_addon_map   ->> ak.addon_id::text)::uuid,
    (v_keyword_map ->> ak.keyword_id::text)::uuid,
    ak.params, ak.sort_order
  from public.addon_keywords ak
  join public.addons a on a.id = ak.addon_id
  where a.pack_id = p_pack_id;

  -- Clone cards (always as templates).
  with cloned as (
    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats,
      is_template, pack_source_id, pack_source_snapshot
    )
    select
      null, v_user_id, c.game_id, c.name, c.card_type, c.stats,
      true, c.id,
      jsonb_build_object(
        'name', c.name, 'card_type', c.card_type, 'stats', c.stats
      )
    from public.cards c
    where c.pack_id = p_pack_id
    returning id, pack_source_id
  )
  select coalesce(jsonb_object_agg(pack_source_id::text, id::text), '{}'::jsonb)
    into v_card_map
  from cloned;

  -- Clone card_addons / card_keywords joins.
  insert into public.card_addons (card_id, addon_id, sort_order)
  select
    (v_card_map  ->> ca.card_id::text)::uuid,
    (v_addon_map ->> ca.addon_id::text)::uuid,
    ca.sort_order
  from public.card_addons ca
  join public.cards c on c.id = ca.card_id
  where c.pack_id = p_pack_id;

  insert into public.card_keywords (card_id, keyword_id, params, sort_order)
  select
    (v_card_map    ->> ck.card_id::text)::uuid,
    (v_keyword_map ->> ck.keyword_id::text)::uuid,
    ck.params, ck.sort_order
  from public.card_keywords ck
  join public.cards c on c.id = ck.card_id
  where c.pack_id = p_pack_id;

  insert into public.pack_imports (user_id, pack_id)
  values (v_user_id, p_pack_id);
end;
$$;

revoke all on function public.import_pack(uuid) from public;
grant  execute on function public.import_pack(uuid) to authenticated;


-- ── Packs: pack-to-pack copy RPCs ────────────────────────────────────────────
-- Used by the pack editor's "Add X to Pack" flow. Each function takes a
-- target pack id (must be owned by caller) and an array of source entity
-- ids. Source rows can come from:
--   - any pack the caller owns (same game as target), OR
--   - any deck the caller owns (cards only, same game), OR
--   - the caller's standalone user-owned rows (no pack, no deck — for
--     cards this means is_template=true; for addons/keywords this means
--     personal-library rows).
-- Copies them into the target pack as fresh pack-source rows, pulling in
-- dependencies:
--   copy_addons_to_pack also copies attached keywords (deduped by name)
--   copy_cards_to_pack  also copies attached addons + keywords
-- All three are SECURITY DEFINER for the same reason as import_pack (the
-- user-context join-table INSERT policies forbid templates without a deck).

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

revoke all on function public.copy_keywords_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_keywords_to_pack(uuid, uuid[]) to authenticated;


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

  -- Keywords referenced by these addons, deduped into target pack by name.
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

  -- Clone the addons (parent_addon_id deferred to second pass).
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

revoke all on function public.copy_addons_to_pack(uuid, uuid[]) from public;
grant  execute on function public.copy_addons_to_pack(uuid, uuid[]) to authenticated;


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

  -- Collect userSpecific keys from the game's stat_schema; cards copied
  -- into the pack get these keys stripped from their cloned stats blob.
  v_user_keys := array(
    select coalesce(field->>'key', '')
    from jsonb_array_elements(coalesce(v_target_schema, '[]'::jsonb)) as field
    where (field->>'userSpecific')::boolean = true
  );

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
  -- may be null for deck cards), and apply two transforms before insert:
  --   1. Substitute the override name from p_card_overrides if present
  --      (used by the pack editor's rename modal).
  --   2. Strip every userSpecific key from the cloned stats blob.
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

revoke all on function public.copy_cards_to_pack(uuid, uuid[], jsonb) from public;
grant  execute on function public.copy_cards_to_pack(uuid, uuid[], jsonb) to authenticated;
