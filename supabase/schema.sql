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

create table public.decks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  game_id    uuid        not null references public.games (id) on delete restrict,
  name       text        not null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id         uuid        primary key default gen_random_uuid(),
  deck_id    uuid        not null references public.decks (id) on delete cascade,
  name       text        not null,
  -- Discriminator for the card layout. 'operative' is the default game-piece
  -- card; 'rule' is a faction-rule / ploy / mission style card.
  card_type  text        not null default 'operative'
                              check (card_type in ('operative', 'rule')),
  -- Game-specific stats stored as a flexible JSON object.
  -- Shape is defined by the parent game's stat_schema.
  stats      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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
  created_at    timestamptz not null default now()
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

create trigger addon_set_game_id
  before insert or update of addon_type_id on public.addons
  for each row execute procedure public.set_addon_game_id();


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.games       enable row level security;
alter table public.addon_types enable row level security;
alter table public.decks       enable row level security;
alter table public.cards       enable row level security;
alter table public.addons      enable row level security;
alter table public.card_addons enable row level security;

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

-- cards: users manage cards that belong to their own decks
create policy "cards_select" on public.cards
  for select to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "cards_insert" on public.cards
  for insert to authenticated
  with check (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "cards_update" on public.cards
  for update to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "cards_delete" on public.cards
  for delete to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.user_id = auth.uid()
    )
  );

-- addons: users manage only their own rows
create policy "addons_select" on public.addons
  for select to authenticated
  using (auth.uid() = user_id);

create policy "addons_insert" on public.addons
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "addons_update" on public.addons
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "addons_delete" on public.addons
  for delete to authenticated
  using (auth.uid() = user_id);

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

-- Keyword definitions — user-owned, scoped to a game.
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
  created_at    timestamptz not null default now(),
  unique (user_id, game_id, name)
);

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

-- keywords: users manage only their own rows
create policy "keywords_select" on public.keywords
  for select to authenticated
  using (auth.uid() = user_id);

create policy "keywords_insert" on public.keywords
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "keywords_update" on public.keywords
  for update to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "keywords_delete" on public.keywords
  for delete to authenticated
  using (auth.uid() = user_id);

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


-- ── Seed: games ───────────────────────────────────────────────────────────────

insert into public.games (name, slug, stat_schema) values (
  'Blood Bowl',
  'blood-bowl',
  '[
    {"key": "teamName",           "label": "Team Name",           "type": "text"},
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

insert into public.games (name, slug, stat_schema) values (
  'Kill Team',
  'kill-team',
  '[
    {"key": "role",     "label": "Role",     "type": "text"},
    {"key": "teamName", "label": "Team Name","type": "text"},
    {"key": "tags",     "label": "Tags",     "type": "text"},
    {"key": "actions",  "label": "A",        "type": "number"},
    {"key": "movement", "label": "M",        "type": "number"},
    {"key": "save",     "label": "S",        "type": "number"},
    {"key": "wounds",   "label": "W",        "type": "number"},
    {"key": "baseSize", "label": "Base Size","type": "number"}
  ]'::jsonb
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
